import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { validate } from "@/lib/validate";
import { ok, handleError } from "@/lib/errors";
import { sendPasswordResetEmail } from "@/lib/mail";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = validate(forgotPasswordSchema, body);

    // Find user
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    // We return successful response even if user doesn't exist for security reasons (prevent email enumeration)
    if (user) {
      const resetToken = generateOTP();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await db
        .update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: expiresAt,
        })
        .where(eq(users.id, user.id));

      await sendPasswordResetEmail(email, resetToken);
    }

    return ok({ message: "If an account exists with that email, a reset link has been sent." });
  } catch (err) {
    return handleError(err);
  }
}
