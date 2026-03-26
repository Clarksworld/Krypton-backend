import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/db";
import { users, userProfiles, notificationSettings } from "@/db/schema";
import { validate } from "@/lib/validate";
import { ok, handleError, ApiError } from "@/lib/errors";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username } = validate(registerSchema, body);

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    if (existingUser) {
      throw new ApiError("Email already registered", 400);
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user in a transaction
    const newUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          username,
        })
        .returning();

      // Initialize profile
      await tx.insert(userProfiles).values({
        userId: user.id,
      });

      // Initialize notification settings
      await tx.insert(notificationSettings).values({
        userId: user.id,
      });

      return user;
    });

    // Note: In production, we would send a verification email here via Resend

    return ok({
      message: "Account created successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
    }, 201);
  } catch (err) {
    return handleError(err);
  }
}
