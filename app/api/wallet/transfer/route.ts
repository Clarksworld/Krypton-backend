import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { wallets, transactions, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifySync } from "otplib";

/**
 * @swagger
 * /api/wallet/transfer:
 *   post:
 *     summary: Internal transfer to another user
 *     description: Transfer crypto assets instantly to another Krypton user by their username. 2FA required.
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symbol, amount, username]
 *             properties:
 *               symbol: { type: string, example: USDT }
 *               amount: { type: string, example: "10.5" }
 *               username: { type: string, example: "cryptoking" }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Transfer successful
 *       403:
 *         description: 2FA required or not enabled
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { symbol, amount, username } = body;

    if (!symbol || !amount || !username) {
      return err("Symbol, amount, and username are required", 400);
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      return err("Amount must be greater than zero", 400);
    }

    // 1. Get asset
    const asset = await db.query.cryptoAssets.findFirst({
      where: (ca, { eq }) => eq(ca.symbol, symbol.toUpperCase()),
      columns: { id: true, isActive: true },
    });
    if (!asset || !asset.isActive) {
      return err("Asset not supported", 400);
    }

    // 2. Get receiver user
    const receiver = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.username, username),
      columns: { id: true, username: true },
    });
    if (!receiver) {
      return err("Receiver not found", 404);
    }
    if (receiver.id === userId) {
      return err("Cannot transfer to yourself", 400);
    }

    // 3. Get sender
    const sender = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });
    if (!sender) {
      return err("Sender not found", 404);
    }
    
    // 2FA Verification Logic
    if (!sender.isTwoFactorEnabled || !sender.twoFactorSecret) {
      return err("Please enable 2FA in your account settings before making internal transfers.", 403);
    }

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    let needsOtp = true;

    if (sender.last2faVerifiedAt) {
      const timeSinceLast2FA = Date.now() - new Date(sender.last2faVerifiedAt).getTime();
      if (timeSinceLast2FA < TWENTY_FOUR_HOURS_MS) {
        needsOtp = false;
      }
    }

    if (needsOtp) {
      const { otp } = body;
      if (!otp) {
        return NextResponse.json(
          { requires2fa: true, success: false, message: "2FA code required. Please provide your Google Authenticator code." },
          { status: 403 }
        );
      }

      const result = verifySync({
        token: otp,
        secret: sender.twoFactorSecret,
      });

      if (!result.valid) {
        return err("Invalid or expired 2FA code", 400);
      }

      await db.update(users).set({ last2faVerifiedAt: new Date() }).where(eq(users.id, userId));
    }

    // 4. Do the transfer in a transaction
    await db.transaction(async (tx) => {
      const senderWallet = await tx.query.wallets.findFirst({
        where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, asset.id)),
      });
      
      if (!senderWallet) {
        throw new Error("Sender has no wallet for this asset");
      }

      let receiverWallet = await tx.query.wallets.findFirst({
        where: (w, { eq, and }) => and(eq(w.userId, receiver.id), eq(w.assetId, asset.id)),
      });
      
      if (!receiverWallet) {
        const [newWallet] = await tx.insert(wallets).values({
          userId: receiver.id,
          assetId: asset.id,
          balance: "0",
        }).returning();
        receiverWallet = newWallet;
      }

      // Deduct from sender (optimistic locking)
      const updateSenderRes = await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${val.toFixed(8)}` })
        .where(
          and(
            eq(wallets.id, senderWallet.id),
            sql`${wallets.balance} >= ${val.toFixed(8)}`
          )
        )
        .returning({ id: wallets.id });

      if (updateSenderRes.length === 0) {
        throw new Error("Insufficient balance");
      }

      // Add to receiver
      await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${val.toFixed(8)}` })
        .where(eq(wallets.id, receiverWallet.id));

      const txHashSender = `internal_${Date.now()}_out`;
      const txHashReceiver = `internal_${Date.now()}_in`;

      // Create transaction record for sender
      await tx.insert(transactions).values({
        userId,
        assetId: asset.id,
        type: "internal_transfer", // requested by user
        amount: val.toFixed(8),
        status: "completed",
        reference: txHashSender,
        metadata: {
          direction: "outbound",
          to: receiver.username,
        },
      });

      // Create transaction record for receiver
      await tx.insert(transactions).values({
        userId: receiver.id,
        assetId: asset.id,
        type: "internal_transfer",
        amount: val.toFixed(8),
        status: "completed",
        reference: txHashReceiver,
        metadata: {
          direction: "inbound",
          from: sender.username,
        },
      });
    });

    return ok({ message: "Transfer successful" });
  } catch (error: any) {
    if (error.message === "Insufficient balance" || error.message === "Sender has no wallet for this asset") {
      return err(error.message, 400); // Bad request, not server error
    }
    return handleError(error);
  }
}
