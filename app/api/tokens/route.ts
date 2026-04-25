import { NextRequest } from "next/server";
import { db } from "@/db";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/tokens:
 *   get:
 *     summary: List Supported Tokens
 *     description: >
 *       Returns all active crypto assets supported by the platform.
 *       If the user is authenticated (x-user-id header present), includes their balance for each token.
 *       Use this to populate deposit/withdraw token selectors with balance info.
 *     tags: [Tokens]
 *     responses:
 *       200:
 *         description: List of active tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       symbol: { type: string, example: USDT }
 *                       name: { type: string, example: Tether USD }
 *                       iconUrl: { type: string }
 *                       balance: { type: string, example: "125.50" }
 *                       networks:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name: { type: string }
 *                             addressRegex: { type: string }
 *                       createdAt: { type: string, format: date-time }
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");

    const tokens = await db.query.cryptoAssets.findMany({
      where: (asset, { eq }) => eq(asset.isActive, true),
      columns: {
        id: true,
        symbol: true,
        name: true,
        iconUrl: true,
        networks: true,
        createdAt: true,
      },
      orderBy: (asset, { asc }) => [asc(asset.symbol)],
    });

    let userBalances: Record<string, string> = {};

    if (userId) {
      const wallets = await db.query.wallets.findMany({
        where: (w, { eq }) => eq(w.userId, userId),
        columns: {
          assetId: true,
          balance: true,
        },
      });
      wallets.forEach((w) => {
        userBalances[w.assetId] = w.balance || "0";
      });
    }

    const tokensWithBalance = tokens.map((token) => ({
      ...token,
      balance: userBalances[token.id] || "0",
    }));

    return ok({ tokens: tokensWithBalance });
  } catch (error) {
    return handleError(error);
  }
}
