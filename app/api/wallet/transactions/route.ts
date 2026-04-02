import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { transactions } from "@/db/schema";
import { and, eq, desc, count } from "drizzle-orm";

/**
 * GET /api/wallet/transactions
 *
 * Returns paginated, filterable transaction history for the authenticated user.
 *
 * Query params:
 *   page    - integer, default 1
 *   limit   - integer, default 20, max 100
 *   type    - "deposit" | "withdrawal" | "sell" | "p2p_buy" | "p2p_sell" | "fee"
 *   status  - "pending" | "processing" | "completed" | "failed"
 *   symbol  - asset symbol, e.g. "BNB", "USDT"
 *
 * Response:
 *   { transactions, pagination: { page, limit, total, totalPages } }
 */
/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Paginated Transaction History
 *     description: Get paginated, filterable transaction history for the authenticated user.
 *     tags: [Wallet]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [deposit, withdrawal, internal_transfer, sell, swap, p2p_buy, p2p_sell, fee]
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *       - in: query
 *         name: symbol
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);

    // ── Parse & validate query params ─────────────────────────────────
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const typeFilter = searchParams.get("type") ?? null;
    const statusFilter = searchParams.get("status") ?? null;
    const symbolFilter = searchParams.get("symbol")?.toUpperCase() ?? null;

    const VALID_TYPES = ["deposit", "withdrawal", "internal_transfer", "sell", "swap", "p2p_buy", "p2p_sell", "fee"];
    const VALID_STATUSES = ["pending", "processing", "completed", "failed"];

    if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
      return err(`Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`, 400);
    }
    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
      return err(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    // ── If filtering by symbol, resolve the assetId first ─────────────
    let assetIdFilter: string | null = null;
    if (symbolFilter) {
      const asset = await db.query.cryptoAssets.findFirst({
        where: (ca, { eq }) => eq(ca.symbol, symbolFilter),
        columns: { id: true },
      });
      if (!asset) {
        return err(`Asset '${symbolFilter}' not found`, 404);
      }
      assetIdFilter = asset.id;
    }

    // ── Build conditions array ────────────────────────────────────────
    const conditions = [eq(transactions.userId, userId)];
    if (typeFilter) conditions.push(eq(transactions.type, typeFilter));
    if (statusFilter) conditions.push(eq(transactions.status, statusFilter));
    if (assetIdFilter) conditions.push(eq(transactions.assetId, assetIdFilter));
    const whereClause = and(...conditions);

    // ── Fetch total count ──────────────────────────────────────────────
    const [{ total }] = await db
      .select({ total: count() })
      .from(transactions)
      .where(whereClause);

    // ── Fetch paginated transactions ───────────────────────────────────
    // We use the raw select here instead of findMany to ensure type stability
    const rows = await db.query.transactions.findMany({
      where: (t, { eq, and }) => {
        const queryConditions = [eq(t.userId, userId)];
        if (typeFilter) queryConditions.push(eq(t.type, typeFilter as any));
        if (statusFilter) queryConditions.push(eq(t.status, statusFilter as any));
        if (assetIdFilter) queryConditions.push(eq(t.assetId, assetIdFilter));
        return and(...queryConditions);
      },
      with: {
        asset: {
          columns: {
            symbol: true,
            name: true,
            iconUrl: true,
          },
        },
      },
      orderBy: (t) => [desc(t.createdAt)],
      limit,
      offset,
    });

    // ── Format response ────────────────────────────────────────────────
    const formatted = rows.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: tx.amount,
      fee: tx.fee,
      fiatAmount: tx.fiatAmount,
      fiatCurrency: tx.fiatCurrency,
      reference: tx.reference,
      asset: tx.asset
        ? {
            symbol: tx.asset.symbol,
            name: tx.asset.name,
            iconUrl: tx.asset.iconUrl,
          }
        : null,
      metadata: tx.metadata,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      // Human-readable label for UI display
      label: buildLabel(tx.type, tx.status),
    }));

    return ok({
      transactions: formatted,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
        hasNextPage: page * limit < Number(total),
        hasPrevPage: page > 1,
      },
      filters: {
        type: typeFilter,
        status: statusFilter,
        symbol: symbolFilter,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

function buildLabel(type: string | null, status: string | null): string {
  const typeLabels: Record<string, string> = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    internal_transfer: "Internal Transfer",
    sell: "Sell",
    swap: "Swap",
    p2p_buy: "P2P Buy",
    p2p_sell: "P2P Sell",
    fee: "Fee",
  };
  const statusLabels: Record<string, string> = {
    pending: "⏳ Pending",
    processing: "🔄 Processing",
    completed: "✅ Completed",
    failed: "❌ Failed",
  };
  const typeLabel = typeLabels[type ?? ""] ?? type ?? "Transaction";
  const statusLabel = statusLabels[status ?? ""] ?? status ?? "";
  return `${typeLabel} — ${statusLabel}`;
}
