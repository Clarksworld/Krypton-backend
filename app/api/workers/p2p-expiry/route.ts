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
import { triggerTradeUpdate } from "@/lib/pusher";
import { unlockEscrow } from "@/lib/p2p-escrow";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.WORKER_SECRET}`) {
      return err("Unauthorized", 401);
    }

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
        const sellerId = trade.offer.type === "sell" ? trade.makerId : trade.takerId;

        // 1. Release Escrow back to seller if locked
        if (trade.escrowLocked) {
          await unlockEscrow(trade.id, sellerId, trade.assetId, trade.cryptoAmount);
        }

        // 2. Update status to cancelled
        await db.update(p2pTrades)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(p2pTrades.id, trade.id));

        // 3. Trigger Pusher notification
        await triggerTradeUpdate(trade.id, "status-updated", {
          status: "cancelled",
          reason: "expired"
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
