import type { Metadata } from "next";
import { Section } from "@/components/layout/PageHeader";
import { LayerVerificationList } from "@/components/stack/LayerVerificationList";
import { ReviewIssue } from "@/components/stack/ReviewIssue";
import { RoundHistory } from "@/components/stack/RoundHistory";
import { VerificationChecks } from "@/components/stack/VerificationChecks";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { pad2, plural, shortHash } from "@/lib/format";
import { requireStack } from "@/server/queries";

export const metadata: Metadata = { title: "Verification" };

export default async function VerificationPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  const { verification, layers, atoms, bob } = stack;

  const passing = verification.checks.filter((c) => c.state === "pass").length;
  const total = verification.checks.length;
  const discovered = stack.dependencies.filter((d) => d.discoveredByVerification).length;
  const roundsNote =
    verification.repairs.length === 0
      ? "Every layer passed in the first round."
      : verification.issue
        ? `Bob made ${plural(verification.repairs.length, "repair")} across ${plural(verification.rounds.length, "round")}. One layer still needs a decision.`
        : `Round 1 found ${discovered ? plural(discovered, "dependency", "dependencies") : "a problem"} static analysis missed. Bob moved ${plural(verification.repairs.length, "atom")}, and the next round passed.`;

  return (
    <div className="space-y-10">
      {verification.issue ? (
        <ReviewIssue stackId={stack.id} issue={verification.issue} repairs={verification.repairs} atoms={atoms} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="flex flex-col justify-between px-6 py-6">
          <div>
            <p className="text-[13px] text-ink-3">Checks passed</p>
            <p
              className={cn(
                "mt-2 text-[40px] leading-none font-medium tracking-[-0.03em] tabular-nums",
                passing === total ? "text-ink" : "text-warn",
              )}
            >
              {passing}
              <span className="text-ink-3"> / {total}</span>
            </p>
          </div>
          <p className="mt-6 text-[13px] text-ink-2">
            {passing === total
              ? "The stack is complete, ordered, identical to the original and shippable at every layer."
              : "Coverage, order and fidelity hold. One layer can't ship on its own yet."}
          </p>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-[13px] text-ink-3">Tree fidelity</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <HashChip label={`#${stack.prNumber} head`} hash={verification.headTree} />
            <span className="text-[20px] text-ok" aria-label="equals">
              =
            </span>
            <HashChip label={`Layer ${pad2(layers.length)}`} hash={verification.topTree} />
          </div>
          <p className="mt-4 text-[13px] text-ink-2">
            Applying every layer in order produces exactly the pull request&apos;s tree. {verification.foreignLines} lines
            were added that weren&apos;t in the original; the guard hook blocked {bob.hookBlocked} source edits.
          </p>
        </Card>
      </div>

      <Section title="Checks">
        <VerificationChecks checks={verification.checks} />
      </Section>

      <Section title="Layers">
        <LayerVerificationList stackId={stack.id} layers={layers} command={verification.command} />
      </Section>

      <Section title="Rounds">
        <p className="-mt-2 text-[14px] text-ink-3">{roundsNote}</p>
        <RoundHistory rounds={verification.rounds} repairs={verification.repairs} atoms={atoms} />
      </Section>
    </div>
  );
}

function HashChip({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-ok-line bg-ok-soft/60 px-3 py-2.5">
      <p className="truncate text-[12px] text-ink-3">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[14px] text-ink" title={hash}>
        {shortHash(hash)}
      </p>
    </div>
  );
}
