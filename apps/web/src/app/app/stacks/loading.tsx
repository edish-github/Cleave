import { PageContainer } from "@/components/layout/PageHeader";
import { HeaderSkeleton, RowsSkeleton } from "@/components/skeletons/Skeletons";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageContainer width="wide">
      <LoadingRegion label="Loading stacks">
        <HeaderSkeleton />
        <div className="mt-8 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-80 max-w-full rounded-full" />
          <Skeleton className="hidden h-9 w-64 rounded-full sm:block" />
        </div>
        <div className="mt-5">
          <RowsSkeleton rows={6} />
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}
