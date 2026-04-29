import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pTrades } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

/**
 * @swagger
 * /api/p2p/trades/{id}:
 *   get:
 *     summary: Get P2P Trade Details
 *     description: Retrieve all details of a specific trade including maker/taker information, payment info, and chat messages.
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
 *         description: Success
 *   patch:
 *     summary: Update Trade Status (Transitions)
 *     description: Perform state transitions like mark-paid, cancel, or release.
 *     tags: [P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, enum: [mark-paid, cancel, release] }
 *     responses:
 *       200:
 *         description: Action performed successfully
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { and, or, eq }) =>
        and(eq(t.id, tradeId), or(eq(t.makerId, userId), eq(t.takerId, userId))),
      with: {
        offer: true,
        asset: true,
        maker: { with: { profile: true } },
        taker: { with: { profile: true } },
        messages: {
          orderBy: (m, { asc }) => [asc(m.createdAt)],
          with: {
            sender: { columns: { id: true, username: true } }
          }
        }
      },
    });

    if (!trade) {
      return err("Trade not found or unauthorized access", 404);
    }

    return ok({ trade });
  } catch (error) {
    return handleError(error);
  }
}

import { triggerTradeUpdate } from "@/lib/pusher";
import { unlockEscrow, releaseEscrow } from "@/lib/p2p-escrow";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;
    const { action } = await req.json();

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { eq }) => eq(t.id, tradeId),
      with: { offer: true },
    });

    if (!trade) return err("Trade not found", 404);

    const isMakerSeller = trade.offer.type === "sell";
    const sellerId = isMakerSeller ? trade.makerId : trade.takerId;
    const buyerId = isMakerSeller ? trade.takerId : trade.makerId;

    switch (action) {
      case "mark-paid":
        if (userId !== buyerId) return err("Only buyer can mark as paid", 403);
        if (trade.status !== "pending") return err("Invalid trade status", 400);

        await db.update(p2pTrades)
          .set({ status: "payment_sent", paymentSentAt: new Date(), updatedAt: new Date() })
          .where(eq(p2pTrades.id, tradeId));
        break;

      case "release":
        if (userId !== sellerId) return err("Only seller can release escrow", 403);
        // We allow release if payment is sent or confirmed
        if (trade.status !== "payment_sent" && trade.status !== "payment_confirmed") {
          return err("Payment not marked as sent", 400);
        }

        await releaseEscrow(tradeId, sellerId, buyerId, trade.assetId, trade.cryptoAmount);
        break;

      case "cancel":
        if (trade.status !== "pending") return err("Cannot cancel trade in current status", 400);
        
        // If buyer cancels, return funds to seller if locked
        if (userId === buyerId) {
          if (trade.escrowLocked) {
            await unlockEscrow(tradeId, sellerId, trade.assetId, trade.cryptoAmount);
          }
          await db.update(p2pTrades).set({ status: "cancelled", updatedAt: new Date() }).where(eq(p2pTrades.id, tradeId));
        } else {
          return err("Only buyer can cancel at this stage. Sellers must wait for timeout or dispute.", 403);
        }
        break;

      default:
        return err("Invalid action", 400);
    }

    // Fetch updated trade for broadcast
    const updatedTrade = await db.query.p2pTrades.findFirst({
      where: eq(p2pTrades.id, tradeId),
      with: { offer: true, asset: true }
    });

    await triggerTradeUpdate(tradeId, "status-updated", {
      status: updatedTrade?.status,
      updatedAt: updatedTrade?.updatedAt,
      trade: updatedTrade
    });

    return ok({ success: true, trade: updatedTrade });
  } catch (error) {
    return handleError(error);
  }
}
