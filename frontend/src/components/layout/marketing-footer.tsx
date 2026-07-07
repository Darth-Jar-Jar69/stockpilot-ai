import { Logo } from "@/components/layout/logo";
import { SITE_NAME } from "@/lib/branding";

/**
 * Marketing site footer — branding and legal disclaimer snippet.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <Logo showTagline />
          <p className="max-w-xl text-xs text-muted-foreground">
            AI-powered probabilistic estimates only — not financial advice. Past performance does not
            guarantee future results. Always conduct your own due diligence.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
