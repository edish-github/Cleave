import { PageContainer } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/site";

export default function RepositoryNotFound() {
  return (
    <PageContainer>
      <Card>
        <EmptyState
          title="This repository isn't connected"
          description="It may have been disconnected, or the link is wrong."
          action={
            <ButtonLink href={routes.repositories} variant="secondary">
              All repositories
            </ButtonLink>
          }
        />
      </Card>
    </PageContainer>
  );
}
