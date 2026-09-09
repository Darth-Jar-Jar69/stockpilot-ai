"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  AuthFieldError,
  AuthFormShell,
  AuthLink,
} from "@/components/features/auth/auth-form-shell";
import { OAuthButtons } from "@/components/features/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "register" | "verify";

/** Sign up with email, password, and a 6-digit email verification code. */
export function CustomSignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("register");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(undefined);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const firstName = String(form.get("firstName") ?? "").trim();

    setEmail(emailAddress);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress, password, firstName }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Unable to create account.");
        return;
      }

      if (data.devCode) setDevCode(String(data.devCode));
      setStep("verify");
    } catch {
      setErrorMessage("Unable to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(undefined);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Invalid verification code.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Verification failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "verify") {
    return (
      <AuthFormShell
        title="Verify your email"
        description={`Enter the 6-digit code sent to ${email}`}
        footer={
          <>
            Wrong email?{" "}
            <button
              type="button"
              className="font-medium text-primary hover:text-primary/80"
              onClick={() => {
                setStep("register");
                setVerificationCode("");
                setDevCode(undefined);
                setErrorMessage(undefined);
              }}
            >
              Start over
            </button>
          </>
        }
      >
        {devCode ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-slate-200">
            <span className="font-medium text-white">Your code:</span>{" "}
            <span className="font-mono text-lg tracking-widest text-primary">{devCode}</span>
            <p className="mt-1 text-xs text-slate-400">
              Email delivery isn&apos;t configured on the server yet, so the code is shown here.
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-border/50 bg-secondary/40 px-4 py-3 text-sm text-slate-300">
            We emailed a 6-digit code to <span className="text-white">{email}</span>. Check inbox
            and spam.
          </p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-slate-200">
              Verification code
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              required
              maxLength={6}
              className="border-border/60 bg-secondary/80 text-center font-mono text-lg tracking-widest text-white placeholder:text-slate-500"
            />
          </div>

          <AuthFieldError message={errorMessage} />

          <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
            {isSubmitting ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      title="Create your account"
      description="Email verification, or sign up instantly with Google."
      footer={
        <>
          Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
    >
      <OAuthButtons />

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-slate-200">
            First name
          </Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            placeholder="Alex"
            className="border-border/60 bg-secondary/80 text-white placeholder:text-slate-500"
          />
        </div>

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
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="border-border/60 bg-secondary/80 text-white placeholder:text-slate-500"
          />
        </div>

        <AuthFieldError message={errorMessage} />

        <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? "Sending code…" : "Continue"}
        </Button>
      </form>
    </AuthFormShell>
  );
}
