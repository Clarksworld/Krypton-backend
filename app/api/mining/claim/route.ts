import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { miningStats } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * @swagger
 * /api/mining/claim:
 *   post:
 *     summary: Claim Mined Tokens
 *     description: Claim pending mined tokens to your balance and restart the timer.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const stats = await db.query.miningStats.findFirst({
      where: (m, { eq }) => eq(m.userId, userId),
    });

    if (!stats) {
      return err("Mining not initialized", 400);
    }

    const now = new Date();
    const msSinceLast = now.getTime() - new Date(stats.lastClaimedAt || stats.createdAt!).getTime();
    const hoursSinceLast = msSinceLast / (1000 * 60 * 60);
    const pendingAccrual = hoursSinceLast * parseFloat(stats.miningRate || "0");

    if (pendingAccrual < 0.001) {
      return err("Not enough accrued to claim yet", 400);
    }

    const [updated] = await db.update(miningStats)
      .set({ 
        balance: sql`${miningStats.balance} + ${pendingAccrual.toFixed(6)}`,
        lastClaimedAt: now,
        updatedAt: now
      })
      .where(eq(miningStats.id, stats.id))
      .returning();

    return ok({ 
      message: `Successfully claimed ${pendingAccrual.toFixed(6)} tokens`,
      newBalance: updated.balance 
    });
  } catch (error) {
    return handleError(error);
  }
}
