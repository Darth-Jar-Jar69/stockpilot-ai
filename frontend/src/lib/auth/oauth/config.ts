import type { OAuthProvider } from "@/lib/auth/oauth/types";

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getOAuthRedirectUri(provider: OAuthProvider): string {
  return `${getAppUrl()}/api/auth/oauth/${provider}/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return provider === "google" && isGoogleOAuthConfigured();
}

export function getConfiguredProviders(): OAuthProvider[] {
  return isGoogleOAuthConfigured() ? ["google"] : [];
}
