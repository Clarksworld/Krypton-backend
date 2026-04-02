import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { miningStats } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/mining/status:
 *   get:
 *     summary: Get Mining Status
 *     description: Retrieve current mining balance and rate.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    let stats = await db.query.miningStats.findFirst({
      where: (m, { eq }) => eq(m.userId, userId),
    });

    if (!stats) {
      // Lazy initialize
      [stats] = await db.insert(miningStats).values({ userId }).returning();
    }

    // Calculate accrued since last claim
    const now = new Date();
    const msSinceLast = now.getTime() - new Date(stats.lastClaimedAt || stats.createdAt!).getTime();
    
    const hoursSinceLast = msSinceLast / (1000 * 60 * 60);
    const pendingAccrual = hoursSinceLast * parseFloat(stats.miningRate || "0");
    
    return ok({ 
      miningStats: {
        balance: stats.balance,
        miningRate: stats.miningRate,
        pendingAccrual: pendingAccrual.toFixed(6),
        lastClaimedAt: stats.lastClaimedAt
      } 
    });
  } catch (error) {
    return handleError(error);
  }
}
