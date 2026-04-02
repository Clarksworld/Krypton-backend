import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/kyc/status:
 *   get:
 *     summary: Get KYC Status
 *     description: Retrieve the user's current KYC submission status and details.
 *     tags: [KYC]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Returns KYC details or null if no submission exists.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const kyc = await db.query.kycSubmissions.findFirst({
      where: (k, { eq }) => eq(k.userId, userId),
      columns: {
        idType: true,
        idNumber: true,
        status: true,
        rejectReason: true,
        submittedAt: true,
        updatedAt: true
      }
    });

    return ok({ kyc: kyc || null });
  } catch (error) {
    return handleError(error);
  }
}
