import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/wallet/transfer/verify:
 *   get:
 *     summary: Verify Target User
 *     description: Verify target user before internal transfer.
 *     tags: [Wallet]
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Krypton username of target user
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return err("Krypton Tag (username) is required", 400);
    }

    const targetUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.username, username),
      with: {
        profile: {
          columns: {
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      columns: {
        id: true,
        username: true,
      },
    });

    if (!targetUser) {
      return err("User not found", 404);
    }

    if (targetUser.id === userId) {
      return err("Cannot transfer to yourself", 400);
    }

    return ok({
      user: {
        username: targetUser.username,
        name: targetUser.profile?.fullName ?? null,
        avatarUrl: targetUser.profile?.avatarUrl ?? null,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
