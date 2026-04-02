import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pTrades } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

/**
 * @swagger
 * /api/p2p/trades/{id}:
 *   get:
 *     summary: Get P2P Trade Details
 *     description: Retrieve all details of a specific trade including maker/taker information and payment info.
 *     tags: [P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The trade ID
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { and, or, eq }) =>
        and(eq(t.id, tradeId), or(eq(t.makerId, userId), eq(t.takerId, userId))),
      with: {
        offer: true,
        asset: true,
        maker: { with: { profile: true } },
        taker: { with: { profile: true } },
      },
    });

    if (!trade) {
      return err("Trade not found or unauthorized access", 404);
    }

    return ok({ trade });
  } catch (error) {
    return handleError(error);
  }
}
