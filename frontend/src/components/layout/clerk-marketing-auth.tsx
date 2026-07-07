"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

/** Clerk-powered auth buttons for the marketing header. */
export function ClerkMarketingAuth() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <Button size="sm" asChild>
          <Link href="/sign-up">Get started</Link>
        </Button>
      </SignedOut>
      <SignedIn>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
