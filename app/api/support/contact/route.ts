import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { sendSupportEmail } from "@/lib/mail";
import { z } from "zod";
import { validate } from "@/lib/validate";

const supportRequestSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  category: z.string().min(1, "Category is required"),
});

/**
 * @swagger
 * /api/support/contact:
 *   post:
 *     summary: Contact Support
 *     description: Submit a support or help request.
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message, category]
 *             properties:
 *               subject: { type: string }
 *               message: { type: string }
 *               category: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { subject, message, category } = validate(supportRequestSchema, body);

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // Send email to support
    await sendSupportEmail(user.email, subject, message, category);

    return ok({ message: "Your support request has been submitted successfully" });
  } catch (err) {
    return handleError(err);
  }
}
