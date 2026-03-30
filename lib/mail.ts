import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const confirmLink = `${appUrl}/api/auth/verify-email?token=${token}`;

  if (!resend) {
    console.warn(`[MAIL MOCK] Verification email for ${email}: ${confirmLink}`);
    return;
  }

  await resend.emails.send({
    from: "Krypton <onboarding@resend.dev>",
    to: email,
    subject: "Verify your email",
    html: `<p>Click <a href="${confirmLink}">here</a> to verify your email.</p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${appUrl}/auth/reset-password?token=${token}`;

  if (!resend) {
    console.warn(`[MAIL MOCK] Password reset email for ${email}: ${resetLink}`);
    return;
  }

  await resend.emails.send({
    from: "Krypton <onboarding@resend.dev>",
    to: email,
    subject: "Reset your password",
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
  });
}
