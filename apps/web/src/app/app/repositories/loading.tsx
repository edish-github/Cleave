import { PageContainer } from "@/components/layout/PageHeader";
import { CardsSkeleton, HeaderSkeleton } from "@/components/skeletons/Skeletons";
import { LoadingRegion } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageContainer width="wide">
      <LoadingRegion label="Loading repositories">
        <HeaderSkeleton />
        <div className="mt-8">
          <CardsSkeleton />
        </div>
      </LoadingRegion>
    </PageContainer>
  );
}
