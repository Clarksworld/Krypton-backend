import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, cryptoAssets, userSubscriptions, subscriptionPlans, transactions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq, and, sql } from "drizzle-orm";

/**
 * @swagger
 * /api/subscription/upgrade:
 *   post:
 *     summary: Upgrade Subscription
 *     description: Purchase a premium subscription plan paying with USDT from your wallet.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId: { type: string, example: "plan-uuid-here" }
 *     responses:
 *       200:
 *         description: Subscription upgraded successfully
 *       400:
 *         description: Insufficient USDT balance or invalid plan
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { planId } = await req.json();

    if (!planId) return err("planId is required", 400);

    const plan = await db.query.subscriptionPlans.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, planId), eq(p.isActive, true)),
    });

    if (!plan) return err("Plan not found or no longer available", 404);

    // Deduct from USDT wallet
    const usdtAsset = await db.query.cryptoAssets.findFirst({
      where: (c, { eq }) => eq(c.symbol, "USDT"),
    });

    if (!usdtAsset) return err("USDT asset not configured", 500);

    const usdtWallet = await db.query.wallets.findFirst({
      where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, usdtAsset.id)),
    });

    const price = parseFloat(plan.priceUsdt);
    const balance = parseFloat(usdtWallet?.balance || "0");

    if (balance < price) {
      return err(`Insufficient USDT balance. Required: ${price} USDT`, 400);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + parseFloat(plan.durationDays as string) * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      // Deduct USDT
      await tx.update(wallets)
        .set({ balance: sql`${wallets.balance} - ${price}` })
        .where(eq(wallets.id, usdtWallet!.id));

      // Expire any current active subscription
      await tx.update(userSubscriptions)
        .set({ status: "expired" })
        .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, "active")));

      // Insert new subscription
      await tx.insert(userSubscriptions).values({
        userId,
        planId: plan.id,
        status: "active",
        startedAt: now,
        expiresAt,
      });

      // Record payment transaction
      await tx.insert(transactions).values({
        userId,
        assetId: usdtAsset.id,
        type: "subscription_payment",
        amount: price.toString(),
        status: "completed",
        metadata: { planId: plan.id, planName: plan.name, expiresAt: expiresAt.toISOString() },
      });
    });

    return ok({ message: `Successfully upgraded to ${plan.name}`, expiresAt });
  } catch (error) {
    return handleError(error);
  }
}
