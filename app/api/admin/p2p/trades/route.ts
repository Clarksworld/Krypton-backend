import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, and, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { p2pTrades, p2pOffers, users, cryptoAssets } from "@/db/schema";

/**
 * @swagger
 * /api/admin/p2p/trades:
 *   get:
 *     summary: Admin — P2P Trades
 *     description: Retrieve a paginated list of P2P trades with filtering.
 *     tags: [Admin, P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, description: 'all, pending, completed, disputed' }
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    const { searchParams } = new URL(req.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "10")));
    const statusParam = searchParams.get("status");

    const offset = (page - 1) * pageSize;

    let whereCond = undefined;
    if (statusParam && statusParam.toLowerCase() !== "all trades" && statusParam.toLowerCase() !== "all") {
        whereCond = eq(p2pTrades.status, statusParam.toLowerCase());
    }

    // Get total count
    const [totalCountRes] = await db
        .select({ count: count() })
        .from(p2pTrades)
        .where(whereCond);
    const totalCount = totalCountRes.count;

    const makers = alias(users, 'makers');
    const takers = alias(users, 'takers');

    const tradesRaw = await db
      .select({
        id: p2pTrades.id,
        cryptoAmount: p2pTrades.cryptoAmount,
        fiatAmount: p2pTrades.fiatAmount,
        status: p2pTrades.status,
        createdAt: p2pTrades.createdAt,
        makerName: makers.username,
        makerEmail: makers.email,
        takerName: takers.username,
        takerEmail: takers.email,
        assetSymbol: cryptoAssets.symbol,
        offerType: p2pOffers.type
      })
      .from(p2pTrades)
      .leftJoin(p2pOffers, eq(p2pTrades.offerId, p2pOffers.id))
      .leftJoin(makers, eq(p2pTrades.makerId, makers.id))
      .leftJoin(takers, eq(p2pTrades.takerId, takers.id))
      .leftJoin(cryptoAssets, eq(p2pTrades.assetId, cryptoAssets.id))
      .where(whereCond)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(p2pTrades.createdAt));

    const trades = tradesRaw.map(t => {
      const makerIden = t.makerName || t.makerEmail || 'Unknown';
      const takerIden = t.takerName || t.takerEmail || 'Unknown';
      
      const buyer = t.offerType === 'sell' ? takerIden : makerIden;
      const seller = t.offerType === 'sell' ? makerIden : takerIden;

      // Ensure proper casing for UI
      let displayStatus = 'Pending';
      if (t.status === 'disputed') displayStatus = 'Disputed';
      else if (t.status === 'completed') displayStatus = 'Completed';
      else if (t.status === 'cancelled') displayStatus = 'Cancelled';

      return {
        id: `#TR-${t.id.split('-')[0].substring(0,6).toUpperCase()}`,
        buyer,
        seller,
        amount: `${parseFloat(t.cryptoAmount)} ${t.assetSymbol || ''}`,
        value: t.fiatAmount,
        status: displayStatus,
        createdAt: t.createdAt?.toISOString(),
        isDisputed: displayStatus === 'Disputed'
      };
    });

    return ok({ 
        trades,
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
