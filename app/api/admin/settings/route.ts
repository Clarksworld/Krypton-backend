import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { globalSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const updateSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Admin — Get Platform Settings
 *     description: Retrieve all global system configurations (fees, limits, etc.).
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

    const settings = await db.query.globalSettings.findMany();
    return ok({ settings });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/settings:
 *   patch:
 *     summary: Admin — Update Platform Setting
 *     description: Modify a system configuration value.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key: { type: string, example: "withdrawal_fee_pct" }
 *               value: { type: string, example: "0.5" }
 *     responses:
 *       200:
 *         description: Setting updated successfully
 */
export async function PATCH(req: NextRequest) {
  try {
    getAdminId(req);
    const body = await req.json();
    const { key, value } = validate(updateSettingSchema, body);

    const [updated] = await db
      .insert(globalSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: globalSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();

    return ok({ setting: updated, message: `Setting '${key}' updated.` });
  } catch (error) {
    return handleError(error);
  }
}
