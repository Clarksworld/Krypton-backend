import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/db";
import { users, userProfiles, notificationSettings } from "@/db/schema";
import { validate } from "@/lib/validate";
import { ok, handleError, ApiError } from "@/lib/errors";
import { signToken } from "@/lib/auth";
import { or, eq } from "drizzle-orm";
import { sendVerificationEmail } from "@/lib/mail";
import { z } from "zod";
import { randomInt } from "crypto";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username } = validate(registerSchema, body);

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
    const emailVerifyToken = randomInt(100000, 999999).toString();

    // Create user in a transaction
    const newUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          username,
          emailVerifyToken,
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

    // Send verification email
    try {
      await sendVerificationEmail(email, emailVerifyToken);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // We don't throw here to avoid failing registration if email fails
    }

    // Generate JWT for auto-login
    const token = await signToken({
      sub: newUser.id,
      email: newUser.email,
    });

    const response = ok({
      token,
      message: "Account created successfully. Please check your email to verify.",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
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
