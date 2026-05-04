import { NextRequest } from "next/server";
import { db } from "@/db";
import { kycSubmissions, userProfiles } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const kycSchema = z.object({
  idType: z.string(),
  idNumber: z.string(),
  idDocUrl: z.string().url().optional(),
  idBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional(),
});

/**
 * @swagger
 * /api/kyc/submit:
 *   post:
 *     summary: Submit KYC
 *     description: Submit KYC documents for verification.
 *     tags: [KYC]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idType, idNumber]
 *             properties:
 *               idType: { type: string, example: "national_id" }
 *               idNumber: { type: string, example: "123456789" }
 *               idDocUrl: { type: string }
 *               idBackUrl: { type: string }
 *               selfieUrl: { type: string }
 *     responses:
 *       200:
 *         description: KYC submitted successfully
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const data = validate(kycSchema, body);

    const existingKyc = await db.query.kycSubmissions.findFirst({
      where: (k, { eq }) => eq(k.userId, userId),
    });

    if (existingKyc && existingKyc.status === "pending") {
      return err("A KYC submission is already pending review.", 400);
    }
    
    if (existingKyc && existingKyc.status === "approved") {
      return err("Your KYC is already approved.", 400);
    }

    let submission;
    if (existingKyc) {
      [submission] = await db.update(kycSubmissions)
        .set({ ...data, status: "pending", updatedAt: new Date(), rejectReason: null })
        .where(eq(kycSubmissions.id, existingKyc.id))
        .returning();
    } else {
      [submission] = await db.insert(kycSubmissions)
        .values({ userId, ...data, status: "pending" })
        .returning();
    }

    // Update user kyc status in profile
    await db.update(userProfiles).set({ kycStatus: "pending" }).where(eq(userProfiles.userId, userId));

    return ok({ submission, message: "KYC submitted successfully" });
  } catch (error) {
    return handleError(error);
  }
}
