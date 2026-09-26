import { PageContainer } from "@/components/layout/PageHeader";
import { CardsSkeleton, HeaderSkeleton, RowsSkeleton } from "@/components/skeletons/Skeletons";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageContainer width="wide">
      <LoadingRegion label="Loading pull requests">
        <HeaderSkeleton withAction={false} />
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-10">
            <CardsSkeleton />
            <RowsSkeleton rows={3} />
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}
