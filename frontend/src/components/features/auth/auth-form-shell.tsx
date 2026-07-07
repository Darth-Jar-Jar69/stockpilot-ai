import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { AI_ASSISTANT_LABEL, SITE_TAGLINE } from "@/lib/branding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Branded wrapper for custom auth forms. */
export function AuthFormShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-border/60 bg-card/90 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-3 text-center">
          <Link href="/" className="mx-auto inline-flex">
            <Logo showTagline />
          </Link>
          <p className="text-xs font-medium text-primary">{SITE_TAGLINE}</p>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">{title}</CardTitle>
          <CardDescription className="text-base leading-relaxed text-slate-300">
            {description}
          </CardDescription>
          <p className="text-xs text-slate-500">{AI_ASSISTANT_LABEL}</p>
        </CardHeader>
        <CardContent className="space-y-6">{children}</CardContent>
        {footer && (
          <div className="border-t border-border/50 px-6 py-4 text-center text-sm text-slate-400">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
}

export function AuthFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-400">{message}</p>;
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="font-medium text-primary hover:text-primary/80">
      {children}
    </Link>
  );
}
