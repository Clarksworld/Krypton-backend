import { NextRequest } from "next/server";
import { db } from "@/db";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/mining/upgrades:
 *   get:
 *     summary: List Mining Upgrades
 *     description: Get all available hashrate boost plans.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const upgrades = await db.query.miningUpgrades.findMany({
      where: (u, { eq }) => eq(u.isActive, true),
      orderBy: (u, { asc }) => [asc(u.priceUsdt)],
    });

    return ok({ upgrades });
  } catch (error) {
    return handleError(error);
  }
}
