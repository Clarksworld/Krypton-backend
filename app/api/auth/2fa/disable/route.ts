import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { verifySync } from "otplib";
import { ok, handleError, ApiError } from "@/lib/errors";

/**
 * @swagger
 * /api/auth/2fa/disable:
 *   post:
 *     summary: Disable 2FA
 *     description: Disable Two-Factor Authentication by verifying a valid TOTP code from the authenticator app.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 6, description: "6-digit TOTP code from authenticator app" }
 *     responses:
 *       200:
 *         description: 2FA successfully disabled
 *       400:
 *         description: Invalid code or 2FA not enabled
 *       404:
 *         description: User not found
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { code } = body;

    if (!code) {
      throw new ApiError("TOTP code is required to disable 2FA", 400);
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new ApiError("2FA is not currently enabled", 400);
    }

    // Attempt verification using verifySync
    let isValid = false;
    try {
      const result = verifySync({ token: code, secret: user.twoFactorSecret });
      isValid = result?.valid ? true : false;
    } catch (e) {
      isValid = false;
    }

    if (!isValid) {
      throw new ApiError("Invalid or expired 2FA code", 400);
    }

    await db
      .update(users)
      .set({
        isTwoFactorEnabled: false,
        twoFactorSecret: null, // clear the secret when disabled
        last2faVerifiedAt: null,
      })
      .where(eq(users.id, userId));

    return ok({ message: "2FA has been successfully disabled" });
  } catch (error) {
    return handleError(error);
  }
}
