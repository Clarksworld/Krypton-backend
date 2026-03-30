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

    // Verify password
    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      throw new ApiError("Invalid email or password", 401);
    }

    // Generate JWT
    const token = await signToken({
      sub: user.id,
      email: user.email,
    });

    // Set cookie and return user info + token
    const response = ok({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
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
