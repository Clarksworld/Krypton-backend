import { NextRequest } from "next/server";
import { db } from "@/db";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/mining/leaderboard:
 *   get:
 *     summary: Get Mining Leaderboard
 *     description: Returns the top 100 users by mining balance.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const stats = await db.query.miningStats.findMany({
      orderBy: (m, { desc }) => [desc(m.balance)],
      limit: 100,
      with: {
        user: {
          columns: {
            username: true,
            email: true,
          }
        }
      }
    });

    const leaderboard = stats.map((stat, index) => ({
      rank: index + 1,
      username: stat.user?.username || stat.user?.email?.split('@')[0] || "Anonymous",
      balance: stat.balance,
      userId: stat.userId,
    }));

    return ok({ leaderboard });
  } catch (error) {
    return handleError(error);
  }
}
