import { db } from "@/db";
import { wallets } from "@/db/schema/wallets";
import { p2pTrades } from "@/db/schema/p2p";
import { eq, and, sql } from "drizzle-orm";

/**
 * Locks the crypto amount from the seller's balance into their frozen balance.
 */
export async function lockEscrow(tradeId: string, sellerId: string, assetId: string, amount: string) {
  return await db.transaction(async (tx) => {
    // Check if trade is already locked
    const [trade] = await tx
      .select()
      .from(p2pTrades)
      .where(eq(p2pTrades.id, tradeId))
      .limit(1);

    if (!trade) throw new Error("Trade not found");
    if (trade.escrowLocked) throw new Error("Escrow already locked");

    // Atomic update: subtract from balance, add to frozenBalance
    const result = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${amount}`,
        frozenBalance: sql`${wallets.frozenBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wallets.userId, sellerId),
          eq(wallets.assetId, assetId),
          sql`${wallets.balance} >= ${amount}`
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error("Insufficient balance for escrow");
    }

    // Mark trade as locked
    await tx
      .update(p2pTrades)
      .set({ escrowLocked: true, updatedAt: new Date() })
      .where(eq(p2pTrades.id, tradeId));

    return result[0];
  });
}

/**
 * Unlocks the crypto amount back to the seller's balance (e.g. on cancellation).
 */
export async function unlockEscrow(tradeId: string, sellerId: string, assetId: string, amount: string) {
  return await db.transaction(async (tx) => {
    const [trade] = await tx
      .select()
      .from(p2pTrades)
      .where(eq(p2pTrades.id, tradeId))
      .limit(1);

    if (!trade) throw new Error("Trade not found");
    if (!trade.escrowLocked || trade.escrowReleased) throw new Error("Invalid escrow state for unlocking");

    // Atomic update: subtract from frozenBalance, add back to balance
    const result = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amount}`,
        frozenBalance: sql`${wallets.frozenBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wallets.userId, sellerId),
          eq(wallets.assetId, assetId),
          sql`${wallets.frozenBalance} >= ${amount}`
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to unlock escrow: insufficient frozen balance");
    }

    // Mark trade as unlocked
    await tx
      .update(p2pTrades)
      .set({ escrowLocked: false, updatedAt: new Date() })
      .where(eq(p2pTrades.id, tradeId));

    return result[0];
  });
}

/**
 * Releases the frozen crypto from the seller and adds it to the buyer's balance.
 */
export async function releaseEscrow(tradeId: string, sellerId: string, buyerId: string, assetId: string, amount: string) {
  return await db.transaction(async (tx) => {
    const [trade] = await tx
      .select()
      .from(p2pTrades)
      .where(eq(p2pTrades.id, tradeId))
      .limit(1);

    if (!trade) throw new Error("Trade not found");
    if (!trade.escrowLocked || trade.escrowReleased) throw new Error("Invalid escrow state for release");

    // 1. Remove from seller's frozen balance
    const sellerResult = await tx
      .update(wallets)
      .set({
        frozenBalance: sql`${wallets.frozenBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wallets.userId, sellerId),
          eq(wallets.assetId, assetId),
          sql`${wallets.frozenBalance} >= ${amount}`
        )
      )
      .returning();

    if (sellerResult.length === 0) {
      throw new Error("Failed to release escrow: insufficient frozen balance");
    }

    // 2. Add to buyer's balance (Upsert wallet if not exists)
    // First try update
    const buyerUpdate = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wallets.userId, buyerId),
          eq(wallets.assetId, assetId)
        )
      )
      .returning();

    if (buyerUpdate.length === 0) {
      // Create wallet if it doesn't exist
      await tx.insert(wallets).values({
        userId: buyerId,
        assetId: assetId,
        balance: amount,
      });
    }

    // 3. Mark trade as released and completed
    await tx
      .update(p2pTrades)
      .set({ 
        escrowReleased: true, 
        status: "completed", 
        completedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(p2pTrades.id, tradeId));

    return true;
  });
}
