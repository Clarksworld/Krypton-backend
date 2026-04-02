import { NextRequest } from "next/server";
import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const addBankSchema = z.object({
  bankName: z.string(),
  accountName: z.string(),
  accountNumber: z.string(),
});

/**
 * @swagger
 * /api/bank-accounts:
 *   get:
 *     summary: List Bank Accounts
 *     description: Retrieve all linked fiat bank accounts for the user.
 *     tags: [Fiat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const accounts = await db.query.bankAccounts.findMany({
      where: (b, { eq }) => eq(b.userId, userId),
      orderBy: (b, { desc }) => [desc(b.isDefault), desc(b.createdAt)],
    });

    return ok({ bankAccounts: accounts });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/bank-accounts:
 *   post:
 *     summary: Add Bank Account
 *     description: Link a new fiat bank account for withdrawals.
 *     tags: [Fiat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankName, accountName, accountNumber]
 *             properties:
 *               bankName: { type: string, example: "Chase Bank" }
 *               accountName: { type: string, example: "John Doe" }
 *               accountNumber: { type: string, example: "1234567890" }
 *     responses:
 *       200:
 *         description: Bank account added successfully
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const data = validate(addBankSchema, body);

    // Check if it's their first account to set as default
    const existing = await db.query.bankAccounts.findMany({
      where: (b, { eq }) => eq(b.userId, userId),
    });

    const isDefault = existing.length === 0;

    const [account] = await db.insert(bankAccounts).values({
      userId,
      ...data,
      isDefault
    }).returning();

    return ok({ account, message: "Bank account added successfully" });
  } catch (error) {
    return handleError(error);
  }
}
