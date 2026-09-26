"use client";

import { ArrowRight, Check, FolderGit2, GitBranch } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { startSplitAction, type ActionResult } from "@/server/actions/stacks";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatNumber, plural } from "@/lib/format";
import { routes } from "@/lib/site";
import type { PullRequest, RepositorySummary } from "@/lib/types";

export interface PullRequestOption extends PullRequest {
  openedLabel: string;
}

const initial: ActionResult = { error: null };

export function NewSplitForm({
  repositories,
  pullRequests,
  initialRepoId,
  initialPr,
  sample,
}: {
  repositories: RepositorySummary[];
  pullRequests: Record<string, PullRequestOption[]>;
  initialRepoId: string;
  initialPr: number | null;
  sample: boolean;
}) {
  const [repoId, setRepoId] = useState(initialRepoId);
  const [prNumber, setPrNumber] = useState<number | null>(initialPr);
  const [state, action, pending] = useActionState(startSplitAction, initial);

  const repo = repositories.find((r) => r.id === repoId);
  const prs = pullRequests[repoId] ?? [];
  const pr = prs.find((p) => p.number === prNumber);
  const size = pr ? pr.additions + pr.deletions : 0;
  const limit = repo?.config.maxLayerLines ?? 400;

  const chooseRepo = (id: string) => {
    setRepoId(id);
    setPrNumber(null);
  };

  return (
    <form action={action} className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <input type="hidden" name="repoId" value={repoId} />
      <input type="hidden" name="prNumber" value={prNumber ?? ""} />

      <div className="space-y-10">
        <fieldset>
          <legend className="flex items-center gap-3 text-[15px] font-medium text-ink">
            <StepNumber n={1} done />
            Repository
          </legend>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {repositories.map((r) => {
              const selected = r.id === repoId;
              return (
                <label
                  key={r.id}
                  className={cn(
                    "relative flex cursor-pointer flex-col rounded-2xl border bg-surface p-4 transition-[border-color,box-shadow] duration-150 has-focus-visible:ring-4 has-focus-visible:ring-accent-soft",
                    selected ? "border-ink shadow-card" : "border-line hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="repo-choice"
                    value={r.id}
                    checked={selected}
                    onChange={() => chooseRepo(r.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-canvas text-ink-2">
                      <FolderGit2 className="size-4" />
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border transition-colors",
                        selected ? "border-ink bg-ink text-canvas" : "border-line-strong",
                      )}
                    >
                      {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  </span>
                  <span className="mt-4 block truncate text-[15px] font-medium text-ink">{r.name}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                    {r.owner} · {r.framework}
                  </span>
                  <span className="mt-3 block text-[12px] text-ink-3">{plural(r.openPullRequests, "open pull request")}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="flex items-center gap-3 text-[15px] font-medium text-ink">
            <StepNumber n={2} done={pr !== undefined} />
            Pull request
          </legend>
          {prs.length ? (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {prs.map((p) => {
                const disabled = p.belowThreshold || !p.analyzable;
                const selected = p.number === prNumber;
                const pSize = p.additions + p.deletions;
                return (
                  <li key={p.number}>
                    <label
                      className={cn(
                        "flex items-start gap-4 px-4 py-4 transition-colors has-focus-visible:bg-accent-soft/40 sm:px-5",
                        disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-subtle/50",
                        selected && "bg-subtle/60",
                      )}
                    >
                      <input
                        type="radio"
                        name="pr-choice"
                        value={p.number}
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setPrNumber(p.number)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          selected ? "border-ink bg-ink" : "border-line-strong",
                          disabled && "opacity-40",
                        )}
                      >
                        {selected ? <span className="size-2 rounded-full bg-canvas" /> : null}
                      </span>
                      <span className={cn("min-w-0 flex-1", disabled && "opacity-55")}>
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-[12px] text-ink-3">#{p.number}</span>
                          <span className="text-[15px] font-medium text-ink">{p.title}</span>
                        </span>
                        <span className="mt-1 block text-[13px] text-ink-3">
                          {p.author} · {plural(p.filesChanged, "file")} · opened {p.openedLabel}
                        </span>
                        {p.belowThreshold ? (
                          <span className="mt-1.5 block text-[12px] text-ink-3">
                            Under {limit} lines. Small enough to review as it is.
                          </span>
                        ) : !p.analyzable ? (
                          <span className="mt-1.5 block text-[12px] text-ink-3">Not available in the sample workspace.</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="font-mono text-[12px] tabular-nums">
                          <span className="text-ok">+{formatNumber(p.additions)}</span>{" "}
                          <span className="text-bad">−{formatNumber(p.deletions)}</span>
                        </span>
                        {p.stackId ? (
                          <span className="rounded-full border border-line bg-subtle px-2 text-[11px] font-medium text-ink-2">
                            Analyzed
                          </span>
                        ) : !disabled ? (
                          <span className="text-[11px] text-ink-3 tabular-nums">{(pSize / limit).toFixed(1)}× limit</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[14px] text-ink-3">
              No open pull requests in {repo?.name ?? "this repository"}.
            </p>
          )}
        </fieldset>
      </div>

      <aside aria-label="Summary" className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <StepNumber n={3} done={false} />
            <h2 className="text-[15px] font-medium text-ink">Review and analyze</h2>
          </div>

          {pr && repo ? (
            <div className="space-y-5 px-5 py-5">
              <div>
                <p className="text-[15px] font-medium text-ink">{pr.title}</p>
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {pr.branch} → {pr.base}
                  </span>
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-ink-2">
                    <span className="font-medium text-ink tabular-nums">{formatNumber(size)}</span> changed lines
                  </span>
                  <span className="text-ink-3 tabular-nums">{plural(pr.filesChanged, "file")}</span>
                </div>
                <SizeMeter size={size} limit={limit} />
                <p className="mt-2 text-[12px] text-ink-3">
                  Each tick is the {limit}-line layer limit. Cleave aims for layers under it.
                </p>
              </div>

              {pr.areas.length ? (
                <div>
                  <p className="text-[12px] text-ink-3">Touches</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {pr.areas.map((area) => (
                      <li
                        key={area}
                        className="rounded-full border border-line bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-2"
                      >
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <dl className="divide-y divide-line rounded-xl border border-line text-[13px]">
                <Row label="Check" value={repo.config.checkCommand} mono />
                <Row label="Setup" value={repo.config.setupCommand} mono />
                <Row label="Directory" value={repo.config.workingDirectory} mono />
                <Row label="Bobcoin cap" value={`${repo.config.bobcoinCap} per run`} />
              </dl>

              {pr.stackId ? (
                <p className="rounded-xl bg-subtle px-3.5 py-3 text-[13px] text-ink-2">
                  Already analyzed.{" "}
                  <Link href={routes.stack(pr.stackId)} className="font-medium text-ink underline-offset-2 hover:underline">
                    View the current stack
                  </Link>
                  . Analyzing again replaces it.
                </p>
              ) : null}

              {state.error ? (
                <p role="alert" className="text-[13px] text-bad">
                  {state.error}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={pending}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                {pending ? "Starting analysis" : pr.stackId ? "Analyze again" : "Analyze pull request"}
              </Button>
              {sample ? (
                <p className="text-center text-[12px] leading-relaxed text-ink-3">
                  Sample workspace: this replays the recorded run for #{pr.number}. Live runs start on your runner once the
                  backend is connected.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] text-ink-2">Choose a pull request</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[13px] text-ink-3">
                You&apos;ll see its size, the areas it touches and the checks each layer must pass.
              </p>
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}

function StepNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 items-center justify-center rounded-full font-mono text-[11px] transition-colors",
        done ? "bg-ink text-canvas" : "border border-line-strong text-ink-3",
      )}
    >
      {n}
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right text-ink", mono && "font-mono text-[12px]")}>{value}</dd>
    </div>
  );
}

/** The change drawn against the per-layer limit: one tick per limit. */
function SizeMeter({ size, limit }: { size: number; limit: number }) {
  const units = Math.max(size / limit, 0.05);
  const total = Math.max(Math.ceil(units), 1);
  return (
    <div className="mt-2 flex gap-1" role="img" aria-label={`${size} lines, ${(size / limit).toFixed(1)} times the layer limit`}>
      {Array.from({ length: total }, (_, i) => {
        const fill = Math.min(Math.max(units - i, 0), 1);
        return (
          <span key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${fill * 100}%` }} />
          </span>
        );
      })}
    </div>
  );
}
