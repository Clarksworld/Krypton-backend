import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pTrades, wallets, transactions, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifySync } from "otplib";
import { triggerTradeUpdate } from "@/lib/pusher";

/**
 * @swagger
 * /api/p2p/trades/{id}/release:
 *   post:
 *     summary: Release Crypto (Seller)
 *     description: Confirm payment receipt and release escrowed crypto to the buyer. Requires 2FA if enabled.
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               otp: { type: string, description: "6-digit 2FA code" }
 *     responses:
 *       200:
 *         description: Crypto released successfully
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;
    const body = await req.json();
    const { otp } = body;

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { eq }) => eq(t.id, tradeId),
      with: { offer: true },
    });

    if (!trade) return err("Trade not found", 404);

    if (trade.status !== "payment_sent" && trade.status !== "payment_confirmed") {
      return err(`Cannot release crypto for trade in status: ${trade.status}`, 400);
    }

    // Determine who the seller is
    const isSeller =
      (trade.offer.type === "sell" && trade.makerId === userId) ||
      (trade.offer.type === "buy" && trade.takerId === userId);

    if (!isSeller) {
      return err("Only the seller can release crypto", 403);
    }

    const buyerId = trade.offer.type === "sell" ? trade.takerId : trade.makerId;

    // Check 2FA
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (user?.isTwoFactorEnabled) {
      if (!otp) return err("2FA OTP code required to release crypto", 401);
      const isValid = verifySync({ token: otp, secret: user.twoFactorSecret! });
      if (!isValid.valid) return err("Invalid 2FA code", 401);
    }

    // Execute release in transaction
    await db.transaction(async (tx) => {
      // 1. Deduct from Seller's frozenBalance
      await tx
        .update(wallets)
        .set({
          frozenBalance: sql`${wallets.frozenBalance} - ${trade.cryptoAmount}`,
          updatedAt: new Date(),
        })
        .where(and(eq(wallets.userId, userId), eq(wallets.assetId, trade.assetId)));

      // 2. Add to Buyer's balance (lazy create wallet if needed)
      const buyerWallet = await tx.query.wallets.findFirst({
        where: (w, { eq, and }) => and(eq(w.userId, buyerId), eq(w.assetId, trade.assetId)),
      });

      if (buyerWallet) {
        await tx
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${trade.cryptoAmount}`, updatedAt: new Date() })
          .where(eq(wallets.id, buyerWallet.id));
      } else {
        await tx.insert(wallets).values({
          userId: buyerId,
          assetId: trade.assetId,
          balance: trade.cryptoAmount,
        });
      }

      // 3. Update Trade Status
      await tx
        .update(p2pTrades)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(p2pTrades.id, tradeId));

      // 4. Update Transaction Status (Taker view)
      await tx
        .update(transactions)
        .set({ status: "completed" })
        .where(eq(transactions.reference, `TRADE-${tradeId.split("-")[0].toUpperCase()}`));
        
      // 5. Create a transaction record for the Maker too if they are the seller/buyer
      // (This is skipped here for simplicity as we usually show takers their order history, 
      // but in a real app both sides get a ledger entry).
    });

    await triggerTradeUpdate(tradeId, "status-updated", {
      status: "completed",
      tradeId
    });

    return ok({ message: "Crypto released successfully. Trade completed." });
  } catch (error) {
    return handleError(error);
  }
}
