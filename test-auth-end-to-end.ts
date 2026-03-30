import "dotenv/config";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = `test-${Date.now()}@example.com`;
  const password = "password123";
  const username = `testuser_${Date.now()}`;

  console.log(`--- Testing Registration & Verification for ${email} ---`);
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
    headers: { "Content-Type": "application/json" },
  });
  const regData = await regRes.json();
  console.log("Registration Response:", regData);

  // Check DB for verification token
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });

  if (user?.emailVerifyToken) {
    console.log("Verification token found:", user.emailVerifyToken);
    console.log("Testing verify-email flow...");
    const verifyRes = await fetch(`http://localhost:3000/api/auth/verify-email?token=${user.emailVerifyToken}`);
    const verifyData = await verifyRes.json();
    console.log("Verify Email Response:", verifyData);

    // Final check
    const verifiedUser = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, email),
    });
    console.log("Is user verified in DB?", verifiedUser?.isEmailVerified);
  } else {
    console.log("ERROR: No email verification token found in DB.");
  }
}

main();
