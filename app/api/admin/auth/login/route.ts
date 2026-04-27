import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/db";
import { validate } from "@/lib/validate";
import { ok, handleError, ApiError } from "@/lib/errors";
import { signToken } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Log in to an admin account
 *     description: Authenticate an admin user with email and password.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Invalid email/password
 *       403:
 *         description: Admin privileges required
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = validate(loginSchema, body);

    // Find user
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    if (!user) {
      throw new ApiError("Invalid email or password", 401);
    }

    // Enforce admin privileges
    if (!user.isAdmin) {
      throw new ApiError("Admin privileges required to log in here", 403);
    }

    // Verify password
    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      throw new ApiError("Invalid email or password", 401);
    }

    // Enforce email verification (optional, but admins are auto-verified in register)
    if (!user.isEmailVerified) {
      throw new ApiError("Please verify your email to log in", 401);
    }

    // Generate JWT
    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: "admin",
    } as any);

    // Set cookie and return user info + token
    const response = ok({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
      },
    });

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
