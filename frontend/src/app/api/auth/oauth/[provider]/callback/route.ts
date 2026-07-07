import { NextResponse } from "next/server";

import {
  clearOAuthStateCookie,
  readOAuthStateCookie,
  verifyOAuthState,
} from "@/lib/auth/oauth/state";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth/user";
import { isOAuthProvider } from "@/lib/auth/oauth/types";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ provider: string }> };

async function completeOAuth(
  request: Request,
  provider: string,
  code: string | null,
  state: string | null,
) {
  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_provider", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_cancelled", request.url));
  }

  const cookieState = readOAuthStateCookie(request);
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_state_mismatch", request.url));
  }

  const valid = await verifyOAuthState(state, provider);
  if (!valid) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_state_expired", request.url));
  }

  try {
    const { handleOAuthCallback } = await import("@/lib/auth/oauth");
    const profile = await handleOAuthCallback(provider, code);
    const user = await findOrCreateOAuthUser(profile);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
    });

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set(sessionCookieOptions(token));
    response.cookies.set(clearOAuthStateCookie());
    return response;
  } catch (error) {
    console.error("OAuth callback failed:", error);
    const message = error instanceof Error ? error.message : "oauth_failed";
    const errorCode = message.startsWith("google_") ? message : "oauth_failed";
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(errorCode)}`, request.url));
  }
}

/** OAuth callback (Google uses GET). */
export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const { searchParams } = new URL(request.url);
  return completeOAuth(request, provider, searchParams.get("code"), searchParams.get("state"));
}
