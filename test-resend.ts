import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { randomInt } from "crypto";

async function test() {
  try {
    const email = "emmaclarkworld@gmail.com";
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    console.log("User:", user);
    
    if (user && !user.isEmailVerified) {
      const emailVerifyToken = randomInt(100000, 999999).toString();
      console.log("Token:", emailVerifyToken);
      await db
        .update(users)
        .set({
          emailVerifyToken,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      console.log("Updated db");
    }
  } catch (e) {
    console.error("Error:", e);
  }
}
test().then(() => process.exit(0));
