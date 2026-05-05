import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, and, gte, lt, sum, sql, desc } from "drizzle-orm";
import { p2pTrades, p2pDisputes, users } from "@/db/schema";

/**
 * @swagger
 * /api/admin/p2p/stats:
 *   get:
 *     summary: Admin — P2P Dashboard Statistics
 *     description: Retrieve ecosystem health metrics for the P2P dashboard.
 *     tags: [Admin, P2P]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // 1. Volume Stats
    const [currentVolumeRow] = await db
      .select({ volume: sum(p2pTrades.fiatAmount) })
      .from(p2pTrades)
      .where(and(eq(p2pTrades.status, "completed"), gte(p2pTrades.createdAt, twentyFourHoursAgo)));

    const [previousVolumeRow] = await db
      .select({ volume: sum(p2pTrades.fiatAmount) })
      .from(p2pTrades)
      .where(and(
        eq(p2pTrades.status, "completed"), 
        gte(p2pTrades.createdAt, fortyEightHoursAgo),
        lt(p2pTrades.createdAt, twentyFourHoursAgo)
      ));

    const volCurrent = parseFloat(currentVolumeRow.volume ?? "0");
    const volPrevious = parseFloat(previousVolumeRow.volume ?? "0");
    
    let volChange = 0;
    if (volPrevious > 0) {
      volChange = Math.round(((volCurrent - volPrevious) / volPrevious) * 1000) / 10;
    } else if (volCurrent > 0) {
      volChange = 100;
    }

    // 2. Pending Disputes
    const [pendingDisputesRow] = await db
      .select({ total: count() })
      .from(p2pDisputes)
      .where(eq(p2pDisputes.status, "open"));

    // 3. Avg Resolution Time and Resolution Rate
    const allDisputes = await db
      .select({
        createdAt: p2pDisputes.createdAt,
        resolvedAt: p2pDisputes.resolvedAt,
        status: p2pDisputes.status
      })
      .from(p2pDisputes);

    let totalResolutionTimeMs = 0;
    let resolvedCount = 0;
    
    allDisputes.forEach(d => {
      if (d.status === "resolved" && d.createdAt && d.resolvedAt) {
        resolvedCount++;
        totalResolutionTimeMs += (d.resolvedAt.getTime() - d.createdAt.getTime());
      }
    });

    let avgResolutionTime = "0m";
    if (resolvedCount > 0) {
      const avgMs = totalResolutionTimeMs / resolvedCount;
      const avgMins = avgMs / (1000 * 60);
      if (avgMins > 60) {
        avgResolutionTime = `${(avgMins / 60).toFixed(1)}h`;
      } else {
        avgResolutionTime = `${avgMins.toFixed(1)}m`;
      }
    }

    const resolutionRate = allDisputes.length > 0 
      ? Math.round((resolvedCount / allDisputes.length) * 100) 
      : 100;

    // 4. Recent Decisions
    const recentDecisionsRaw = await db
      .select({
        tradeId: p2pTrades.id,
        resolution: p2pDisputes.resolution
      })
      .from(p2pDisputes)
      .leftJoin(p2pTrades, eq(p2pDisputes.tradeId, p2pTrades.id))
      .where(eq(p2pDisputes.status, "resolved"))
      .orderBy(desc(p2pDisputes.resolvedAt))
      .limit(3);
    
    const recentDecisions = recentDecisionsRaw.map(d => ({
      tradeRef: `#TR-${d.tradeId ? d.tradeId.split('-')[0].substring(0,6).toUpperCase() : 'UNKNOWN'}`,
      decision: d.resolution ? (d.resolution.length > 15 ? d.resolution.substring(0, 15) + "..." : d.resolution) : "Admin Resolved"
    }));

    // 5. High-Risk Alerts (Users with >= 3 disputed trades)
    // We can count trades by makerId and takerId where status = 'disputed'
    const disputedTrades = await db
      .select({ makerId: p2pTrades.makerId, takerId: p2pTrades.takerId })
      .from(p2pTrades)
      .where(eq(p2pTrades.status, "disputed"));
      
    const userDisputeCounts: Record<string, number> = {};
    disputedTrades.forEach(t => {
      userDisputeCounts[t.makerId] = (userDisputeCounts[t.makerId] || 0) + 1;
      userDisputeCounts[t.takerId] = (userDisputeCounts[t.takerId] || 0) + 1;
    });
    
    let highRiskUsersCount = 0;
    for (const [_, c] of Object.entries(userDisputeCounts)) {
      if (c >= 3) highRiskUsersCount++;
    }

    return ok({
      stats: {
        volume24h: volCurrent,
        volumeChange: volChange,
        pendingDisputes: pendingDisputesRow.total,
        avgResolutionTime,
        adminResolutionRate: resolutionRate,
        recentDecisions,
        highRiskUsersCount
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
