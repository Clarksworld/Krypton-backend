import "dotenv/config";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "test@example.com";
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("User found:", {
    email: user.email,
    id: user.id,
    isEmailVerified: user.isEmailVerified,
    emailVerifyToken: user.emailVerifyToken,
  });

  if (user.emailVerifyToken) {
    console.log("Testing verify-email flow...");
    const res = await fetch(`http://localhost:3000/api/auth/verify-email?token=${user.emailVerifyToken}`);
    const data = await res.json();
    console.log("Verify Email Response:", data);
  } else {
    console.log("No email verification token found in DB.");
  }

  console.log("Testing forgot-password flow...");
  const forgotRes = await fetch("http://localhost:3000/api/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "Content-Type": "application/json" },
  });
  console.log("Forgot Password Response:", await forgotRes.json());

  // Check DB for reset token
  const updatedUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });

  if (updatedUser?.passwordResetToken) {
    console.log("Reset token found:", updatedUser.passwordResetToken);
    console.log("Testing reset-password flow...");
    const resetRes = await fetch("http://localhost:3000/api/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({
        token: updatedUser.passwordResetToken,
        newPassword: "newpassword123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    console.log("Reset Password Response:", await resetRes.json());
  } else {
    console.log("No reset token found in DB.");
  }
}

main();
