import { NextRequest } from "next/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  country: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get Profile
 *     description: Get user profile details.
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Fetch user with profile
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      with: {
        profile: true, // This requires 'profile' relation to be defined in drizzle schema
      },
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return ok({ user: safeUser });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const data = validate(updateProfileSchema, body);

    const [updated] = await db
      .update(userProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();

    return ok({ profile: updated });
  } catch (err) {
    return handleError(err);
  }
}
