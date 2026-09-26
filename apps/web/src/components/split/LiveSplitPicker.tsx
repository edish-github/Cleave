import { Check, FolderGit2, GitBranch } from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { RunOnRunner } from "@/components/runs/RunOnRunner";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatNumber, plural } from "@/lib/format";
import { routes } from "@/lib/site";
import type { PullRequest, RepositorySummary, RunJobSummary, RunnerInfo } from "@/lib/types";

export interface LivePullRequest extends PullRequest {
  openedLabel: string;
}

function shellQuote(text: string) {
  return `"${text.replace(/(["\\$`])/g, "\\$1")}"`;
}

/**
 * Live New split: choose a repository and an open pull request, then run the split in Bob IDE
 * with commands filled in for that pull request. Selection lives in the URL (?repo=&pr=).
 */
export function LiveSplitPicker({
  repositories,
  selectedRepo,
  pullRequests,
  selectedPr,
  areas,
  pullsNote,
  runners,
  latestRun,
  siteUrl,
}: {
  repositories: RepositorySummary[];
  selectedRepo: RepositorySummary | null;
  pullRequests: LivePullRequest[];
  selectedPr: LivePullRequest | null;
  areas: string[];
  /** Why the pull request list is empty when it isn't GitHub's answer (no token, GitHub error). */
  pullsNote: string | null;
  runners: RunnerInfo[];
  /** The newest browser-started run of the selected pull request. */
  latestRun: RunJobSummary | null;
  siteUrl: string;
}) {
  if (!repositories.length) {
    return (
      <div className="mt-10 rounded-2xl border border-line bg-surface">
        <EmptyState
          title="Connect a repository first"
          description="Choose the GitHub repository whose pull requests you want to split."
          action={<ButtonLink href={routes.repositories}>Connect a repository</ButtonLink>}
        />
      </div>
    );
  }

  const config = selectedRepo?.config;
  const init = config
    ? [
        selectedPr ? `git fetch origin ${selectedPr.branch}` : null,
        `cleave init --check ${shellQuote(config.checkCommand)} --workdir ${config.workingDirectory}${
          config.setupCommand ? ` --setup ${shellQuote(config.setupCommand)}` : ""
        }`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const message = selectedPr ? `Cleave ${selectedPr.branch} onto ${selectedPr.base}` : "";
  const push = selectedPr
    ? `export CLEAVE_URL=${siteUrl} CLEAVE_TOKEN=clv_…\ncleave push --title ${shellQuote(selectedPr.title)} --pr ${selectedPr.number} \\\n  --head-branch ${selectedPr.branch} --base-branch ${selectedPr.base}`
    : "";

  return (
    <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-10">
        <section aria-label="Repository">
          <h2 className="flex items-center gap-3 text-[15px] font-medium text-ink">
            <Step n={1} done={Boolean(selectedRepo)} /> Repository
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {repositories.map((r) => {
              const selected = r.id === selectedRepo?.id;
              return (
                <li key={r.id}>
                  <Link
                    href={routes.newSplit(r.id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex h-full flex-col rounded-2xl border bg-surface p-4 transition-[border-color,box-shadow]",
                      selected ? "border-ink shadow-card" : "border-line hover:border-line-strong",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-canvas text-ink-2">
                        <FolderGit2 className="size-4" />
                      </span>
                      {selected ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-ink text-canvas">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-4 truncate text-[15px] font-medium text-ink">{r.name}</span>
                    <span className="mt-0.5 truncate text-[13px] text-ink-3">{r.owner}</span>
                    <span className="mt-3 text-[12px] text-ink-3">{plural(r.openPullRequests, "open pull request")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Pull request">
          <h2 className="flex items-center gap-3 text-[15px] font-medium text-ink">
            <Step n={2} done={Boolean(selectedPr)} /> Pull request
          </h2>
          {pullRequests.length ? (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {pullRequests.map((p) => {
                const selected = p.number === selectedPr?.number;
                return (
                  <li key={p.number}>
                    <Link
                      href={routes.newSplit(p.repoId, p.number)}
                      aria-current={selected ? "true" : undefined}
                      className={cn("flex items-start gap-4 px-4 py-4 transition-colors sm:px-5", selected ? "bg-subtle/60" : "hover:bg-subtle/40")}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-ink bg-ink" : "border-line-strong",
                        )}
                      >
                        {selected ? <span className="size-2 rounded-full bg-canvas" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-[12px] text-ink-3">#{p.number}</span>
                          <span className="text-[15px] font-medium text-ink">{p.title}</span>
                        </span>
                        <span className="mt-1 block text-[13px] text-ink-3">
                          {p.author} · {plural(p.filesChanged, "file")} · opened {p.openedLabel}
                        </span>
                        {p.belowThreshold ? (
                          <span className="mt-1.5 block text-[12px] text-ink-3">
                            Under {selectedRepo?.config.maxLayerLines ?? 400} lines. Small enough to review as it is.
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="font-mono text-[12px] tabular-nums">
                          <span className="text-ok">+{formatNumber(p.additions)}</span>{" "}
                          <span className="text-bad">−{formatNumber(p.deletions)}</span>
                        </span>
                        {p.stackId ? (
                          <span className="rounded-full border border-line bg-subtle px-2 text-[11px] font-medium text-ink-2">Has a stack</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[14px] text-ink-3">
              {pullsNote ?? (selectedRepo ? `No open pull requests in ${selectedRepo.name}.` : "Choose a repository.")}
            </p>
          )}
        </section>
      </div>

      <aside aria-label="Run the split" className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Step n={3} done={false} />
            <h2 className="text-[15px] font-medium text-ink">Run the split</h2>
          </div>
          {selectedPr && selectedRepo ? (
            <div className="space-y-5 px-5 py-5">
              <div>
                <p className="text-[15px] font-medium text-ink">{selectedPr.title}</p>
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {selectedPr.branch} → {selectedPr.base}
                  </span>
                </p>
                {areas.length ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {areas.map((a) => (
                      <li key={a} className="rounded-full border border-line bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-2">
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <RunOnRunner repoId={selectedRepo.id} prNumber={selectedPr.number} runners={runners} latest={latestRun} siteUrl={siteUrl} />
              <p className="border-t border-line pt-5 text-[14px] font-medium text-ink">Or split it in Bob IDE</p>
              <Command n={1} title="In a clean checkout of the repository" code={init} />
              <Command n={2} title="In Bob IDE, switch to ✂ Cleave and send" code={message} label="Message to Bob" />
              <Command n={3} title="When the run finishes" code={push} />
              {selectedPr.stackId ? (
                <p className="rounded-xl bg-subtle px-3.5 py-3 text-[13px] text-ink-2">
                  This pull request already has a{" "}
                  <Link href={routes.stack(selectedPr.stackId)} className="font-medium text-ink underline-offset-2 hover:underline">
                    stack
                  </Link>
                  . Pushing a new run replaces it.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] text-ink-2">Choose a pull request</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[13px] text-ink-3">
                The commands below fill in its branch, title and your repository&apos;s check command.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 items-center justify-center rounded-full font-mono text-[11px]",
        done ? "bg-ink text-canvas" : "border border-line-strong text-ink-3",
      )}
    >
      {n}
    </span>
  );
}

function Command({ n, title, code, label }: { n: number; title: string; code: string; label?: string }) {
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-2">
        <span className="font-mono text-ink-3">{n}.</span> {title}
      </p>
      <CodeBlock code={code} title={label ?? "Terminal"} wrap />
    </div>
  );
}
