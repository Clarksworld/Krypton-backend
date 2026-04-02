import { NextResponse } from "next/server";
import { ok } from "@/lib/errors";

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout
 *     description: Logout the authenticated user.
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST() {
  const response = ok({ message: "Logged out successfully" });

  // Clear the cookie
  response.cookies.set("krypton_token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
