import { Bot } from "lucide-react";
import { coinsOrDash, countOrDash, secondsOrDash } from "@/lib/format";
import type { BobRunStats } from "@/lib/types";

/** How Bob was used in this run: surface, subagents, calls and cost. */
export function BobStatsCard({ bob, atomMoves }: { bob: BobRunStats; atomMoves: number }) {
  const rows: [string, string][] = [
    ["Ran in", `${bob.surface} · ${bob.mode}`],
    ["Read-only subagents", countOrDash(bob.subagents)],
    ["Tool calls", countOrDash(bob.toolCalls)],
    ["Cleave tool calls", countOrDash(bob.mcpCalls)],
    ["Atoms moved in repair", String(atomMoves)],
    ["Tokens", countOrDash(bob.tokens)],
    ["Bobcoins", coinsOrDash(bob.bobcoins)],
    ["Duration", secondsOrDash(bob.durationSec)],
  ];
  return (
    <section aria-label="Bob" className="rounded-2xl border border-line bg-surface">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <Bot className="size-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-medium text-ink">Bob</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Grouped and ordered hunks; wrote no code.</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-line border-t border-line text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-2">
            <dt className="text-ink-3">{label}</dt>
            <dd className="text-right text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
