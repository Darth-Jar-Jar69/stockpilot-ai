import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { MarketingAuth } from "@/components/layout/marketing-auth";

/** Marketing site header — logo, nav links, and auth controls. */
export function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Logo showTagline />
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#disclaimer" className="transition-colors hover:text-foreground">
            Disclaimer
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <MarketingAuth />
        </div>
      </div>
    </header>
  );
}
