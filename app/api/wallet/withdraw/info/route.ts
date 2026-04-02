import { NextRequest } from "next/server";
import { db } from "@/db";
import { ok, err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/wallet/withdraw/info:
 *   get:
 *     summary: Get Withdrawal Info
 *     description: Get withdrawal fee and minimum amount information for an asset.
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
      return err("Symbol is required", 400);
    }

    const asset = await db.query.cryptoAssets.findFirst({
      where: (ca, { eq }) => eq(ca.symbol, symbol),
      columns: { symbol: true, isActive: true, networks: true },
    });

    if (!asset || !asset.isActive) {
      return err("Asset not supported", 400);
    }

    // Default info for MVP. In a production system, minimums/fees should be tracked in the DB or via a pricing oracle.
    return ok({
      symbol: asset.symbol,
      networks: asset.networks,
      minimumWithdrawal: asset.symbol === "USDT" ? "10.00" : "0.01",
      withdrawalFee: asset.symbol === "USDT" ? "1.00" : "0.0005",
    });
  } catch (error) {
    return handleError(error);
  }
}
