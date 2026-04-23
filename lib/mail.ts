import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const transporter = (gmailUser && gmailPass) ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
}) : null;

export async function sendVerificationEmail(email: string, otp: string) {
  const confirmLink = `${appUrl}/api/auth/verify-email?token=${otp}`;

  if (!transporter) {
    console.warn(`[MAIL MOCK] Verification OTP for ${email}: ${otp}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Krypton" <${gmailUser}>`,
      to: email,
      subject: "Verify your email - Krypton",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">KRYPTON</h2>
          <p>Hello,</p>
          <p>Thank you for registering. Please use the following 6-digit code to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f4f4f4; padding: 10px 20px; border-radius: 5px; color: #000;">${otp}</span>
          </div>
          <p>Alternatively, you can click the button below:</p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${confirmLink}" style="background-color: #007bff; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email</a>
          </div>
          <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, otp: string) {
  if (!transporter) {
    console.warn(`[MAIL MOCK] Password reset OTP for ${email}: ${otp}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Krypton" <${gmailUser}>`,
      to: email,
      subject: "Reset your password - Krypton",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">KRYPTON</h2>
          <p>Hello,</p>
          <p>You requested to reset your password. Use the following code:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f4f4f4; padding: 10px 20px; border-radius: 5px; color: #000;">${otp}</span>
          </div>
          <p>This code will expire in 1 hour.</p>
          <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

export async function sendSupportEmail(userEmail: string, subject: string, message: string, category: string) {
  if (!transporter) {
    console.warn(`[MAIL MOCK] Support ticket from ${userEmail}: [${category}] ${subject} - ${message}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Krypton Support System" <${gmailUser}>`,
      to: gmailUser, // send to the support admin email (using self for now)
      replyTo: userEmail,
      subject: `Support Request: [${category}] ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #333;">New Support Request</h2>
          <p><strong>From:</strong> ${userEmail}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending support email:", error);
    throw error;
  }
}
