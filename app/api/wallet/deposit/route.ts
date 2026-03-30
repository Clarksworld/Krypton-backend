import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, cryptoAssets, transactions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";

const depositSchema = z.object({
  assetSymbol: z.string().min(1),
  amount: z.string().transform((val) => parseFloat(val)),
});

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { assetSymbol, amount } = validate(depositSchema, body);

    if (amount <= 0) {
      throw new ApiError("Amount must be greater than zero", 400);
    }

    // 1. Find asset
    const asset = await db.query.cryptoAssets.findFirst({
      where: (ca, { eq }) => eq(ca.symbol, assetSymbol.toUpperCase()),
    });

    if (!asset) {
      throw new ApiError("Asset not supported", 400);
    }

    // 2. Perform deposit in a transaction
    await db.transaction(async (tx) => {
      // Find or create wallet
      const wallet = await tx.query.wallets.findFirst({
        where: (w, { and, eq }) => and(eq(w.userId, userId), eq(w.assetId, asset.id)),
      });

      if (!wallet) {
        throw new ApiError("Wallet not initialized for this asset", 400);
      }

      // Update balance
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // Record transaction
      await tx.insert(transactions).values({
        userId,
        assetId: asset.id,
        type: "deposit",
        amount: amount.toString(),
        status: "completed",
        reference: `test_dep_${randomUUID().slice(0, 8)}`,
      });
    });

    return ok({ message: `Successfully deposited ${amount} ${assetSymbol}` });
  } catch (err) {
    return handleError(err);
  }
}
