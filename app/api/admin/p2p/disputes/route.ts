import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { p2pTrades, p2pOffers, users, cryptoAssets, p2pDisputes } from "@/db/schema";

/**
 * @swagger
 * /api/admin/p2p/disputes:
 *   get:
 *     summary: Admin — P2P Disputes
 *     description: Retrieve a paginated list of P2P disputes.
 *     tags: [Admin, P2P]
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
 *         schema: { type: string, description: 'open, resolved' }
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
    const statusParam = searchParams.get("status") || 'open';

    const offset = (page - 1) * pageSize;

    let whereCond = undefined;
    if (statusParam && statusParam.toLowerCase() !== "all") {
        whereCond = eq(p2pDisputes.status, statusParam.toLowerCase());
    }

    // Get total count
    const [totalCountRes] = await db
        .select({ count: count() })
        .from(p2pDisputes)
        .where(whereCond);
    const totalCount = totalCountRes.count;

    const makers = alias(users, 'makers');
    const takers = alias(users, 'takers');

    const disputesRaw = await db
      .select({
        id: p2pDisputes.id,
        tradeId: p2pTrades.id,
        status: p2pDisputes.status,
        createdAt: p2pDisputes.createdAt,
        makerName: makers.username,
        makerEmail: makers.email,
        takerName: takers.username,
        takerEmail: takers.email,
        assetSymbol: cryptoAssets.symbol,
        offerType: p2pOffers.type
      })
      .from(p2pDisputes)
      .leftJoin(p2pTrades, eq(p2pDisputes.tradeId, p2pTrades.id))
      .leftJoin(p2pOffers, eq(p2pTrades.offerId, p2pOffers.id))
      .leftJoin(makers, eq(p2pTrades.makerId, makers.id))
      .leftJoin(takers, eq(p2pTrades.takerId, takers.id))
      .leftJoin(cryptoAssets, eq(p2pTrades.assetId, cryptoAssets.id))
      .where(whereCond)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(p2pDisputes.createdAt));

    const nowMs = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const disputes = disputesRaw.map(d => {
      const makerIden = d.makerName || d.makerEmail || 'Unknown';
      const takerIden = d.takerName || d.takerEmail || 'Unknown';
      
      const buyer = d.offerType === 'sell' ? takerIden : makerIden;
      const seller = d.offerType === 'sell' ? makerIden : takerIden;

      // Ensure proper casing for UI
      let displayStatus = 'In Review';
      if (d.status === 'resolved') displayStatus = 'Resolved';

      const createdTimeMs = d.createdAt ? d.createdAt.getTime() : nowMs;
      const urgency = (nowMs - createdTimeMs) > ONE_DAY_MS ? 'High' : 'Medium';

      return {
        id: d.tradeId ? `#TR-${d.tradeId.split('-')[0].substring(0,6).toUpperCase()}` : 'N/A',
        disputeId: d.id, // Included for exact matching if frontend needs it
        trade: `${d.assetSymbol || 'UNK'}/USD`,
        buyer,
        seller,
        status: displayStatus,
        urgency,
        createdAt: d.createdAt?.toISOString()
      };
    });

    return ok({ 
        disputes,
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
