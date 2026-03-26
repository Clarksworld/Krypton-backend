import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    const list = await db.query.transactions.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      with: {
        asset: true,
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return ok({ transactions: list });
  } catch (err) {
    return handleError(err);
  }
}
