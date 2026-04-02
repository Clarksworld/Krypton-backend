import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { users, userProfiles } from "@/db/schema";
import { ilike, or, desc } from "drizzle-orm";

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Admin — List Users
 *     description: Search and paginate all registered users.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by email or username
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Admin access required
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const offset = (page - 1) * limit;

    const allUsers = await db.query.users.findMany({
      where: search
        ? (u, { or, ilike }) =>
            or(ilike(u.email, `%${search}%`), ilike(u.username!, `%${search}%`))
        : undefined,
      with: { profile: true },
      columns: {
        id: true,
        email: true,
        username: true,
        isEmailVerified: true,
        isTwoFactorEnabled: true,
        isAdmin: true,
        createdAt: true,
      },
      orderBy: (u, { desc }) => [desc(u.createdAt)],
      limit,
      offset,
    });

    return ok({ users: allUsers, page, limit });
  } catch (error) {
    return handleError(error);
  }
}
