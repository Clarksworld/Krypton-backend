import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pTrades, p2pOffers, transactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * @swagger
 * /api/p2p/trades/{id}/confirm-payment:
 *   post:
 *     summary: Confirm Payment Sent (Buyer)
 *     description: Mark a trade as 'payment_sent'. This must be called by the buyer.
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
 *         description: Payment confirmed
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { eq }) => eq(t.id, tradeId),
      with: { offer: true },
    });

    if (!trade) {
      return err("Trade not found", 404);
    }

    if (trade.status !== "pending") {
      return err(`Cannot confirm payment for trade in status: ${trade.status}`, 400);
    }

    // Determine who the buyer is
    // If offer is "sell", the taker (userId) is the buyer
    // If offer is "buy", the maker is the buyer
    const isBuyer =
      (trade.offer.type === "sell" && trade.takerId === userId) ||
      (trade.offer.type === "buy" && trade.makerId === userId);

    if (!isBuyer) {
      return err("Only the buyer can confirm payment", 403);
    }

    const [updated] = await db
      .update(p2pTrades)
      .set({
        status: "payment_sent",
        paymentSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(p2pTrades.id, tradeId))
      .returning();

    // Update transaction status linked to this trade
    await db
      .update(transactions)
      .set({ status: "processing" })
      .where(eq(transactions.reference, `TRADE-${tradeId.split("-")[0].toUpperCase()}`));

    return ok({ trade: updated, message: "Payment confirmed as sent. Waiting for seller to release crypto." });
  } catch (error) {
    return handleError(error);
  }
}
