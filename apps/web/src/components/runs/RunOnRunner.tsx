"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/site";
import type { RunJobSummary, RunnerInfo } from "@/lib/types";
import { startRunAction } from "@/server/actions/runs";
import type { ActionResult } from "@/server/actions/stacks";

const initial: ActionResult = { error: null };

const statusText: Record<RunJobSummary["status"], string> = {
  queued: "waiting for a runner",
  running: "running",
  succeeded: "finished",
  failed: "failed",
  cancelled: "cancelled",
};

/**
 * Queue the selected pull request for the user's runner (`cleave runner` on their machine).
 * The button only claims what's true: which runner is online, or that none is yet.
 */
export function RunOnRunner({
  repoId,
  prNumber,
  runners,
  latest,
  siteUrl,
}: {
  repoId: string;
  prNumber: number;
  runners: RunnerInfo[];
  latest: RunJobSummary | null;
  siteUrl: string;
}) {
  const [state, action, pending] = useActionState(startRunAction, initial);
  const online = runners.filter((r) => r.online);

  return (
    <form action={action} className="rounded-xl border border-line bg-canvas px-4 py-4">
      <input type="hidden" name="repoId" value={repoId} />
      <input type="hidden" name="prNumber" value={prNumber} />
      <p className="text-[14px] font-medium text-ink">Run it from here</p>
      {online.length ? (
        <p className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
          <span className="size-2 rounded-full bg-ok" aria-hidden="true" />
          {online.map((r) => r.name).join(", ")} {online.length === 1 ? "is" : "are"} online
        </p>
      ) : (
        <div className="mt-1 space-y-2.5">
          <p className="text-[13px] text-ink-3">
            No runner is connected. Start one on your machine with a runner token; it clones the repository, runs ✂ Cleave
            with <code className="font-mono text-[12px]">bob run</code> and sends the result here.
          </p>
          <CodeBlock code={`export CLEAVE_URL=${siteUrl} CLEAVE_TOKEN=clv_…\ncleave runner`} wrap />
        </div>
      )}
      <Button type="submit" size="sm" className="mt-3.5" loading={pending} icon={<Play className="size-3.5" />}>
        {online.length ? `Run on ${online[0]!.name}` : "Queue for my runner"}
      </Button>
      {!online.length ? <p className="mt-2 text-[12px] text-ink-3">A queued run starts when a runner connects.</p> : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-[13px] text-bad">
          {state.error}
        </p>
      ) : null}
      {latest ? (
        <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-3">
          Latest run for this pull request:{" "}
          <Link href={routes.run(latest.id)} className="font-medium text-ink underline-offset-2 hover:underline">
            {statusText[latest.status]}
          </Link>
        </p>
      ) : null}
    </form>
  );
}
