import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/auth/2fa/status:
 *   get:
 *     summary: Get 2FA status
 *     description: Returns whether 2FA is currently enabled for the user.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: User not found
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: {
        isTwoFactorEnabled: true,
      },
    });

    if (!user) {
      return err("User not found", 404);
    }

    return NextResponse.json({
      success: true,
      data: {
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
