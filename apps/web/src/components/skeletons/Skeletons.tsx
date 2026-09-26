import { PageContainer } from "@/components/layout/PageHeader";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** Skeletons mirror the real layouts so content doesn't jump when it arrives. */

export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-10 w-32 rounded-full" /> : null}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-y-6 rounded-2xl border border-line bg-surface px-6 py-6 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-3 md:px-6">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <PageContainer width="wide">
      <LoadingRegion label={label}>
        <HeaderSkeleton />
        <div className="mt-8 space-y-10">
          <StatsSkeleton />
          <RowsSkeleton />
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}

export function StackContentSkeleton() {
  return (
    <LoadingRegion label="Loading stack">
      <div className="space-y-10">
        <Skeleton className="h-[104px] w-full rounded-2xl" />
        <StatsSkeleton />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RowsSkeleton rows={5} />
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function StackPageSkeleton() {
  return (
    <PageContainer width="wide">
      <LoadingRegion label="Loading stack">
        <Skeleton className="h-4 w-16" />
        <div className="mt-4">
          <HeaderSkeleton />
        </div>
        <div className="mt-8 flex gap-6 border-b border-line pb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        <div className="pt-8">
          <div className="space-y-10">
            <Skeleton className="h-[104px] w-full rounded-2xl" />
            <StatsSkeleton />
            <RowsSkeleton />
          </div>
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}
