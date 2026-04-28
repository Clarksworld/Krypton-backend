import { NextRequest } from "next/server";
import { db } from "@/db";
import { miningUpgrades } from "@/db/schema";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { z } from "zod";

const createUpgradeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  priceUsdt: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  miningRate: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  durationDays: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional().default("30"),
  isActive: z.boolean().optional().default(true),
});

/**
 * @swagger
 * /api/admin/mining/upgrades:
 *   get:
 *     summary: Admin - List all mining upgrade plans
 *     description: Retrieve all hashrate boost plans (including inactive ones).
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

    const upgrades = await db.query.miningUpgrades.findMany({
      orderBy: (u, { asc }) => [asc(u.priceUsdt)],
    });

    return ok({ upgrades });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/mining/upgrades:
 *   post:
 *     summary: Admin - Add a new mining upgrade plan
 *     description: Create a new hashrate boost plan for users to purchase.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, priceUsdt, miningRate]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               priceUsdt: { type: string, description: "Price in USDT" }
 *               miningRate: { type: string, description: "New tokens-per-hour rate" }
 *               durationDays: { type: string, default: "30" }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       400:
 *         description: Validation error or Duplicate Name
 *       403:
 *         description: Admin access required
 */
export async function POST(req: NextRequest) {
  try {
    getAdminId(req);

    const body = await req.json();
    const parsedData = validate(createUpgradeSchema, body);

    const [newPlan] = await db.insert(miningUpgrades).values({
      name: parsedData.name,
      description: parsedData.description,
      priceUsdt: parsedData.priceUsdt,
      miningRate: parsedData.miningRate,
      durationDays: parsedData.durationDays,
      isActive: parsedData.isActive,
    }).returning();

    return ok({
      message: "Mining upgrade plan created successfully",
      plan: newPlan,
    }, 201);
  } catch (error) {
    // Check for PostgreSQL unique constraint violation on 'name'
    if ((error as any).code === '23505') {
      return err("A plan with this name already exists", 400);
    }
    return handleError(error);
  }
}
