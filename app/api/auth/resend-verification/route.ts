import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { validate } from "@/lib/validate";
import { ok, handleError } from "@/lib/errors";
import { sendVerificationEmail } from "@/lib/mail";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomInt } from "crypto";

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend Verification
 *     description: Resend email verification link.
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = validate(resendVerificationSchema, body);

    // Find user
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    // If user exists and is not verified, generate new token and send email
    if (user && !user.isEmailVerified) {
      const emailVerifyToken = randomInt(100000, 999999).toString();

      await db
        .update(users)
        .set({
          emailVerifyToken,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      try {
        await sendVerificationEmail(email, emailVerifyToken);
      } catch (error) {
        console.error("Failed to resend verification email:", error);
      }
    }

    // Always return success to avoid email enumeration
    return ok({ message: "If an account exists and is not verified, a new verification email has been sent." });
  } catch (err) {
    return handleError(err);
  }
}
