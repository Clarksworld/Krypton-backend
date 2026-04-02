import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/subscription/plans:
 *   get:
 *     summary: List Subscription Plans
 *     description: Get all available premium subscription tiers.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getUserId(req); // Auth check

    const plans = await db.query.subscriptionPlans.findMany({
      where: (p, { eq }) => eq(p.isActive, true),
    });

    // Also get user's current active subscription
    return ok({ plans });
  } catch (error) {
    return handleError(error);
  }
}
