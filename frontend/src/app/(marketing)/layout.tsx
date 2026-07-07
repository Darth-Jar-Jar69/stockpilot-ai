import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingHeader } from "@/components/layout/marketing-header";

/** Public marketing pages — header + footer chrome, no sidebar. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-40" aria-hidden />
      <MarketingHeader />
      <div className="relative pt-16">{children}</div>
      <MarketingFooter />
    </div>
  );
}
