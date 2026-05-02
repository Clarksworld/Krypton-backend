import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") || "*";

  // Handle preflight OPTIONS requests for CORS
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
      },
    });
  }

  const publicAuthRoutes = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/password/forgot",
    "/api/auth/password/reset",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
    "/api/admin/auth/login",
    "/api/admin/auth/register",
    "/api/workers",
    "/api/webhooks",
  ];

  const isPublicRoute = publicAuthRoutes.some((route) => pathname.startsWith(route));

  let response = NextResponse.next();

  // Only protect /api routes, but exclude strictly public endpoints
  if (pathname.startsWith("/api") && !isPublicRoute) {
    let token = request.cookies.get("krypton_token")?.value;

    // Fallback: Check Authorization header if cookie is missing
    if (!token) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      try {
        const payload = await verifyToken(token);
        // Add user ID to headers so downstream route handlers can use it
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", payload.sub);
        if ((payload as any).role) {
          requestHeaders.set("x-user-role", (payload as any).role);
        }

        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      } catch (error) {
        console.error("JWT verification failed:", error);
        response = NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }
  }

  // Add CORS headers to all responses if an Origin is present
  if (request.headers.get("origin")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
