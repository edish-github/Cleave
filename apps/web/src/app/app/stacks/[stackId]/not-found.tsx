import { PageContainer } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/site";

export default function StackNotFound() {
  return (
    <PageContainer>
      <Card>
        <EmptyState
          title="This stack doesn't exist"
          description="It may have been removed, or the link is wrong. Your other stacks are all in one list."
          action={
            <ButtonLink href={routes.stacks} variant="secondary">
              All stacks
            </ButtonLink>
          }
        />
      </Card>
    </PageContainer>
  );
}
