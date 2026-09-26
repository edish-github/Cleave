import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { SiteShell } from "@/components/landing/SiteShell";
import { Badge } from "@/components/ui/Badge";
import { summarizeEval } from "@/lib/eval";
import { coinsOrDash, formatNumber } from "@/lib/format";
import { routes } from "@/lib/site";
import { getEvalResults, type EvalRow } from "@/services";

export const metadata: Metadata = {
  title: "Results",
  description: "Cleave against a one-prompt baseline on constructed diffs: valid stacks, green layers, foreign lines, largest layer and Bobcoins.",
};

/** Evaluation runs arrive by `cleave push`; the table follows them within a minute. */
export const revalidate = 60;

type Metrics = NonNullable<EvalRow["cleave"]>;

const columns = [
  { key: "valid", label: "Valid stack", help: "Coverage, order, fidelity, shippability and partition all pass." },
  { key: "green", label: "Green layers", help: "Layers whose check command passes on their own." },
  { key: "foreign", label: "Foreign lines", help: "Lines in the stack that aren't in the original diff. Cleave's target is 0." },
  { key: "largest", label: "Largest layer", help: "Added plus removed lines in the biggest layer." },
  { key: "coins", label: "Bobcoins", help: "Reported by Bob for the run." },
] as const;

const pushCommand = `# From the constructed diff's checkout, after the run finishes
cleave push --eval-group constructed --dataset <name> \\
  --ground-truth ground_truth.json --kind cleave        # or --kind baseline_b1`;

export default async function ResultsPage() {
  const rows = await getEvalResults();
  const summary = summarizeEval(rows);

  return (
    <SiteShell>
      <main id="main" className="mx-auto max-w-[1200px] px-5 pt-12 pb-24 sm:px-8 sm:pt-20">
        <div className="max-w-[760px]">
          <p className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">Evaluation</p>
          <h1 className="mt-4 font-display text-[48px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[64px]">Results</h1>
          <p className="mt-6 text-[18px] leading-relaxed text-ink-2">
            Each row is a constructed diff: three to five real commits squashed into one tangled change, with the original
            commits kept as ground truth. <strong className="font-medium text-ink">B1</strong> asks Bob in Agent mode, in one
            prompt, to split it into stacked branches. <strong className="font-medium text-ink">Cleave</strong> runs the ✂ Cleave
            mode, where Bob can only move hunks. Both runs are checked by the same five checks.
          </p>
          <p className="mt-4 text-[15px] text-ink-3">
            Every row links to its public proof. Nothing here is typed in by hand: rows appear when a run is pushed.
          </p>
        </div>

        {rows.length ? (
          <>
            {summary.paired ? (
              <p className="mt-12 max-w-[760px] text-[17px] leading-relaxed text-ink">
                On {formatNumber(summary.paired)} {summary.paired === 1 ? "diff" : "diffs"} with both runs, Cleave produced a valid
                stack on {formatNumber(summary.cleaveValid)} and B1 on {formatNumber(summary.baselineValid)}. Zero foreign lines:
                Cleave on {formatNumber(summary.cleaveClean)}, B1 on {formatNumber(summary.baselineClean)}.
              </p>
            ) : null}

            <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[880px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] text-ink-3">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Diff
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Run
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} scope="col" title={c.help} className="px-3 py-3 text-right font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Proof
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <DiffRows key={row.stackId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] text-ink-3 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((c) => (
                <div key={c.key}>
                  <dt className="inline font-medium text-ink-2">{c.label}.</dt> <dd className="inline">{c.help}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="mt-14 max-w-[760px] rounded-2xl border border-dashed border-line px-6 py-10">
            <p className="text-[17px] font-medium text-ink">No evaluation runs yet</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              The table fills in as runs are pushed with an evaluation group. Until then there is nothing to compare, so
              nothing is shown. The featured split on the{" "}
              <Link href={routes.home} className="font-medium text-ink underline-offset-2 hover:underline">
                home page
              </Link>{" "}
              has its own public proof.
            </p>
            <CodeBlock className="mt-6" code={pushCommand} wrap />
          </div>
        )}
      </main>
    </SiteShell>
  );
}

function DiffRows({ row }: { row: EvalRow }) {
  const runs: { label: string; metrics: Metrics | null }[] = [
    { label: "B1", metrics: row.baseline },
    { label: "Cleave", metrics: row.cleave },
  ];
  return (
    <>
      {runs.map((run, i) => (
        <tr key={run.label} className={i === runs.length - 1 ? "border-b border-line last:border-b-0" : undefined}>
          {i === 0 ? (
            <th scope="rowgroup" rowSpan={runs.length} className="px-5 py-4 align-top font-normal">
              <span className="block font-medium text-ink">{row.dataset}</span>
              <span className="mt-0.5 block text-[12px] text-ink-3">
                {row.repoFullName} · {formatNumber(row.lines)} lines
              </span>
            </th>
          ) : null}
          <td className="px-3 py-3 font-medium text-ink-2">{run.label}</td>
          {run.metrics ? (
            <>
              <td className="px-3 py-3 text-right">
                <Badge tone={run.metrics.valid ? "ok" : "bad"}>{run.metrics.valid ? "Valid" : "Invalid"}</Badge>
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">
                {formatNumber(run.metrics.green)}/{formatNumber(run.metrics.layers)}
              </td>
              <td className={`px-3 py-3 text-right font-mono tabular-nums ${run.metrics.foreignLines ? "text-bad" : "text-ink"}`}>
                {formatNumber(run.metrics.foreignLines)}
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(run.metrics.largestLayer)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{coinsOrDash(run.metrics.bobcoins)}</td>
              {i === 0 ? (
                <td rowSpan={runs.length} className="px-5 py-3 text-right align-top">
                  <Link href={routes.proof(row.stackId)} className="text-[13px] font-medium text-ink underline-offset-2 hover:underline">
                    Proof
                  </Link>
                </td>
              ) : null}
            </>
          ) : (
            <>
              <td colSpan={columns.length} className="px-3 py-3 text-right text-[13px] text-ink-3">
                Not run yet
              </td>
              {i === 0 ? (
                <td rowSpan={runs.length} className="px-5 py-3 text-right align-top">
                  <Link href={routes.proof(row.stackId)} className="text-[13px] font-medium text-ink underline-offset-2 hover:underline">
                    Proof
                  </Link>
                </td>
              ) : null}
            </>
          )}
        </tr>
      ))}
    </>
  );
}
