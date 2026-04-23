import { NextRequest } from "next/server";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: List Active Sessions
 *     description: List all active sessions for the authenticated user.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Success
 *   delete:
 *     summary: Invalidate All Sessions
 *     description: Logout the user from all devices.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const sessions = await db.query.userSessions.findMany({
      where: (s, { eq }) => eq(s.userId, userId),
      orderBy: (s, { desc }) => [desc(s.lastSeenAt)],
    });

    return ok({ sessions });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Delete all sessions for the user
    await db.delete(userSessions).where(eq(userSessions.userId, userId));

    return ok({ message: "All sessions terminated successfully" });
  } catch (err) {
    return handleError(err);
  }
}
