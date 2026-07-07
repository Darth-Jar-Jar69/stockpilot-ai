export type OAuthProvider = "google";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  firstName?: string;
  image?: string;
};

export const OAUTH_PROVIDERS: OAuthProvider[] = ["google"];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return OAUTH_PROVIDERS.includes(value as OAuthProvider);
}
