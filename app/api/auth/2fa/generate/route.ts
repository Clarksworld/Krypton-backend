import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/auth/2fa/generate:
 *   get:
 *     summary: Generate 2FA
 *     description: Generate 2FA secret and QR code URI.
 *     tags: [Auth, Security]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      return err("User not found", 404);
    }

    if (user.isTwoFactorEnabled) {
      return err("2FA is already enabled on this account. Please disable it first to generate a new key.", 400);
    }

    // Generate a secure base32 secret
    const secret = generateSecret();

    // The URI format that Google Authenticator expects
    const appName = "Krypton";
    const otpauth = generateURI({
      secret,
      label: user.email,
      issuer: appName
    });

    // Generate QR code base64 image
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Persist the secret in the DB pending verification
    await db
      .update(users)
      .set({ twoFactorSecret: secret })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      secret, // The manual text code the user can copy-paste into an authenticator
      qrCodeUrl, // The base64 image for scanning
      uri: otpauth, // The deep link URI for mobile devices (otpauth://...)
    });
  } catch (error) {
    return handleError(error);
  }
}
