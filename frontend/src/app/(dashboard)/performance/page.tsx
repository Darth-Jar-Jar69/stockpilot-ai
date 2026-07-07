import { ComingSoon, comingSoonMetadata } from "@/components/features/coming-soon";

export const metadata = comingSoonMetadata("Performance");

export default function PerformancePage() {
  return (
    <ComingSoon
      title="Performance"
      description="Portfolio returns, benchmarks, and historical performance charts."
      milestone="Milestone 7"
    />
  );
}
