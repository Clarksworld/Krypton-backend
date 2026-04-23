import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req); // ensure authenticated

    const url = new URL(req.url);
    const username = url.searchParams.get("username");

    if (!username) {
      throw new ApiError("Username is required", 400);
    }

    // Check if another user has this username
    const existingUser = await db.query.users.findFirst({
      where: (u, { eq, ne, and }) => and(eq(u.username, username), ne(u.id, userId)),
    });

    return ok({ available: !existingUser });
  } catch (err) {
    return handleError(err);
  }
}
