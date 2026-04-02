import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pTrades, p2pDisputes } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const disputeSchema = z.object({
  reason: z.string().min(10),
  evidenceUrls: z.array(z.string().url()).optional(),
});

/**
 * @swagger
 * /api/p2p/trades/{id}/dispute:
 *   post:
 *     summary: Open P2P Dispute
 *     description: Raise a dispute for a trade. Status will move to 'disputed'.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: "Seller didn't release crypto after payment." }
 *               evidenceUrls: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Dispute raised successfully
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;
    const body = await req.json();
    const { reason, evidenceUrls } = validate(disputeSchema, body);

    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { and, or, eq }) =>
        and(eq(t.id, tradeId), or(eq(t.makerId, userId), eq(t.takerId, userId))),
    });

    if (!trade) return err("Trade not found or unauthorized", 404);

    if (trade.status === "completed" || trade.status === "cancelled" || trade.status === "disputed") {
      return err(`Cannot dispute trade in status: ${trade.status}`, 400);
    }

    const [dispute] = await db.transaction(async (tx) => {
      // 1. Create Dispute
      const [newDispute] = await tx.insert(p2pDisputes).values({
        tradeId,
        raisedBy: userId,
        reason,
        evidenceUrls,
        status: "open",
      }).returning();

      // 2. Update Trade Status
      await tx.update(p2pTrades).set({
        status: "disputed",
        updatedAt: new Date(),
      }).where(eq(p2pTrades.id, tradeId));

      return [newDispute];
    });

    return ok({ dispute, message: "Dispute raised. Admin will review soon." });
  } catch (error) {
    return handleError(error);
  }
}
