import { PageContainer } from "@/components/layout/PageHeader";
import { HeaderSkeleton, RowsSkeleton } from "@/components/skeletons/Skeletons";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageContainer width="wide">
      <LoadingRegion label="Loading repository">
        <Skeleton className="h-4 w-24" />
        <div className="mt-4">
          <HeaderSkeleton />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RowsSkeleton rows={4} />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}
