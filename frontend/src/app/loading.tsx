import { Skeleton } from "@/components/ui/skeleton";

/** Root-level loading UI shown during initial route transitions. */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
