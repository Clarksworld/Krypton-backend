import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";

/**
 * @swagger
 * /api/auth/security:
 *   get:
 *     summary: Get Security Info
 *     description: Get user security settings and trust score.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      with: {
        profile: true,
      }
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const sessions = await db.query.userSessions.findMany({
      where: (s, { eq }) => eq(s.userId, userId),
    });

    let trustScore = 0;
    if (user.isEmailVerified) trustScore += 20;
    if (user.isTwoFactorEnabled) trustScore += 30;
    if ((user as any).profile && parseInt((user as any).profile.kycLevel || "0") >= 1) trustScore += 50;

    return ok({
      twoFactorEnabled: user.isTwoFactorEnabled,
      passwordUpdatedAt: user.passwordUpdatedAt,
      trustScore,
      activeSessionCount: sessions.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
