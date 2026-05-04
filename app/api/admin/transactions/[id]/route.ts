import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/transactions/{id}:
 *   get:
 *     summary: Admin — Get Transaction Details
 *     description: Retrieve full details for a specific transaction.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id } = await params;

    const submission = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      with: {
        user: {
          with: { profile: true },
        },
        asset: true,
      },
    });

    if (!submission) {
      return err("Transaction not found", 404);
    }

    return ok({ transaction: submission });
  } catch (error) {
    return handleError(error);
  }
}
