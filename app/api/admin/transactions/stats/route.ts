import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, and, gte, lt, sum, sql } from "drizzle-orm";
import { transactions, cryptoAssets } from "@/db/schema";

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
        pendingDeposits: sql<number>`count(*) filter (where ${transactions.status} = 'pending' and ${transactions.type} = 'deposit')`,
        pendingWithdrawals: sql<number>`count(*) filter (where ${transactions.status} = 'pending' and ${transactions.type} = 'withdrawal')`,
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

    // 3. Asset Exposure (total fiat volume per asset to estimate exposure/distribution)
    const assetExposureRaw = await db
      .select({
        symbol: cryptoAssets.symbol,
        name: cryptoAssets.name,
        totalFiat: sum(transactions.fiatAmount)
      })
      .from(transactions)
      .leftJoin(cryptoAssets, eq(transactions.assetId, cryptoAssets.id))
      .where(eq(transactions.status, "completed"))
      .groupBy(cryptoAssets.id);
      
    const totalExposureFiat = assetExposureRaw.reduce((sum, item) => sum + parseFloat(item.totalFiat ?? "0"), 0);
    const assetExposure = assetExposureRaw.map(item => {
      const fiat = parseFloat(item.totalFiat ?? "0");
      const percentage = totalExposureFiat > 0 ? (fiat / totalExposureFiat) * 100 : 0;
      return {
        symbol: item.symbol ?? 'Unknown',
        name: item.name ?? 'Unknown',
        percentage: Math.round(percentage * 10) / 10
      };
    }).sort((a, b) => b.percentage - a.percentage);

    // 4. System Performance (Transaction count over last 24 hours in 2-hour buckets)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentTx = await db
      .select({
        createdAt: transactions.createdAt
      })
      .from(transactions)
      .where(gte(transactions.createdAt, twentyFourHoursAgo));
    
    // Bucket them in code (12 buckets, 2 hours each)
    const performanceBuckets = Array(12).fill(0);
    recentTx.forEach(tx => {
      if (tx.createdAt) {
        const hoursAgo = (now.getTime() - tx.createdAt.getTime()) / (1000 * 60 * 60);
        const bucketIndex = 11 - Math.floor(hoursAgo / 2);
        if (bucketIndex >= 0 && bucketIndex < 12) {
          performanceBuckets[bucketIndex]++;
        }
      }
    });

    return ok({
      stats: {
        totalVolume: stats.totalVolume ?? "0",
        volumeChange: volChange,
        successRate: Math.round(successRate * 10) / 10,
        averageFee: Math.round(avgFee * 100) / 100,
        pendingDeposits: Number(stats.pendingDeposits ?? 0),
        pendingWithdrawals: Number(stats.pendingWithdrawals ?? 0),
      },
      assetExposure,
      systemPerformance: performanceBuckets
    });
  } catch (error) {
    return handleError(error);
  }
}
