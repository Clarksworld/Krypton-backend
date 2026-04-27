import { NextRequest } from "next/server";
import { db } from "@/db";
import { globalSettings } from "@/db/schema";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/mining/countdown:
 *   get:
 *     summary: Get Mining Countdown
 *     description: Retrieve the global mining countdown duration in seconds.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);

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

/**
 * @swagger
 * /api/admin/mining/countdown:
 *   post:
 *     summary: Set Mining Countdown
 *     description: Set the global mining countdown duration in seconds.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [seconds]
 *             properties:
 *               seconds:
 *                 type: number
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    getAdminId(req);
    const body = await req.json();
    const { seconds } = body;

    if (typeof seconds !== "number" || seconds < 0) {
      return err("Seconds must be a positive number", 400);
    }

    const existing = await db.query.globalSettings.findFirst({
      where: (s, { eq }) => eq(s.key, "mining_countdown_seconds"),
    });

    if (existing) {
      await db.update(globalSettings)
        .set({ value: seconds.toString(), updatedAt: new Date() })
        .where(eq(globalSettings.key, "mining_countdown_seconds"));
    } else {
      await db.insert(globalSettings).values({
        key: "mining_countdown_seconds",
        value: seconds.toString(),
        type: "number",
        description: "Countdown duration in seconds between mining claims",
      });
    }

    return ok({ message: "Mining countdown updated successfully", countdownSeconds: seconds });
  } catch (error) {
    return handleError(error);
  }
}
