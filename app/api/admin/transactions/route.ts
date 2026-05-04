import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, and, or, ilike, gte, lte, sql } from "drizzle-orm";
import { transactions, users } from "@/db/schema";

/**
 * @swagger
 * /api/admin/transactions:
 *   get:
 *     summary: Admin — All Transactions
 *     description: View all platform transactions with pagination, filtering, and search.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, completed, failed] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    const { searchParams } = new URL(req.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "20")));
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const offset = (page - 1) * pageSize;

    const whereCond = (t: any, { and, eq, or, ilike, gte, lte }: any) => {
      const conds = [];
      if (status) conds.push(eq(t.status, status));
      if (type) conds.push(eq(t.type, type));
      
      if (search) {
        conds.push(
          or(
            ilike(t.reference, `%${search}%`),
            // Since we need to search in joined table, we'll handle this in a custom way if needed, 
            // but for simplicity in findMany we can't easily join-search in the where closure for relations.
            // However, Drizzle allows joining. Let's stick to reference search or use a more complex query.
          )
        );
      }

      if (startDate) conds.push(gte(t.createdAt, new Date(startDate)));
      if (endDate) conds.push(lte(t.createdAt, new Date(endDate)));

      return and(...conds);
    };

    // To handle search across users, we'll use a more explicit join query
    const query = db
      .select({
        transaction: transactions,
        user: {
          email: users.email,
          username: users.username,
        },
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(and(
        status ? eq(transactions.status, status) : undefined,
        type ? eq(transactions.type, type) : undefined,
        startDate ? gte(transactions.createdAt, new Date(startDate)) : undefined,
        endDate ? lte(transactions.createdAt, new Date(endDate)) : undefined,
        search ? or(
          ilike(transactions.reference, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.username, `%${search}%`)
        ) : undefined
      ));

    // Get total count
    const totalCountResult = await db
      .select({ count: count() })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(and(
        status ? eq(transactions.status, status) : undefined,
        type ? eq(transactions.type, type) : undefined,
        startDate ? gte(transactions.createdAt, new Date(startDate)) : undefined,
        endDate ? lte(transactions.createdAt, new Date(endDate)) : undefined,
        search ? or(
          ilike(transactions.reference, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.username, `%${search}%`)
        ) : undefined
      ));
    
    const totalCount = totalCountResult[0].count;

    const rows = await query
      .orderBy(desc(transactions.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Flatten rows to match previous structure or expected dashboard structure
    const formattedTransactions = rows.map(r => ({
      ...r.transaction,
      user: r.user,
    }));

    return ok({ 
      transactions: formattedTransactions,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

