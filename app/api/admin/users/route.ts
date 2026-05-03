import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { users, userProfiles } from "@/db/schema";
import { ilike, or, desc, count, eq, and } from "drizzle-orm";

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
    const kycStatus = searchParams.get("kycStatus");
    const isAdminParam = searchParams.get("isAdmin");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.username, `%${search}%`)
        )
      );
    }

    if (kycStatus) {
      conditions.push(eq(userProfiles.kycStatus, kycStatus));
    }

    if (isAdminParam !== null) {
      conditions.push(eq(users.isAdmin, isAdminParam === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalRow] = await db
      .select({ total: count() })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(whereClause);

    const total = Number(totalRow.total);

    // Get users with profile info
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        isEmailVerified: users.isEmailVerified,
        isTwoFactorEnabled: users.isTwoFactorEnabled,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        profile: {
          fullName: userProfiles.fullName,
          kycLevel: userProfiles.kycLevel,
          kycStatus: userProfiles.kycStatus,
          avatarUrl: userProfiles.avatarUrl,
        },
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return ok({
      users: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
