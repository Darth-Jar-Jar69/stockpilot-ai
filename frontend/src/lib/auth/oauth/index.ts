import { isProviderConfigured } from "@/lib/auth/oauth/config";
import { getGoogleAuthUrl, handleGoogleCallback } from "@/lib/auth/oauth/google";
import type { OAuthProfile, OAuthProvider } from "@/lib/auth/oauth/types";

export function getAuthorizationUrl(provider: OAuthProvider, state: string): string {
  if (provider !== "google") {
    throw new Error(`${provider} OAuth is not supported.`);
  }
  return getGoogleAuthUrl(state);
}

export async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string,
): Promise<OAuthProfile> {
  if (!isProviderConfigured(provider)) {
    throw new Error(`${provider} OAuth is not configured.`);
  }

  if (provider !== "google") {
    throw new Error(`${provider} OAuth is not supported.`);
  }

  return handleGoogleCallback(code);
}
