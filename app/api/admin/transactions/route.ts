import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { transactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/transactions:
 *   get:
 *     summary: Admin — All Transactions
 *     description: View all platform transactions with optional status filter.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

    const rows = await db.query.transactions.findMany({
      where: (t, { and, eq }) => {
        const conds = [];
        if (status) conds.push(eq(t.status, status));
        if (type) conds.push(eq(t.type, type));
        return conds.length ? and(...conds) : undefined;
      },
      with: { asset: { columns: { symbol: true } }, user: { columns: { email: true, username: true } } },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
    });

    return ok({ transactions: rows });
  } catch (error) {
    return handleError(error);
  }
}
