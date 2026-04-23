import { NextRequest } from "next/server";
import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { eq } from "drizzle-orm";

/**
 * @swagger
 * /api/notifications/settings/reset:
 *   post:
 *     summary: Reset Notification Settings
 *     description: Reset notification preferences to default values.
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Default values
    const defaults = {
      tradeAlerts: true,
      transactionAlerts: true,
      kycAlerts: true,
      securityAlerts: true,
      promoAlerts: false,
      pushEnabled: true,
      emailEnabled: true,
      updatedAt: new Date(),
    };

    let settings = await db.query.notificationSettings.findFirst({
      where: (ns, { eq }) => eq(ns.userId, userId),
    });

    if (!settings) {
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({ userId, ...defaults })
        .returning();
      settings = newSettings;
    } else {
      const [updated] = await db
        .update(notificationSettings)
        .set(defaults)
        .where(eq(notificationSettings.userId, userId))
        .returning();
      settings = updated;
    }

    return ok({ message: "Notification settings reset to defaults", settings });
  } catch (err) {
    return handleError(err);
  }
}
