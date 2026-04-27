import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/db";
import { users, userProfiles, notificationSettings } from "@/db/schema";
import { validate } from "@/lib/validate";
import { ok, handleError, ApiError } from "@/lib/errors";
import { signToken } from "@/lib/auth";
import { or, eq } from "drizzle-orm";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(3).optional(),
  adminSecret: z.string().min(1, "Admin secret is required"),
});

/**
 * @swagger
 * /api/admin/auth/register:
 *   post:
 *     summary: Register an admin account
 *     description: Create a new admin account using an admin secret.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, adminSecret]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               username: { type: string }
 *               adminSecret: { type: string }
 *     responses:
 *       201:
 *         description: Success
 *       400:
 *         description: Validation error or Email taken
 *       403:
 *         description: Invalid admin secret
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username, adminSecret } = validate(registerSchema, body);

    const expectedSecret = process.env.ADMIN_REGISTRATION_SECRET || "dev_admin_secret";
    if (adminSecret !== expectedSecret) {
      throw new ApiError("Invalid admin secret", 403);
    }

    // Check if email or username already taken
    const existingUser = await db.query.users.findFirst({
      where: (u) => or(
        eq(u.email, email),
        username ? eq(u.username, username) : undefined as any,
      ),
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ApiError("Email already registered", 400);
      }
      if (username && existingUser.username === username) {
        throw new ApiError("Username already taken", 400);
      }
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
          isAdmin: true,
          isEmailVerified: true, // Admins auto-verified
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

    // Generate JWT
    const token = await signToken({
      sub: newUser.id,
      email: newUser.email,
      role: "admin",
    } as any);

    const response = ok({
      token,
      message: "Admin account created successfully.",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        isAdmin: newUser.isAdmin,
      },
    }, 201);

    // Set cookie for auto-login
    response.cookies.set("krypton_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (err) {
    return handleError(err);
  }
}
