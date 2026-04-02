import { NextRequest } from "next/server";
import { db } from "@/db";
import { p2pTrades, wallets, transactions } from "@/db/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/workers/p2p-expiry:
 *   get:
 *     summary: Worker — P2P Trade Expiry
 *     description: Background worker to automatically cancel pending P2P trades that have exceeded their payment window.
 *     tags: [Worker]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    // In production, this would be protected by a secret header (like WEBHOOK_SECRET)
    const now = new Date();

    const expiredTrades = await db.query.p2pTrades.findMany({
      where: (t, { and, eq, lt }) => and(eq(t.status, "pending"), lt(t.expiresAt, now)),
      with: { offer: true },
    });

    if (expiredTrades.length === 0) {
      return ok({ message: "No expired trades to process." });
    }

    let processedCount = 0;

    for (const trade of expiredTrades) {
      try {
        await db.transaction(async (tx) => {
          // Determine seller
          const sellerId = trade.offer.type === "sell" ? trade.makerId : trade.takerId;

          // 1. Release Escrow: Move from seller's frozenBalance back to balance
          await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} + ${trade.cryptoAmount}`,
              frozenBalance: sql`${wallets.frozenBalance} - ${trade.cryptoAmount}`,
              updatedAt: new Date(),
            })
            .where(and(eq(wallets.userId, sellerId), eq(wallets.assetId, trade.assetId)));

          // 2. Update status
          await tx
            .update(p2pTrades)
            .set({
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(eq(p2pTrades.id, trade.id));

          // 3. Update transactions
          await tx
            .update(transactions)
            .set({ status: "failed" })
            .where(eq(transactions.reference, `TRADE-${trade.id.split("-")[0].toUpperCase()}`));
        });
        processedCount++;
      } catch (err) {
        console.error(`Failed to expire trade ${trade.id}:`, err);
      }
    }

    return ok({ message: `Processed ${processedCount} expired trades.`, totalFound: expiredTrades.length });
  } catch (error) {
    return handleError(error);
  }
}
