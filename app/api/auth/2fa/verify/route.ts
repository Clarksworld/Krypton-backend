import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { verifySync } from "otplib";
import { err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verify and enable 2FA
 *     description: Finalize 2FA setup by verifying a 6-digit code from the authenticator app.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid code or 2FA already enabled
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return err("Verification 6-digit code required", 400);
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      return err("User not found", 404);
    }

    if (user.isTwoFactorEnabled) {
      return err("2FA is already fully enabled", 400);
    }

    if (!user.twoFactorSecret) {
      return err("Please generate a 2FA profile first to get your secret", 400);
    }

    // Validate the inputted code 
    const result = verifySync({
      token,
      secret: user.twoFactorSecret,
    });

    if (!result.valid) {
      return err("Invalid or expired 2FA code", 400);
    }

    // Lock in the setup and grant them 24h grace period for their freshly entered code
    await db
      .update(users)
      .set({
        isTwoFactorEnabled: true,
        last2faVerifiedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication setup is complete and securely enabled.",
    });
  } catch (error) {
    return handleError(error);
  }
}
