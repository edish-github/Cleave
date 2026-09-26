import { ArrowUpRight, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { RunnerTokens, type RunnerView } from "@/components/settings/RunnerTokens";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { ButtonLink } from "@/components/ui/Button";
import { Diamond } from "@/components/ui/Diamond";
import { commands } from "@/content/bob";
import { timeAgo } from "@/lib/format";
import { routes, site } from "@/lib/site";
import { liveSession } from "@/server/auth";
import { db, schema } from "@/server/db/client";
import { requestNow } from "@/server/queries";

export const metadata: Metadata = { title: "Bob & runners" };

const sampleTokenCopy = {
  title: "Runner tokens belong to a GitHub account",
  description:
    "The sample workspace has no account behind it. Sign in with GitHub to create a token and push real runs with cleave push.",
};

async function runnersFor(userId: string): Promise<RunnerView[]> {
  const now = requestNow();
  const rows = await db().select().from(schema.runners).where(eq(schema.runners.userId, userId)).orderBy(desc(schema.runners.createdAt));
  return rows
    .filter((r) => !r.revokedAt)
    .map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.tokenPrefix,
      createdLabel: timeAgo(r.createdAt.toISOString(), now),
      lastSeenLabel: r.lastSeenAt ? timeAgo(r.lastSeenAt.toISOString(), now) : null,
      bobVersion: r.bobVersion,
    }));
}

export default async function RunnersSettingsPage() {
  const session = await liveSession();
  const runners = session ? await runnersFor(session.user.id) : null;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Bob IDE"
        description="Split changes where you work: the ✂ Cleave mode plans the layers in Bob IDE, then cleave push sends the run here."
        footer={
          <>
            <p className="text-[13px] text-ink-3">Mode, MCP server and hooks install with one command.</p>
            <ButtonLink href={routes.bobDocs} variant="secondary" size="sm" trailingIcon={<ArrowUpRight className="size-3.5" />}>
              Setup guide
            </ButtonLink>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CodeBlock title="In your repository" code={commands.init} />
          <CodeBlock title="After a run in Bob IDE" code={commands.push} wrap />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Runner tokens"
        description="A token lets cleave push (and later the runner) send runs to your account. Runs execute on your machine with your own Bob Shell login, git and gh credentials; no secrets reach Cleave."
        footer={
          runners ? undefined : (
            <>
              <p className="text-[13px] text-ink-3">Each token is shown once and stored only as a hash.</p>
              <BackendRequiredButton variant="primary" size="sm" icon={<KeyRound className="size-3.5" />} {...sampleTokenCopy}>
                Create token
              </BackendRequiredButton>
            </>
          )
        }
      >
        {runners ? (
          <RunnerTokens runners={runners} siteUrl={site.url} />
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-8 text-center">
            <Diamond className="size-6 text-ink-3" />
            <p className="mt-3 text-[14px] font-medium text-ink">No tokens in the sample workspace</p>
            <p className="mt-1 max-w-[360px] text-[13px] text-ink-3">
              Sign in with GitHub to create one. Tokens show up here with when they were last used.
            </p>
          </div>
        )}
        <div className="mt-4 space-y-3">
          <CodeBlock title="Send a finished run" code={`CLEAVE_URL=${site.url} CLEAVE_TOKEN=clv_… ${commands.push}`} wrap />
          <CodeBlock title="What the runner will call (P1)" code={commands.headless} wrap />
        </div>
      </SettingsSection>
    </div>
  );
}
