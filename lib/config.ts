import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string().min(1),
  WALLET_MASTER_MNEMONIC: z.string().refine(
    (m) => m.split(" ").length >= 12,
    "Mnemonic must be at least 12 words"
  ),
  BSC_TESTNET_RPC_URL: z.string().url().optional().default("https://bsc-testnet-rpc.publicnode.com"),
  // Optional: shared secret for /api/webhooks/blockchain (set when connecting Alchemy/Moralis)
  WEBHOOK_SECRET: z.string().min(16).optional(),
  WORKER_SECRET: z.string().min(10).optional().default("development_secret_only"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    console.log("✅ Env validated successfully. WORKER_SECRET is defined:", !!parsed.WORKER_SECRET);
    return parsed;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const missingKeys = err.issues.map((issue: any) => issue.path.join(".")).join(", ");
      console.error(
        "\x1b[31m%s\x1b[0m",
        `❌ Missing or invalid environment variables: ${missingKeys}`
      );
      console.error(
        "\x1b[33m%s\x1b[0m",
        "Make sure to set these in your .env file."
      );
      process.exit(1);
    }
    throw err;
  }
}

export const env = validateEnv();
