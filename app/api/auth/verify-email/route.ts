import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// GET handler for processing verification from the email link
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token"); // This will be the 6-digit OTP

    if (!token) {
      throw new ApiError("Token is required", 400);
    }

    // Find user with matching token
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.emailVerifyToken, token),
    });

    if (!user) {
      throw new ApiError("Invalid or expired verification token", 400);
    }

    // Update user: mark as verified and clear token
    await db
      .update(users)
      .set({
        isEmailVerified: true,
        emailVerifyToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return ok({ message: "Email verified successfully" });
  } catch (err) {
    return handleError(err);
  }
}

// POST handler for manual OTP entry
/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify Email
 *     description: Verify user email with token.
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = validate(verifyEmailSchema, body);

    // Find user with matching email and token
    const user = await db.query.users.findFirst({
      where: (u, { eq, and }) => and(
        eq(u.email, email),
        eq(u.emailVerifyToken, otp)
      ),
    });

    if (!user) {
      throw new ApiError("Invalid or expired verification code", 400);
    }

    // Update user: mark as verified and clear token
    await db
      .update(users)
      .set({
        isEmailVerified: true,
        emailVerifyToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return ok({ message: "Email verified successfully" });
  } catch (err) {
    return handleError(err);
  }
}
