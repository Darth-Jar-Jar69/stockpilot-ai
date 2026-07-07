/**
 * Clerk configuration helpers.
 */

/** Publishable key from environment — required for ClerkProvider. */
export function getClerkPublishableKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key || key.includes("placeholder")) return undefined;
  return key;
}

/** True when Clerk publishable key is available. */
export function isClerkConfigured(): boolean {
  const key = getClerkPublishableKey();
  return Boolean(key?.startsWith("pk_"));
}
