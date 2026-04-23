import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";

import { getCryptoRates } from "@/lib/rates";
const MOCK_USD_TO_NGN = 1600; // 1 USD = 1600 NGN

/**
 * @swagger
 * /api/sell/quote:
 *   post:
 *     summary: Get Instant Sell Quote
 *     description: Get fiat (NGN) value estimate for selling crypto.
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
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { symbol, amount } = await req.json();

    if (!symbol || !amount) {
      return err("symbol and amount are required", 400);
    }

    const rates = await getCryptoRates([symbol.toUpperCase()]);
    const rateUsd = rates[symbol.toUpperCase()] || 0;
    if (rateUsd === 0) return err("Unsupported asset", 400);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return err("Invalid amount", 400);

    const usdValue = numAmount * rateUsd;
    const fiatValue = usdValue * MOCK_USD_TO_NGN;
    
    // 1% sell fee
    const feeFiat = fiatValue * 0.01;
    const payoutFiat = fiatValue - feeFiat;

    return ok({
      quote: {
        symbol: symbol.toUpperCase(),
        amount: numAmount.toString(),
        fiatCurrency: "NGN",
        exchangeRate: (rateUsd * MOCK_USD_TO_NGN).toString(),
        estimatedPayout: payoutFiat.toFixed(2),
        feeFiat: feeFiat.toFixed(2)
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
