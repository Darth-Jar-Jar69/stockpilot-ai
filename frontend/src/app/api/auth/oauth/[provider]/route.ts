import { NextResponse } from "next/server";

import { getAuthorizationUrl } from "@/lib/auth/oauth";
import { isProviderConfigured } from "@/lib/auth/oauth/config";
import { createOAuthState, oauthStateCookieOptions } from "@/lib/auth/oauth/state";
import { isOAuthProvider } from "@/lib/auth/oauth/types";

type RouteContext = { params: Promise<{ provider: string }> };

/** Start OAuth flow — redirects to Google. */
export async function GET(request: Request, context: RouteContext) {
  const { provider: raw } = await context.params;
  if (!isOAuthProvider(raw)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  if (!isProviderConfigured(raw)) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(`${raw} sign-in is not configured yet.`)}`,
        request.url,
      ),
    );
  }

  const state = await createOAuthState(raw);
  const response = NextResponse.redirect(getAuthorizationUrl(raw, state));
  response.cookies.set(oauthStateCookieOptions(state));
  return response;
}
