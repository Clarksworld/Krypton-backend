import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ok, handleError, ApiError } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      throw new ApiError("Token is required", 400);
    }

    // Find user with matching token
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.emailVerifyToken, token),
    });

    if (!user) {
      throw new ApiError("Invalid or expired verification token", 400);
    }

    // Update user: mark as verified and clear token
    await db
      .update(users)
      .set({
        isEmailVerified: true,
        emailVerifyToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return ok({ message: "Email verified successfully" });
  } catch (err) {
    return handleError(err);
  }
}
