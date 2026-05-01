import { db } from "./db";
import { users } from "./db/schema/users";
import { eq } from "drizzle-orm";

async function checkUser() {
  const email = "kryptonadmin@gmail.com";
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });

  if (user) {
    console.log(`User ${email}: isAdmin=${user.isAdmin}, isEmailVerified=${user.isEmailVerified}`);
  } else {
    console.log(`User ${email} not found`);
  }
  process.exit(0);
}

checkUser().catch(console.error);
