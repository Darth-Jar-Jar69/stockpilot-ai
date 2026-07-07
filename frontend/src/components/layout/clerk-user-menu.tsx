"use client";

import { UserButton } from "@clerk/nextjs";

/** Clerk user menu for the dashboard sidebar footer. */
export function ClerkUserMenu() {
  return <UserButton afterSignOutUrl="/" />;
}
