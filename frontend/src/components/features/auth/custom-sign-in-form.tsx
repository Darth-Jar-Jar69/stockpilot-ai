"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AuthFieldError,
  AuthFormShell,
  AuthLink,
} from "@/components/features/auth/auth-form-shell";
import { OAuthButtons } from "@/components/features/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Sign in with email and password — no third-party auth required. */
export function CustomSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const urlError = searchParams.get("error");
  const displayError =
    errorMessage ??
    (urlError === "oauth_failed"
      ? "Social sign-in failed. Try again or use email."
      : urlError === "google_invalid_client_secret"
        ? "Google client secret is invalid. Create a new secret in Google Cloud Console and update GOOGLE_CLIENT_SECRET in .env.local, then restart the dev server."
        : urlError === "google_not_configured"
          ? "Google sign-in is not configured yet."
          : urlError === "oauth_cancelled"
            ? "Sign-in was cancelled."
            : urlError?.startsWith("google_token_exchange_failed")
              ? "Google sign-in failed during token exchange. Try again."
              : urlError
                ? decodeURIComponent(urlError)
                : undefined);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(undefined);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Unable to sign in.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Welcome back"
      description="Sign in with email or Google."
      footer={
        <>
          Don&apos;t have an account? <AuthLink href="/sign-up">Sign up</AuthLink>
        </>
      }
    >
      <OAuthButtons />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-200">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="border-border/60 bg-secondary/80 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-200">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            className="border-border/60 bg-secondary/80 text-white placeholder:text-slate-500"
          />
        </div>

        <AuthFieldError message={displayError} />

        <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthFormShell>
  );
}
