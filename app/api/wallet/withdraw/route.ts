import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { err, handleError } from "@/lib/errors";
import { wallets, transactions, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { isValidEVMAddress } from "@/lib/blockchain/evm";
import { verifySync } from "otplib";

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     summary: Request a withdrawal
 *     description: Initiate an external crypto withdrawal from your user account. 2FA must be enabled and verified.
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symbol, amount, address]
 *             properties:
 *               symbol: { type: string, example: USDT }
 *               amount: { type: string, example: "50" }
 *               address: { type: string, example: "0x..." }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       202:
 *         description: Withdrawal accepted and pending
 *       403:
 *         description: 2FA required
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { symbol, amount, address, network, otp } = body;

    if (!symbol || !amount || !address) {
      return err("Symbol, amount, and address are required", 400);
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      return err("User not found", 404);
    }

    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      return err("Please enable 2FA in your account settings before withdrawing funds.", 403);
    }

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    let needsOtp = true;

    if (user.last2faVerifiedAt) {
      const timeSinceLast2FA = Date.now() - new Date(user.last2faVerifiedAt).getTime();
      if (timeSinceLast2FA < TWENTY_FOUR_HOURS_MS) {
        needsOtp = false;
      }
    }

    if (needsOtp) {
      if (!otp) {
        return NextResponse.json(
          { requires2fa: true, success: false, message: "2FA code required. Please provide your Google Authenticator code." },
          { status: 403 }
        );
      }

      const result = verifySync({
        token: otp,
        secret: user.twoFactorSecret,
      });

      if (!result.valid) {
        return err("Invalid or expired 2FA code", 400);
      }

      // Automatically extend their 24-hour grace window upon success
      await db.update(users).set({ last2faVerifiedAt: new Date() }).where(eq(users.id, userId));
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      return err("Amount must be greater than zero", 400);
    }

    const isUSDT = symbol.toUpperCase() === "USDT";
    const minWithdrawal = isUSDT ? 10.0 : 0.01;
    if (val < minWithdrawal) {
      return err(`Minimum withdrawal is ${minWithdrawal} ${symbol.toUpperCase()}`, 400);
    }

    const fee = isUSDT ? 1.0 : 0.0005;
    const totalDeduction = val + fee;

    if (!isValidEVMAddress(address)) {
      return err("Invalid destination EVM address", 400);
    }

    const asset = await db.query.cryptoAssets.findFirst({
      where: (ca, { eq }) => eq(ca.symbol, symbol.toUpperCase()),
      columns: { id: true, isActive: true },
    });

    if (!asset || !asset.isActive) {
      return err("Asset not supported", 400);
    }

    await db.transaction(async (tx) => {
      const userWallet = await tx.query.wallets.findFirst({
        where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, asset.id)),
      });

      if (!userWallet) {
        throw new Error("No wallet found for this asset");
      }

      // Move funds to frozen balance
      const updateRes = await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${totalDeduction.toFixed(8)}`,
          frozenBalance: sql`${wallets.frozenBalance} + ${totalDeduction.toFixed(8)}`,
        })
        .where(
          and(
            eq(wallets.id, userWallet.id),
            sql`${wallets.balance} >= ${totalDeduction.toFixed(8)}`
          )
        )
        .returning({ id: wallets.id });

      if (updateRes.length === 0) {
        throw new Error("Insufficient balance to cover withdrawal plus fees");
      }

      const requestRef = `withdraw_${Date.now()}_req`;

      await tx.insert(transactions).values({
        userId,
        assetId: asset.id,
        type: "withdrawal",
        amount: val.toFixed(8),
        fee: fee.toFixed(8),
        status: "pending", // Queued for the worker
        reference: requestRef,
        metadata: {
          to: address,
          network: network || "BEP20",
          requestedAt: new Date().toISOString(),
          isExternal: true,
        },
      });
    });

    return NextResponse.json(
      { success: true, message: "Withdrawal request accepted and is pending processing." },
      { status: 202 }
    );
  } catch (error: any) {
    if (
      error.message.includes("Insufficient balance") ||
      error.message.includes("No wallet found")
    ) {
      return err(error.message, 400);
    }
    return handleError(error);
  }
}
