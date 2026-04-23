import { NextRequest } from "next/server";
import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const updateSettingsSchema = z.object({
  tradeAlerts: z.boolean().optional(),
  transactionAlerts: z.boolean().optional(),
  kycAlerts: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  promoAlerts: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get Notification Settings
 *     description: Retrieve user info notification preferences.
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Success
 *   patch:
 *     summary: Update Notification Settings
 *     description: Update partial notification preferences.
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    let settings = await db.query.notificationSettings.findFirst({
      where: (ns, { eq }) => eq(ns.userId, userId),
    });

    if (!settings) {
      // Auto-create defaults if they don't exist
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({ userId })
        .returning();
      settings = newSettings;
    }

    return ok({ settings });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const data = validate(updateSettingsSchema, body);

    let settings = await db.query.notificationSettings.findFirst({
      where: (ns, { eq }) => eq(ns.userId, userId),
    });

    if (!settings) {
      // Create defaults + override with data
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({ userId, ...data, updatedAt: new Date() })
        .returning();
      settings = newSettings;
    } else {
      const [updated] = await db
        .update(notificationSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationSettings.userId, userId))
        .returning();
      settings = updated;
    }

    return ok({ settings });
  } catch (err) {
    return handleError(err);
  }
}
