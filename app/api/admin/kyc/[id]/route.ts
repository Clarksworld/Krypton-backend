import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { kycSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/kyc/{id}:
 *   get:
 *     summary: Admin — Get KYC Details
 *     description: Retrieve all details of a specific KYC submission including document URLs and user profile information.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The KYC submission ID
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

    const submission = await db.query.kycSubmissions.findFirst({
      where: (k, { eq }) => eq(k.id, id),
      with: {
        user: {
          with: { profile: true },
        },
      },
    });

    if (!submission) {
      return err("KYC submission not found", 404);
    }

    return ok({ submission });
  } catch (error) {
    return handleError(error);
  }
}
