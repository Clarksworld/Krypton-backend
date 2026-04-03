import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { kycSubmissions, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const approveSchema = z.object({
  approve: z.boolean(),
  rejectReason: z.string().optional(),
});

/**
 * @swagger
 * /api/admin/kyc/{id}/approve:
 *   post:
 *     summary: Admin — Approve or Reject KYC
 *     description: Review and approve or reject a user's KYC submission.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC submission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approve]
 *             properties:
 *               approve: { type: boolean, example: true }
 *               rejectReason: { type: string, example: "Document unclear" }
 *     responses:
 *       200:
 *         description: KYC decision recorded
 *       404:
 *         description: KYC submission not found
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id } = await params;
    const body = await req.json();
    const { approve, rejectReason } = validate(approveSchema, body);

    const submission = await db.query.kycSubmissions.findFirst({
      where: (k, { eq }) => eq(k.id, id),
    });

    if (!submission) return err("KYC submission not found", 404);

    const newStatus = approve ? "approved" : "failed";

    await db.transaction(async (tx) => {
      await tx
        .update(kycSubmissions)
        .set({
          status: newStatus,
          rejectReason: approve ? null : (rejectReason ?? "Rejected by admin"),
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(kycSubmissions.id, id));

      // Update user profile kyc status
      await tx
        .update(userProfiles)
        .set({
          kycStatus: newStatus,
          kycLevel: approve ? "1" : "0",
        })
        .where(eq(userProfiles.userId, submission.userId));
    });

    return ok({ message: `KYC ${newStatus}`, submissionId: id });
  } catch (error) {
    return handleError(error);
  }
}
