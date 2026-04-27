import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { userMiningUpgrades, miningStats, miningUpgrades } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * @swagger
 * /api/mining/upgrades/verify:
 *   post:
 *     summary: Verify Upgrade Payment
 *     description: Verify a blockchain transaction hash and activate the mining boost.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [upgradeId, txHash]
 *             properties:
 *               upgradeId:
 *                 type: string
 *               txHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upgrade activated
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { upgradeId, txHash } = await req.json();

    if (!upgradeId || !txHash) {
      return err("Missing upgradeId or txHash", 400);
    }

    // 1. Check if txHash has already been used
    const existingTx = await db.query.userMiningUpgrades.findFirst({
      where: (u, { eq }) => eq(u.txHash, txHash),
    });

    if (existingTx) {
      return err("This transaction hash has already been used", 400);
    }

    // 2. Get upgrade details
    const upgrade = await db.query.miningUpgrades.findFirst({
      where: (u, { eq }) => eq(u.id, upgradeId),
    });

    if (!upgrade) {
      return err("Upgrade plan not found", 404);
    }

    // 3. Activate upgrade in transaction
    const durationDays = parseInt(upgrade.durationDays || "30");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await db.transaction(async (tx) => {
      // Create user upgrade record
      await tx.insert(userMiningUpgrades).values({
        userId,
        upgradeId,
        txHash,
        status: "active",
        startedAt: new Date(),
        expiresAt,
      });

      // Update mining stats with new rate
      const stats = await tx.query.miningStats.findFirst({
        where: (m, { eq }) => eq(m.userId, userId),
      });

      if (stats) {
        await tx
          .update(miningStats)
          .set({
            miningRate: upgrade.miningRate,
            updatedAt: new Date(),
          })
          .where(eq(miningStats.userId, userId));
      } else {
        await tx.insert(miningStats).values({
          userId,
          miningRate: upgrade.miningRate,
        });
      }
    });

    return ok({
      message: "Upgrade activated successfully!",
      miningRate: upgrade.miningRate,
      expiresAt,
    });
  } catch (error) {
    return handleError(error);
  }
}
