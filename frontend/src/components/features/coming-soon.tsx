import type { Metadata } from "next";
import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Reusable placeholder for dashboard routes not yet implemented.
 * Keeps sidebar navigation working during incremental development.
 */
export function ComingSoon({
  title,
  description,
  milestone,
}: {
  title: string;
  description: string;
  milestone?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md glass border-border/50 text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Construction className="h-6 w-6" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {milestone && (
          <CardContent>
            <p className="text-xs text-muted-foreground">Planned in {milestone}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** Factory for consistent metadata on placeholder pages. */
export function comingSoonMetadata(title: string): Metadata {
  return { title };
}
