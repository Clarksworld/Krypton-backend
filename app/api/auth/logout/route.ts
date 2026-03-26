import { NextResponse } from "next/server";
import { ok } from "@/lib/errors";

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
