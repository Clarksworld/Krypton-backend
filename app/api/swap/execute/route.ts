import { NextRequest } from "next/server";
import { db } from "@/db";
import { kycSubmissions, users } from "@/db/schema";
import { wallets, cryptoAssets } from "@/db/schema";
import { transactions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq, and, sql } from "drizzle-orm";

const MOCK_RATES: Record<string, number> = {
  "BTC": 65000,
  "ETH": 3500,
  "BNB": 580,
  "USDT": 1,
  "USDC": 1,
};

/**
 * @swagger
 * /api/swap/execute:
 *   post:
 *     summary: Execute Crypto Swap
 *     description: Instantly exchange one crypto asset for another at market rates.
 *     tags: [Swap]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromSymbol, toSymbol, amount]
 *             properties:
 *               fromSymbol: { type: string, example: "BNB" }
 *               toSymbol: { type: string, example: "USDT" }
 *               amount: { type: string, example: "1.5" }
 *     responses:
 *       200:
 *         description: Swap successful
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { fromSymbol, toSymbol, amount } = await req.json();

    const topAsset = fromSymbol.toUpperCase();
    const botAsset = toSymbol.toUpperCase();

    const fromRate = MOCK_RATES[topAsset] || 0;
    const toRate = MOCK_RATES[botAsset] || 0;
    if (fromRate === 0 || toRate === 0) return err("Unsupported trading pair", 400);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return err("Invalid amount", 400);

    // Get assets
    const fromAssetRow = await db.query.cryptoAssets.findFirst({ where: (c, { eq }) => eq(c.symbol, topAsset) });
    const toAssetRow = await db.query.cryptoAssets.findFirst({ where: (c, { eq }) => eq(c.symbol, botAsset) });
    if (!fromAssetRow || !toAssetRow) return err("Asset not found in database", 400);

    // Get from wallet
    const fromWallet = await db.query.wallets.findFirst({
      where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, fromAssetRow.id))
    });

    if (!fromWallet || parseFloat(fromWallet.balance || "0") < numAmount) {
      return err("Insufficient balance for swap", 400);
    }

    // Get to wallet (create if not exist)
    let toWallet = await db.query.wallets.findFirst({
      where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, toAssetRow.id))
    });

    if (!toWallet) {
      [toWallet] = await db.insert(wallets).values({
        userId, assetId: toAssetRow.id
      }).returning();
    }

    const usdValue = numAmount * fromRate;
    const estimatedOutput = usdValue / toRate;
    const feeUsd = usdValue * 0.001; 
    const finalOutput = estimatedOutput - (feeUsd / toRate);

    await db.transaction(async (tx) => {
      // Deduct from wallet
      await tx.update(wallets)
        .set({ balance: sql`${wallets.balance} - ${numAmount}` })
        .where(eq(wallets.id, fromWallet.id));
      
      // Add to toWallet
      await tx.update(wallets)
        .set({ balance: sql`${wallets.balance} + ${finalOutput}` })
        .where(eq(wallets.id, toWallet!.id));
        
      // Record transaction
      await tx.insert(transactions).values({
        userId,
        assetId: fromAssetRow.id,
        type: "swap",
        amount: numAmount.toString(),
        status: "completed",
        metadata: {
          toAssetSymbol: botAsset,
          toAmount: finalOutput.toString(),
          exchangeRate: (fromRate / toRate).toFixed(6),
          feeUsd: feeUsd.toFixed(2)
        }
      });
    });

    return ok({ message: "Swap executed successfully", acquired: finalOutput.toFixed(6) });
  } catch (error) {
    return handleError(error);
  }
}
