import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { users, transactions, wallets } from "@/db/schema";
import { count, sum, eq } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/overview:
 *   get:
 *     summary: Admin — Platform Overview
 *     description: Get high-level platform statistics (total users, trade volume, fees collected).
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Admin access required
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req); // Admin auth check

    const [totalUsers] = await db.select({ total: count() }).from(users);

    const [completedTxs] = await db
      .select({ total: count(), volume: sum(transactions.amount) })
      .from(transactions)
      .where(eq(transactions.status, "completed"));

    const [feeTotal] = await db
      .select({ total: sum(transactions.fee) })
      .from(transactions)
      .where(eq(transactions.status, "completed"));

    const [pendingTxs] = await db
      .select({ total: count() })
      .from(transactions)
      .where(eq(transactions.status, "pending"));

    return ok({
      overview: {
        totalUsers: totalUsers.total,
        completedTransactions: completedTxs.total,
        tradeVolume: completedTxs.volume || "0",
        feesCollected: feeTotal.total || "0",
        pendingTransactions: pendingTxs.total,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
