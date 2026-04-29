import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pTrades, wallets, transactions } from "@/db/schema";
import { eq, and, sql, or } from "drizzle-orm";
import { triggerTradeUpdate } from "@/lib/pusher";

/**
 * @swagger
 * /api/p2p/trades/{id}/cancel:
 *   post:
 *     summary: Cancel P2P Trade
 *     description: Cancel a pending trade. Released escrowed funds back to the seller.
 *     tags: [P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The trade ID
 *     responses:
 *       200:
 *         description: Trade cancelled successfully
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { and, or, eq }) => 
        and(eq(t.id, tradeId), or(eq(t.makerId, userId), eq(t.takerId, userId))),
      with: { offer: true },
    });

    if (!trade) return err("Trade not found or unauthorized", 404);

    if (trade.status !== "pending") {
      return err(`Cannot cancel trade in status: ${trade.status}`, 400);
    }

    // Determine seller
    const sellerId = trade.offer.type === "sell" ? trade.makerId : trade.takerId;

    await db.transaction(async (tx) => {
      // 1. Release Escrow: Move from seller's frozenBalance to balance
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
        .where(eq(p2pTrades.id, tradeId));

      // 3. Update transactions
      await tx
        .update(transactions)
        .set({ status: "failed" })
        .where(eq(transactions.reference, `TRADE-${tradeId.split("-")[0].toUpperCase()}`));
    });

    await triggerTradeUpdate(tradeId, "status-updated", {
      status: "cancelled",
      tradeId
    });

    return ok({ message: "Trade cancelled. Escrowed funds returned to seller." });
  } catch (error) {
    return handleError(error);
  }
}
