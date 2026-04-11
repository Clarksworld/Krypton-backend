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
 *       No authentication required. Use this to populate deposit/withdraw
 *       token selectors on the frontend.
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

    return ok({ tokens });
  } catch (error) {
    return handleError(error);
  }
}
