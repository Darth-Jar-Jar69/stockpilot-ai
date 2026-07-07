import { randomUUID } from "crypto";

import { SignJWT, jwtVerify } from "jose";

const OAUTH_STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE = 60 * 10;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "stockpilot-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function createOAuthState(provider: string): Promise<string> {
  const nonce = randomUUID();
  return new SignJWT({ provider, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifyOAuthState(
  state: string,
  expectedProvider: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(state, getSecret());
    return payload.provider === expectedProvider && typeof payload.nonce === "string";
  } catch {
    return false;
  }
}

export function oauthStateCookieOptions(state: string) {
  return {
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: STATE_MAX_AGE,
  };
}

export function clearOAuthStateCookie() {
  return {
    name: OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function readOAuthStateCookie(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${OAUTH_STATE_COOKIE}=([^;]+)`));
  return match?.[1];
}
