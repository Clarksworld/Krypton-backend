import { NextRequest } from "next/server";
import { db } from "@/db";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/mining/wallet:
 *   get:
 *     summary: Get Upgrade Fee Wallet Address
 *     description: Retrieve the official wallet address where users should send their upgrade payments.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const setting = await db.query.globalSettings.findFirst({
      where: (s, { eq }) => eq(s.key, "upgrade_fee_wallet_address"),
    });

    return ok({
      walletAddress: setting ? setting.value : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
