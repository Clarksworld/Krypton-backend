import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, and, or, inArray, gte, desc, ilike } from "drizzle-orm";
import { users, userProfiles, wallets, cryptoAssets, p2pTrades } from "@/db/schema";

/**
 * @swagger
 * /api/admin/p2p/merchants:
 *   get:
 *     summary: Admin — P2P Merchants
 *     description: View P2P merchants (users with max KYC and qualifying balance).
 *     tags: [Admin, P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    const { searchParams } = new URL(req.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "20")));
    const search = searchParams.get("search");

    const offset = (page - 1) * pageSize;

    // 1. Find asset IDs for USDT and BNB
    const eligibleAssets = await db.select({ id: cryptoAssets.id })
      .from(cryptoAssets)
      .where(inArray(cryptoAssets.symbol, ['USDT', 'BNB']));
    
    const assetIds = eligibleAssets.map(a => a.id);

    // If no such assets exist, return empty
    if (assetIds.length === 0) {
        return ok({ merchants: [], pagination: { total: 0, page, pageSize, totalPages: 0 } });
    }

    // Base subquery for users who meet the criteria:
    // Must be KYC level 2, approved, and have >= 5 balance in USDT or BNB
    const eligibleWallets = db.select({ userId: wallets.userId })
        .from(wallets)
        .where(and(
            inArray(wallets.assetId, assetIds),
            gte(wallets.balance, "5")
        ));

    const whereCond = and(
        eq(userProfiles.kycLevel, '2'),
        eq(userProfiles.kycStatus, 'approved'),
        inArray(users.id, eligibleWallets),
        search ? or(
            ilike(users.username, `%${search}%`),
            ilike(users.email, `%${search}%`)
        ) : undefined
    );

    // Get total count
    const totalCountRes = await db.select({ count: count() })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(whereCond);
    
    const totalCount = totalCountRes[0].count;

    // Get paginated users
    const merchantsRaw = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        kycLevel: userProfiles.kycLevel,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(whereCond)
    .limit(pageSize)
    .offset(offset)
    .orderBy(desc(users.createdAt));

    // Extract IDs to fetch stats
    const merchantIds = merchantsRaw.map(m => m.id);
    let tradeStats: Record<string, { volume: number, completedCount: number, totalCount: number }> = {};
    
    if (merchantIds.length > 0) {
        const statsRaw = await db.select({
            makerId: p2pTrades.makerId,
            status: p2pTrades.status,
            fiatAmount: p2pTrades.fiatAmount,
        })
        .from(p2pTrades)
        .where(inArray(p2pTrades.makerId, merchantIds));

        for (const stat of statsRaw) {
            if (!tradeStats[stat.makerId]) {
                tradeStats[stat.makerId] = { volume: 0, completedCount: 0, totalCount: 0 };
            }
            tradeStats[stat.makerId].totalCount += 1;
            if (stat.status === 'completed') {
                tradeStats[stat.makerId].completedCount += 1;
                tradeStats[stat.makerId].volume += parseFloat(stat.fiatAmount ?? "0");
            }
        }
    }

    // Format the response
    const merchants = merchantsRaw.map(m => {
        const stats = tradeStats[m.id] || { volume: 0, completedCount: 0, totalCount: 0 };
        // If they have no trades, completion rate is technically N/A, we can display 100% or 0%. 
        // A merchant with 0 trades probably has 0% or just "N/A", we'll default to 0 for calculations.
        const rate = stats.totalCount > 0 ? (stats.completedCount / stats.totalCount) * 100 : 0;

        return {
            id: m.id,
            username: m.username || m.email,
            tier: `Tier ${parseInt(m.kycLevel || "0") + 1}`,
            volume: stats.volume,
            rate: Math.round(rate * 10) / 10, // 1 decimal place
            status: 'Active'
        };
    });

    return ok({ 
        merchants,
        pagination: {
            total: totalCount,
            page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
        }
    });

  } catch (error) {
    return handleError(error);
  }
}
