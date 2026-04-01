import { NextRequest } from "next/server";
import { db } from "@/db";
import { p2pTrades, transactions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { z } from "zod";

const tradeSchema = z.object({
  cryptoAmount: z.number().positive(),
});

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

    // Create trade in transaction
    const trade = await db.transaction(async (tx) => {
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
