import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";

const MOCK_RATES: Record<string, number> = {
  "BTC": 65000,
  "ETH": 3500,
  "BNB": 580,
  "USDT": 1,
  "USDC": 1,
};

/**
 * @swagger
 * /api/swap/quote:
 *   post:
 *     summary: Get Swap Quote
 *     description: Get current exchange rate and estimated output for a crypto-to-crypto swap.
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
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { fromSymbol, toSymbol, amount } = await req.json();

    if (!fromSymbol || !toSymbol || !amount) {
      return err("fromSymbol, toSymbol, and amount are required", 400);
    }

    const fromRate = MOCK_RATES[fromSymbol.toUpperCase()] || 0;
    const toRate = MOCK_RATES[toSymbol.toUpperCase()] || 0;

    if (fromRate === 0 || toRate === 0) {
      return err("Unsupported trading pair", 400);
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return err("Invalid amount", 400);
    }

    // Calculate value in USD
    const usdValue = numAmount * fromRate;
    // Calculate output amount
    const estimatedOutput = usdValue / toRate;
    
    // 0.1% swap fee mock
    const feeUsd = usdValue * 0.001; 
    const finalOutput = estimatedOutput - (feeUsd / toRate);

    // Swap Rate
    const exchangeRate = fromRate / toRate;

    return ok({
      quote: {
        fromSymbol: fromSymbol.toUpperCase(),
        toSymbol: toSymbol.toUpperCase(),
        amount: numAmount.toString(),
        exchangeRate: exchangeRate.toFixed(6),
        estimatedOutput: finalOutput.toFixed(6),
        feeUsd: feeUsd.toFixed(2)
      }
    });

  } catch (error) {
    return handleError(error);
  }
}
