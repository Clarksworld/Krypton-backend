import { NextRequest } from "next/server";
import { db } from "@/db";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/mining/countdown:
 *   get:
 *     summary: Get Mining Countdown Duration
 *     description: Retrieve the global mining countdown duration in seconds.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const setting = await db.query.globalSettings.findFirst({
      where: (s, { eq }) => eq(s.key, "mining_countdown_seconds"),
    });

    return ok({
      countdownSeconds: setting ? parseInt(setting.value) : 86400,
    });
  } catch (error) {
    return handleError(error);
  }
}
