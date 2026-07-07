import { getOAuthRedirectUri } from "@/lib/auth/oauth/config";
import type { OAuthProfile } from "@/lib/auth/oauth/types";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdTokenPayload = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

function decodeJwtPayload<T>(token: string): T {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Google id_token is malformed.");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}

export function getGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOAuthRedirectUri("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleGoogleCallback(code: string): Promise<OAuthProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("google_not_configured");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getOAuthRedirectUri("google"),
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok) {
    if (tokens.error === "invalid_client") {
      throw new Error("google_invalid_client_secret");
    }
    const detail = tokens.error_description ?? tokens.error ?? "unknown";
    throw new Error(`google_token_exchange_failed:${detail}`);
  }

  if (tokens.id_token) {
    const user = decodeJwtPayload<GoogleIdTokenPayload>(tokens.id_token);
    if (!user.email) {
      throw new Error("Google account has no email.");
    }

    return {
      provider: "google",
      providerAccountId: user.sub,
      email: user.email,
      firstName: user.name?.split(" ")[0],
      image: user.picture,
    };
  }

  if (!tokens.access_token) {
    throw new Error("google_token_exchange_failed:missing_access_token");
  }

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Google user info failed.");
  }

  const user = (await userRes.json()) as GoogleUserInfo;
  if (!user.email) {
    throw new Error("Google account has no email.");
  }

  return {
    provider: "google",
    providerAccountId: user.sub,
    email: user.email,
    firstName: user.name?.split(" ")[0],
    image: user.picture,
  };
}
