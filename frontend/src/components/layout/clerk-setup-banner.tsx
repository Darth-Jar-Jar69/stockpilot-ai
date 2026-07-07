import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown when Clerk env vars are missing — guides developers through setup
 * without crashing the app during initial scaffold.
 */
export function ClerkSetupBanner() {
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Clerk not configured.</strong> Copy{" "}
            <code className="rounded bg-black/30 px-1">.env.example</code> to{" "}
            <code className="rounded bg-black/30 px-1">.env.local</code> and add your keys from{" "}
            <a
              href="https://dashboard.clerk.com"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              dashboard.clerk.com
            </a>
            .
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 border-amber-500/40" asChild>
          <Link href="https://dashboard.clerk.com" target="_blank" rel="noreferrer">
            Get API keys
          </Link>
        </Button>
      </div>
    </div>
  );
}
