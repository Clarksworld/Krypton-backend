import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { or, eq, desc } from "drizzle-orm";
import { p2pTrades } from "@/db/schema";

/**
 * @swagger
 * /api/p2p/trades:
 *   get:
 *     summary: List User's P2P Trades
 *     description: Retrieve all P2P trades where the user is either the maker or the taker.
 *     tags: [P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, payment_sent, payment_confirmed, completed, cancelled, disputed]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const list = await db.query.p2pTrades.findMany({
      where: (t, { and, or, eq }) => {
        const userCond = or(eq(t.makerId, userId), eq(t.takerId, userId));
        if (status) {
          return and(userCond, eq(t.status, status));
        }
        return userCond;
      },
      with: {
        offer: true,
        asset: true,
        maker: { with: { profile: true } },
        taker: { with: { profile: true } },
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return ok({ trades: list });
  } catch (err) {
    return handleError(err);
  }
}
