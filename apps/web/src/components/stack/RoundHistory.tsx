import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { pad2 } from "@/lib/format";
import type { Atom, Repair, VerificationRound } from "@/lib/types";

/** Every verification round, with the repair Bob made in between. */
export function RoundHistory({ rounds, repairs, atoms }: { rounds: VerificationRound[]; repairs: Repair[]; atoms: Atom[] }) {
  return (
    <ol className="space-y-3">
      {rounds.map((round) => {
        const repair = repairs.find((r) => r.round === round.round);
        const atom = repair ? atoms.find((a) => a.id === repair.atomId) : undefined;
        const failed = round.results.filter((r) => r.status === "fail");
        return (
          <li key={round.round} className="rounded-2xl border border-line bg-surface px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] font-medium text-ink">Round {round.round}</p>
              <div className="flex items-center gap-1.5" aria-label={`${round.results.length - failed.length} of ${round.results.length} layers passed`}>
                {round.results.map((r) => (
                  <span
                    key={r.layerIndex}
                    title={`Layer ${pad2(r.layerIndex)}: ${r.status === "pass" ? "passed" : "failed"}`}
                    className={cn(
                      "flex h-6 w-8 items-center justify-center rounded-md font-mono text-[11px]",
                      r.status === "pass" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
                    )}
                  >
                    {pad2(r.layerIndex)}
                  </span>
                ))}
              </div>
            </div>
            {failed.map((f) => (
              <p key={f.layerIndex} className="mt-3 font-mono text-[12px] leading-relaxed text-ink-3">
                Layer {pad2(f.layerIndex)} · {f.failure?.test}
                <br />
                <span className="text-warn">{f.failure?.message.split("\n")[0]}</span>
              </p>
            ))}
            {repair ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft/60 px-3 py-2 text-[13px] text-accent-ink">
                <span className="font-medium">Bob moved</span>
                <span className="font-mono text-[12px]">{atom ? `${atom.file.split("/").pop()} · ${atom.summary}` : repair.atomId}</span>
                <span className="inline-flex items-center gap-1 font-mono text-[12px]">
                  L{pad2(repair.fromLayer)} <ArrowRight className="size-3" /> L{pad2(repair.toLayer)}
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
