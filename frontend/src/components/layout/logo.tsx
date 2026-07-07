import { BarChart3 } from "lucide-react";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function Logo({
  showTagline = false,
  className,
}: {
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <BarChart3 className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <span className="font-semibold tracking-tight text-foreground">{SITE_NAME}</span>
        {showTagline && (
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {SITE_TAGLINE}
          </p>
        )}
      </div>
    </div>
  );
}
