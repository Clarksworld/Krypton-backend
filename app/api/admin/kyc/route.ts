import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/admin/kyc:
 *   get:
 *     summary: Admin — List KYC Submissions
 *     description: Get all KYC submissions, optionally filter by status.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, approved, failed]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const submissions = await db.query.kycSubmissions.findMany({
      where: status
        ? (k, { eq }) => eq(k.status, status)
        : undefined,
      orderBy: (k, { desc }) => [desc(k.submittedAt)],
    });

    return ok({ submissions });
  } catch (error) {
    return handleError(error);
  }
}
