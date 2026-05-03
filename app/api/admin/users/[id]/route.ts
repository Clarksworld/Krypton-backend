import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Admin — Get User Details
 *     description: Get full details for a specific user, including profile, wallets, and recent transactions.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User UUID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: User not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id: userId } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        profile: true,
        wallets: {
          with: {
            asset: true,
          },
        },
        transactions: {
          orderBy: (t, { desc }) => [desc(t.createdAt)],
          limit: 10,
          with: {
            asset: true,
          },
        },
      },
    });

    if (!user) {
      return err("User not found", 404);
    }

    // Sanitize user object (remove sensitive fields)
    const { passwordHash, emailVerifyToken, passwordResetToken, twoFactorSecret, ...safeUser } = user;

    return ok({ user: safeUser });
  } catch (error) {
    return handleError(error);
  }
}
