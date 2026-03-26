import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api routes, but exclude auth endpoints
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
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
