import { NextRequest } from "next/server";
import { db } from "@/db";
import { p2pTrades, transactions, wallets, p2pOffers } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";

const tradeSchema = z.object({
  cryptoAmount: z.number().positive(),
});

/**
 * @swagger
 * /api/p2p/offers/{id}/trade:
 *   post:
 *     summary: Initiate P2P Trade
 *     description: Initiate a P2P trade on an offer.
 *     tags: [P2P]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cryptoAmount]
 *             properties:
 *               cryptoAmount: { type: number }
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserId(req);
    const { id: offerId } = await params;
    const body = await req.json();
    const { cryptoAmount } = validate(tradeSchema, body);

    // Fetch offer
    const offer = await db.query.p2pOffers.findFirst({
      where: (o, { eq }) => eq(o.id, offerId),
    });

    if (!offer || !offer.isActive) {
      throw new ApiError("Offer not available", 404);
    }

    if (userId === offer.makerId) {
      throw new ApiError("You cannot trade with your own offer", 400);
    }

    // Calculate fiat amount
    const price = parseFloat(offer.pricePerUnit);
    const fiatAmount = cryptoAmount * price;

    // Check limits
    const min = parseFloat(offer.minOrderFiat);
    const max = parseFloat(offer.maxOrderFiat);
    if (fiatAmount < min || fiatAmount > max) {
      throw new ApiError(`Amount out of bounds (Min: ${min}, Max: ${max})`, 400);
    }

    // Verify seller's crypto balance before starting trade
    // If offer is SELL: Maker is selling crypto.
    // If offer is BUY: Taker is selling crypto.
    const sellerId = offer.type === "sell" ? offer.makerId : userId;
    const sellerWallet = await db.query.wallets.findFirst({
      where: (w, { eq, and }) =>
        and(eq(w.userId, sellerId), eq(w.assetId, offer.assetId)),
    });

    if (!sellerWallet || parseFloat(sellerWallet.balance || "0") < cryptoAmount) {
      throw new ApiError("Seller has insufficient balance to cover this trade amount", 400);
    }

    // Create trade in transaction
    const trade = await db.transaction(async (tx) => {
        
      // ── ESCROW: Move crypto from balance to frozenBalance ──────────
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${cryptoAmount}`,
          frozenBalance: sql`${wallets.frozenBalance} + ${cryptoAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, sellerWallet.id));

      const [newTrade] = await tx
        .insert(p2pTrades)
        .values({
          offerId: offer.id,
          makerId: offer.makerId,
          takerId: userId,
          assetId: offer.assetId,
          cryptoAmount: cryptoAmount.toString(),
          fiatAmount: fiatAmount.toString(),
          pricePerUnit: offer.pricePerUnit,
          status: "pending",
          expiresAt: new Date(Date.now() + (offer.paymentWindow ?? 15) * 60000),
        })
        .returning();

      // Create a pending transaction entry for history
      await tx.insert(transactions).values({
        userId,
        type: offer.type === "sell" ? "p2p_buy" : "p2p_sell", // Taker view
        assetId: offer.assetId,
        amount: cryptoAmount.toString(),
        fiatAmount: fiatAmount.toString(),
        status: "pending",
        reference: `TRADE-${newTrade.id.split("-")[0].toUpperCase()}`,
      });

      return newTrade;
    });

    return ok({ trade }, 201);
  } catch (err) {
    return handleError(err);
  }
}
