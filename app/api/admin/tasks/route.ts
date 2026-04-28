import { NextRequest } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getAdminId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["social", "video", "puzzle"]).default("social"),
  rewardAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  taskLink: z.string().url("Must be a valid URL").optional().nullable(),
  completionCode: z.string().optional().nullable(),
  puzzleData: z.string().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.type === "video" && !data.completionCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completion code is required for video tasks",
      path: ["completionCode"],
    });
  }
  if ((data.type === "social" || data.type === "video") && !data.taskLink) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Task link is required for social/video tasks",
      path: ["taskLink"],
    });
  }
});

/**
 * @swagger
 * /api/admin/tasks:
 *   get:
 *     summary: Admin - List all tasks
 *     description: Retrieve all tasks including inactive ones, completion codes, and answers.
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

    const allTasks = await db.query.tasks.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return ok({ tasks: allTasks });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/tasks:
 *   post:
 *     summary: Admin - Create a new task
 *     description: Add a new social, video, or puzzle task.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, rewardAmount]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [social, video, puzzle] }
 *               rewardAmount: { type: string }
 *               taskLink: { type: string }
 *               completionCode: { type: string }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Task created successfully
 */
export async function POST(req: NextRequest) {
  try {
    getAdminId(req);

    const body = await req.json();
    const parsedData = validate(createTaskSchema, body);

    const [newTask] = await db.insert(tasks).values({
      title: parsedData.title,
      description: parsedData.description,
      type: parsedData.type,
      rewardAmount: parsedData.rewardAmount,
      taskLink: parsedData.taskLink,
      completionCode: parsedData.completionCode,
      puzzleData: parsedData.puzzleData,
      correctAnswer: parsedData.correctAnswer,
      isActive: parsedData.isActive,
    }).returning();

    return ok({
      message: "Task created successfully",
      task: newTask,
    }, 201);
  } catch (error) {
    if ((error as any).code === '23505') {
      return err("A task with this title already exists", 400);
    }
    return handleError(error);
  }
}
