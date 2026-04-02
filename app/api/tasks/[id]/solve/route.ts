import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { userTasks, miningStats } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * @swagger
 * /api/tasks/{id}/solve:
 *   post:
 *     summary: Complete a Task
 *     description: Mark a task as completed and claim its reward to your mining balance.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     responses:
 *       200:
 *         description: Task completed and reward granted
 *       400:
 *         description: Task already completed or invalid
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(req);
    const { id: taskId } = params;

    const task = await db.query.tasks.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, taskId), eq(t.isActive, true)),
    });

    if (!task) {
      return err("Task not found or no longer active", 404);
    }

    const alreadyDone = await db.query.userTasks.findFirst({
      where: (ut, { eq, and }) =>
        and(eq(ut.userId, userId), eq(ut.taskId, taskId)),
    });

    if (alreadyDone) {
      return err("You have already completed this task", 400);
    }

    await db.transaction(async (tx) => {
      // Record completion
      await tx.insert(userTasks).values({ userId, taskId });

      // Credit reward to mining balance (lazy-create if needed)
      const stats = await tx.query.miningStats.findFirst({
        where: (m, { eq }) => eq(m.userId, userId),
      });

      if (stats) {
        await tx
          .update(miningStats)
          .set({
            balance: sql`${miningStats.balance} + ${task.rewardAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(miningStats.userId, userId));
      } else {
        await tx.insert(miningStats).values({
          userId,
          balance: task.rewardAmount,
        });
      }
    });

    return ok({
      message: `Task completed! You earned ${task.rewardAmount} tokens.`,
      reward: task.rewardAmount,
    });
  } catch (error) {
    return handleError(error);
  }
}
