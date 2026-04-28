import { NextRequest } from "next/server";
import { db } from "@/db";
import { miningUpgrades } from "@/db/schema";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { z } from "zod";
import { eq } from "drizzle-orm";

const updateUpgradeSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  priceUsdt: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  miningRate: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  durationDays: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * @swagger
 * /api/admin/mining/upgrades/{id}:
 *   put:
 *     summary: Admin - Update a mining upgrade plan
 *     description: Modify an existing hashrate boost plan or deactivate it.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               priceUsdt: { type: string }
 *               miningRate: { type: string }
 *               durationDays: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       400:
 *         description: Validation error or Duplicate Name
 *       404:
 *         description: Plan not found
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id: planId } = await params;

    const body = await req.json();
    const parsedData = validate(updateUpgradeSchema, body);

    if (Object.keys(parsedData).length === 0) {
      return err("No fields provided to update", 400);
    }

    const [updatedPlan] = await db
      .update(miningUpgrades)
      .set(parsedData)
      .where(eq(miningUpgrades.id, planId))
      .returning();

    if (!updatedPlan) {
      return err("Plan not found", 404);
    }

    return ok({
      message: "Mining upgrade plan updated successfully",
      plan: updatedPlan,
    });
  } catch (error) {
    if ((error as any).code === '23505') {
      return err("A plan with this name already exists", 400);
    }
    return handleError(error);
  }
}
