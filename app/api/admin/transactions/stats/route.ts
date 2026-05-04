import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, and, gte, lt, sum, sql } from "drizzle-orm";
import { transactions } from "@/db/schema";

/**
 * @swagger
 * /api/admin/transactions/stats:
 *   get:
 *     summary: Admin — Transaction Statistics
 *     description: Calculate key metrics for the transaction ledger.
 *     tags: [Admin]
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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // 1. Basic Stats (All time)
    // We use raw SQL for conditional count to be efficient
    const [stats] = await db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${transactions.status} = 'completed')`,
        totalVolume: sum(transactions.fiatAmount),
        totalFee: sum(transactions.fee),
      })
      .from(transactions);

    // 2. Volume Change (30d vs previous 30d)
    const [currentVolume] = await db
      .select({ volume: sum(transactions.fiatAmount) })
      .from(transactions)
      .where(and(eq(transactions.status, "completed"), gte(transactions.createdAt, thirtyDaysAgo)));

    const [previousVolume] = await db
      .select({ volume: sum(transactions.fiatAmount) })
      .from(transactions)
      .where(and(
        eq(transactions.status, "completed"), 
        gte(transactions.createdAt, sixtyDaysAgo),
        lt(transactions.createdAt, thirtyDaysAgo)
      ));

    const volCurrent = parseFloat(currentVolume.volume ?? "0");
    const volPrevious = parseFloat(previousVolume.volume ?? "0");
    
    let volChange = 0;
    if (volPrevious > 0) {
      volChange = Math.round(((volCurrent - volPrevious) / volPrevious) * 1000) / 10;
    } else if (volCurrent > 0) {
      volChange = 100;
    }

    const totalCount = Number(stats.total);
    const completedCount = Number(stats.completed);
    const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;
    const avgFee = completedCount > 0 ? parseFloat(stats.totalFee ?? "0") / completedCount : 0;

    return ok({
      stats: {
        totalVolume: stats.totalVolume ?? "0",
        volumeChange: volChange,
        successRate: Math.round(successRate * 10) / 10,
        averageFee: Math.round(avgFee * 100) / 100,
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
