import { Skeleton } from "@/components/ui/skeleton";

/** Landing page skeleton while marketing content streams in. */
export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-24 sm:px-6 lg:px-8">
      <div className="space-y-6 text-center">
        <Skeleton className="mx-auto h-8 w-48 rounded-full" />
        <Skeleton className="mx-auto h-16 w-full max-w-3xl" />
        <Skeleton className="mx-auto h-6 w-full max-w-2xl" />
        <div className="flex justify-center gap-4 pt-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
