import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: List Available Tasks
 *     description: Get all active puzzle and reward tasks available for the user to complete.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const allTasks = await db.query.tasks.findMany({
      where: (t, { eq }) => eq(t.isActive, true),
    });

    // Get which tasks this user has already completed
    const completedTasks = await db.query.userTasks.findMany({
      where: (ut, { eq }) => eq(ut.userId, userId),
    });

    const completedTaskIds = new Set(completedTasks.map((ut) => ut.taskId));

    const tasksWithStatus = allTasks.map((task) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { correctAnswer, ...safeTask } = task;
      return {
        ...safeTask,
        completed: completedTaskIds.has(task.id),
      };
    });

    return ok({ tasks: tasksWithStatus });
  } catch (error) {
    return handleError(error);
  }
}
