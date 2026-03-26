import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback_dev_secret");
const ALG = "HS256";
const EXPIRY = "7d";

export interface JwtPayload {
  sub: string;  // user id
  email: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}

/**
 * Extracts the user ID from the request headers (set by middleware)
 */
export function getUserId(req: Request | Headers): string {
  const headers = req instanceof Headers ? req : req.headers;
  const userId = headers.get("x-user-id");
  if (!userId) {
    throw new Error("User ID not found in headers. Is the route protected?");
  }
  return userId;
}
