import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, cryptoAssets, bankAccounts, transactions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq, and, sql } from "drizzle-orm";

import { getCryptoRates } from "@/lib/rates";
const MOCK_USD_TO_NGN = 1600;

/**
 * @swagger
 * /api/sell/execute:
 *   post:
 *     summary: Execute Instant Sell
 *     description: Sell crypto instantly for fiat payout to default bank account.
 *     tags: [Swap]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symbol, amount]
 *             properties:
 *               symbol: { type: string, example: "USDT" }
 *               amount: { type: string, example: "50" }
 *     responses:
 *       200:
 *         description: Sell successful, fiat payout queued
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { symbol, amount } = await req.json();

    const topAsset = symbol.toUpperCase();
    const rates = await getCryptoRates([topAsset]);
    const rateUsd = rates[topAsset] || 0;
    if (rateUsd === 0) return err("Unsupported asset", 400);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return err("Invalid amount", 400);

    const assetRow = await db.query.cryptoAssets.findFirst({ where: (c, { eq }) => eq(c.symbol, topAsset) });
    if (!assetRow) return err("Asset not found", 400);

    const wallet = await db.query.wallets.findFirst({
      where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, assetRow.id))
    });

    if (!wallet || parseFloat(wallet.balance || "0") < numAmount) {
      return err("Insufficient balance", 400);
    }

    const defaultBank = await db.query.bankAccounts.findFirst({
      where: (b, { eq, and }) => and(eq(b.userId, userId), eq(b.isDefault, true))
    });

    if (!defaultBank) {
      return err("No default bank account linked for fiat payout", 400);
    }

    const usdValue = numAmount * rateUsd;
    const fiatValue = usdValue * MOCK_USD_TO_NGN;
    const feeFiat = fiatValue * 0.01;
    const payoutFiat = fiatValue - feeFiat;

    await db.transaction(async (tx) => {
      // Deduct from wallet
      await tx.update(wallets)
        .set({ balance: sql`${wallets.balance} - ${numAmount}` })
        .where(eq(wallets.id, wallet.id));
        
      // Record transaction (Processing status means backend ledger will pay them)
      await tx.insert(transactions).values({
        userId,
        assetId: assetRow.id,
        type: "sell",
        amount: numAmount.toString(),
        fiatAmount: payoutFiat.toFixed(2),
        fiatCurrency: "NGN",
        status: "processing", // In a real app, a cron or webhook completes this
        metadata: {
          bankId: defaultBank.id,
          bankName: defaultBank.bankName,
          accountNumber: defaultBank.accountNumber,
          feeFiat: feeFiat.toFixed(2),
          exchangeRate: rateUsd * MOCK_USD_TO_NGN
        }
      });
    });

    return ok({ message: "Sell order processing", payoutFiat: payoutFiat.toFixed(2) });
  } catch (error) {
    return handleError(error);
  }
}
