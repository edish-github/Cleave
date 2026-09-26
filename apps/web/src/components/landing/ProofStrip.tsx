import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Stat } from "@/components/ui/Stat";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/site";
import type { FeaturedProof } from "@/services";

export interface EvalSummary {
  paired: number;
  cleaveValid: number;
  baselineValid: number;
}

/**
 * The landing page's numbers, read from the featured stack's run (and from /results when
 * evaluation runs exist). The sample stack is used only when no live proof is public, and
 * the strip says so.
 */
export function ProofStrip({ proof, evaluation }: { proof: FeaturedProof; evaluation: EvalSummary | null }) {
  const s = proof.stats;
  return (
    <section aria-label="Latest proof" className="px-5 pb-20 sm:px-8 md:pb-28">
      <div className="mx-auto max-w-[1200px] rounded-[22px] border border-line bg-surface px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-[14px] text-ink-2">
            <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-medium text-ok">
              {proof.sample ? "Sample proof" : "Latest public proof"}
            </span>
            <span className="min-w-0 truncate">
              {proof.repoFullName}
              {proof.prNumber ? ` #${proof.prNumber}` : ""} · {proof.title}
            </span>
          </p>
          <Link
            href={routes.proof(proof.id)}
            className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-ink underline-offset-2 hover:underline"
          >
            Open the proof
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
          <Stat value={formatNumber(s.lines)} label="lines changed" detail={`${formatNumber(s.files)} files, one pull request`} />
          <Stat value={formatNumber(s.layers)} label={s.layers === 1 ? "layer" : "layers"} detail="stacked, in dependency order" />
          <Stat value={`${formatNumber(s.green)}/${formatNumber(s.layers)}`} label="green on their own" detail={s.repairs ? `after ${formatNumber(s.repairs)} ${s.repairs === 1 ? "repair" : "repairs"}` : "first try"} />
          <Stat value={formatNumber(s.foreignLines)} label="foreign lines" detail="code that wasn't in the pull request" />
          <Stat value={s.treesMatch ? "Equal" : "Differs"} label="top tree vs head" detail="git tree hash of the last layer" />
        </div>
        {evaluation && evaluation.paired ? (
          <p className="mt-7 border-t border-line pt-5 text-[14px] text-ink-2">
            On {formatNumber(evaluation.paired)} constructed {evaluation.paired === 1 ? "diff" : "diffs"}, Cleave made a valid
            stack on {formatNumber(evaluation.cleaveValid)} and the one-prompt baseline on {formatNumber(evaluation.baselineValid)}.{" "}
            <Link href={routes.results} className="font-medium text-ink underline-offset-2 hover:underline">
              See the results
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
