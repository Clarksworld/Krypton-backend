import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { ok, handleError, ApiError } from "@/lib/errors";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/**
 * @swagger
 * /api/auth/password/change:
 *   post:
 *     summary: Change Password
 *     description: Change user password while logged in.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const { currentPassword, newPassword } = validate(changePasswordSchema, body);

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const isValid = await compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new ApiError("Incorrect current password", 400);
    }

    const passwordHash = await hash(newPassword, 12);
    await db
      .update(users)
      .set({
        passwordHash,
        passwordUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return ok({ message: "Password changed successfully" });
  } catch (err) {
    return handleError(err);
  }
}
