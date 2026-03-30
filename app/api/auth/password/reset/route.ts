import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { validate } from "@/lib/validate";
import { ok, handleError, ApiError } from "@/lib/errors";
import { hash } from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPassword } = validate(resetPasswordSchema, body);

    // Find user with valid token and not expired
    const user = await db.query.users.findFirst({
      where: (u, { eq, gt, and }) => 
        and(
          eq(u.passwordResetToken, token),
          gt(u.passwordResetExpires, new Date())
        ),
    });

    if (!user) {
      throw new ApiError("Invalid or expired reset token", 400);
    }

    // Update password and clear reset token
    const passwordHash = await hash(newPassword, 12);
    await db
      .update(users)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return ok({ message: "Password reset successfully" });
  } catch (err) {
    return handleError(err);
  }
}
