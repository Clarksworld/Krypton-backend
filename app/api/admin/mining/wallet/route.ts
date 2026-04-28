import { NextRequest } from "next/server";
import { db } from "@/db";
import { globalSettings } from "@/db/schema";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/mining/wallet:
 *   get:
 *     summary: Admin - Get Upgrade Fee Wallet Address
 *     description: Retrieve the wallet address where users send their upgrade payments.
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

/**
 * @swagger
 * /api/admin/mining/wallet:
 *   post:
 *     summary: Admin - Set Upgrade Fee Wallet Address
 *     description: Set the global wallet address for users to pay their upgrade fees.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress]
 *             properties:
 *               walletAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    getAdminId(req);
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return err("walletAddress must be a valid string", 400);
    }

    const existing = await db.query.globalSettings.findFirst({
      where: (s, { eq }) => eq(s.key, "upgrade_fee_wallet_address"),
    });

    if (existing) {
      await db.update(globalSettings)
        .set({ value: walletAddress, updatedAt: new Date() })
        .where(eq(globalSettings.key, "upgrade_fee_wallet_address"));
    } else {
      await db.insert(globalSettings).values({
        key: "upgrade_fee_wallet_address",
        value: walletAddress,
        type: "string",
        description: "Wallet address where users pay their mining upgrade fees",
      });
    }

    return ok({ message: "Upgrade fee wallet address updated successfully", walletAddress });
  } catch (error) {
    return handleError(error);
  }
}
