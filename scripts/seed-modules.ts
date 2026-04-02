import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const sql = postgres(process.env.DATABASE_URL!);

async function run() {
  console.log("Seeding subscription plans and tasks...");

  // Subscription Plans
  await sql`
    INSERT INTO subscription_plans (name, description, price_usdt, duration_days, features, is_active)
    VALUES
      ('Basic', 'Enhanced trading limits and priority support', 9.99, 30, ARRAY['2x withdrawal limit','Priority support','No ads'], true),
      ('Pro', 'Full access to advanced trading features', 24.99, 30, ARRAY['5x withdrawal limit','Advanced P2P tools','API access','Priority support'], true),
      ('VIP', 'Maximum limits and dedicated account manager', 79.99, 30, ARRAY['Unlimited withdrawals','VIP P2P desk','Dedicated manager','Zero swap fees','Early features'], true)
    ON CONFLICT DO NOTHING
  `;
  console.log("✅ Subscription plans seeded");

  // Sample Tasks
  await sql`
    INSERT INTO tasks (title, description, reward_amount, is_active)
    VALUES
      ('Complete Your Profile', 'Fill in all profile fields including avatar and country.', 5.0, true),
      ('Enable 2FA Security', 'Set up two-factor authentication to protect your account.', 10.0, true),
      ('Submit KYC Documents', 'Complete identity verification to unlock higher limits.', 25.0, true),
      ('Make Your First Deposit', 'Fund your wallet with any supported crypto asset.', 15.0, true),
      ('Complete Your First Trade', 'Execute a buy or sell on the P2P marketplace.', 20.0, true),
      ('Add a Bank Account', 'Link a bank account for instant fiat withdrawals.', 5.0, true),
      ('Invite a Friend', 'Share your referral link and earn rewards together.', 30.0, true)
    ON CONFLICT DO NOTHING
  `;
  console.log("✅ Tasks seeded");

  console.log("\n🎉 All seed data applied!");
  await sql.end();
  process.exit(0);
}

run().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
