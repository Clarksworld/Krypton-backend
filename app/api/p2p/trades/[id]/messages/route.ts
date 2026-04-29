import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { p2pMessages, p2pTrades } from "@/db/schema/p2p";
import { triggerTradeUpdate } from "@/lib/pusher";
import { eq, or, and } from "drizzle-orm";

/**
 * @swagger
 * /api/p2p/trades/{id}/messages:
 *   post:
 *     summary: Send a Message
 *     description: Send a message in the trade chat. Broadcasts via Pusher.
 *     tags: [P2P]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string }
 *               attachmentUrl: { type: string }
 *     responses:
 *       200:
 *         description: Message sent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    const { id: tradeId } = await params;
    const { content, attachmentUrl } = await req.json();

    if (!content) return err("Message content is required", 400);

    // 1. Verify user is part of the trade
    const trade = await db.query.p2pTrades.findFirst({
      where: (t, { eq, and, or }) =>
        and(
          eq(t.id, tradeId),
          or(eq(t.makerId, userId), eq(t.takerId, userId))
        ),
    });

    if (!trade) return err("Trade not found or unauthorized", 404);

    // 2. Save message to DB
    const [message] = await db
      .insert(p2pMessages)
      .values({
        tradeId,
        senderId: userId,
        content,
        attachmentUrl,
      })
      .returning();

    // 3. Trigger Pusher update
    // We send the full message object so the UI can append it
    await triggerTradeUpdate(tradeId, "new-message", message);

    return ok({ message });
  } catch (error) {
    return handleError(error);
  }
}
