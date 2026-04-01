import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicAuthRoutes = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/password/forgot",
    "/api/auth/password/reset",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
    "/api/workers",
    "/api/webhooks",
  ];

  const isPublicRoute = publicAuthRoutes.some((route) => pathname.startsWith(route));

  // Only protect /api routes, but exclude strictly public endpoints
  if (pathname.startsWith("/api") && !isPublicRoute) {
    const token = request.cookies.get("krypton_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const payload = await verifyToken(token);
      // Add user ID to headers so downstream route handlers can use it
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", payload.sub);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error("JWT verification failed:", error);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
