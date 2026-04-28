import { NextRequest } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["social", "video", "puzzle"]).optional(),
  rewardAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  taskLink: z.string().url("Must be a valid URL").optional().nullable(),
  completionCode: z.string().optional().nullable(),
  puzzleData: z.string().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * @swagger
 * /api/admin/tasks/{id}:
 *   get:
 *     summary: Admin - Get task detail
 *     description: Retrieve full details of a specific task.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id: taskId } = await params;

    const task = await db.query.tasks.findFirst({
      where: (t, { eq }) => eq(t.id, taskId),
    });

    if (!task) {
      return err("Task not found", 404);
    }

    return ok({ task });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/tasks/{id}:
 *   patch:
 *     summary: Admin - Update task
 *     description: Update specific fields of a task (e.g. set reward amount, deactivate).
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               rewardAmount: { type: string }
 *               taskLink: { type: string }
 *               completionCode: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Success
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id: taskId } = await params;

    const task = await db.query.tasks.findFirst({
      where: (t, { eq }) => eq(t.id, taskId),
    });

    if (!task) {
      return err("Task not found", 404);
    }

    const body = await req.json();
    const parsedData = validate(updateTaskSchema, body);

    if (Object.keys(parsedData).length === 0) {
      return err("No fields provided to update", 400);
    }

    // Business logic validation for combined existing + new data
    const finalType = parsedData.type ?? task.type;
    const finalTaskLink = parsedData.taskLink !== undefined ? parsedData.taskLink : task.taskLink;
    const finalCompletionCode = parsedData.completionCode !== undefined ? parsedData.completionCode : task.completionCode;

    if (finalType === "video" && !finalCompletionCode) {
      return err("Completion code is required for video tasks", 400);
    }
    if ((finalType === "social" || finalType === "video") && !finalTaskLink) {
      return err("Task link is required for social/video tasks", 400);
    }

    const [updatedTask] = await db
      .update(tasks)
      .set({
        ...parsedData,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return ok({
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    if ((error as any).code === '23505') {
      return err("A task with this title already exists", 400);
    }
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/tasks/{id}:
 *   delete:
 *     summary: Admin - Delete task
 *     description: Permanently delete a task.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);
    const { id: taskId } = await params;

    const [deletedTask] = await db
      .delete(tasks)
      .where(eq(tasks.id, taskId))
      .returning();

    if (!deletedTask) {
      return err("Task not found", 404);
    }

    return ok({ message: "Task deleted successfully" });
  } catch (error) {
    return handleError(error);
  }
}
