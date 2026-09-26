import { PageContainer } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/site";

export default function RunNotFound() {
  return (
    <PageContainer>
      <Card>
        <EmptyState
          title="Run not found"
          description="Runs started from New split appear here. This one doesn't exist or belongs to another account."
          action={
            <ButtonLink href={routes.newSplit()} variant="secondary">
              New split
            </ButtonLink>
          }
        />
      </Card>
    </PageContainer>
  );
}
