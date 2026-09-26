import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/layout/PageHeader";
import { HalfCircle } from "@/components/stack/StackStatus";
import { LayerStrip } from "@/components/stack/LayerStrip";
import { LayerTimeline } from "@/components/stack/LayerTimeline";
import { StatusHero } from "@/components/stack/StatusHero";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { cn } from "@/lib/cn";
import { coinsOrDash, countOrDash, formatNumber, pad2, plural, secondsOrDash, shortHash, timeAgo } from "@/lib/format";
import { routes } from "@/lib/site";
import { requestNow, requireStack } from "@/server/queries";

export default async function StackOverviewPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  const { verification, layers, bob } = stack;

  const original = stack.additions + stack.deletions;
  const largest = Math.max(...layers.map((l) => l.additions + l.deletions), 0);
  const passing = verification.checks.filter((c) => c.state === "pass").length;
  const failing = layers.find((l) => l.status === "fail");

  const hero =
    stack.status === "failed" ? (
      <StatusHero
        status="failed"
        message={stack.error ?? "The run stopped before every check finished."}
        actions={
          <ButtonLink href={routes.activity(stack.id)} variant="secondary" size="sm">
            See what happened
          </ButtonLink>
        }
      />
    ) : stack.status === "analyzing" ? (
      <StatusHero status="analyzing" message="This run is still in progress. Results appear when it's pushed." />
    ) : stack.status === "review" ? (
      <StatusHero
        status="review"
        message={
          <>
            Layer {pad2(failing?.index ?? verification.issue?.layerIndex ?? 0)} fails its tests on its own. One decision
            finishes this stack.
          </>
        }
        actions={
          <ButtonLink href={routes.verification(stack.id)} size="sm" trailingIcon={<ArrowRight className="size-3.5" />}>
            Review the issue
          </ButtonLink>
        }
      />
    ) : stack.status === "published" ? (
      <StatusHero
        status="published"
        message={
          <>
            Published as {plural(layers.length, "stacked pull request")}
            {stack.publishedAt ? ` ${timeAgo(stack.publishedAt, requestNow())}` : ""}.
          </>
        }
        actions={
          <ButtonLink href={routes.published(stack.id)} variant="secondary" size="sm">
            View pull requests
          </ButtonLink>
        }
      />
    ) : (
      <StatusHero
        status="verified"
        message={
          <>
            All {layers.length} layers pass <code className="font-mono text-[14px]">{verification.command}</code> on their
            own, and together they match #{stack.prNumber} exactly.
          </>
        }
        actions={
          <ButtonLink href={routes.verification(stack.id)} variant="secondary" size="sm">
            See the proof
          </ButtonLink>
        }
      />
    );

  return (
    <div className="space-y-10">
      {hero}

      <Card className="grid grid-cols-2 gap-y-6 px-6 py-6 md:grid-cols-4 md:divide-x md:divide-line md:px-0">
        <Stat className="md:px-6" value={formatNumber(original)} label="Lines in the pull request" detail={plural(stack.filesChanged, "file")} />
        <Stat
          className="md:px-6"
          value={formatNumber(largest)}
          label="Largest layer"
          detail={largest ? `${(original / largest).toFixed(1)}× smaller to review` : undefined}
        />
        <Stat className="md:px-6" value={String(layers.length)} label="Layers" detail={`${plural(stack.atoms.length, "atom")} · ${plural(stack.dependencies.length, "dependency", "dependencies")}`} />
        <Stat className="md:px-6" value={`${passing} / ${verification.checks.length}`} label="Checks passed" detail={`${plural(verification.rounds.length, "verification round")}`} />
      </Card>

      <section aria-label="Layer sizes">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-medium text-ink">Layer sizes</h2>
          <p className="text-[12px] text-ink-3">Width is lines changed</p>
        </div>
        <LayerStrip layers={layers} />
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section
          title="Layers"
          action={
            <Link href={routes.layers(stack.id)} className="text-[13px] text-ink-3 hover:text-ink">
              All details
            </Link>
          }
        >
          <Card className="p-2">
            <LayerTimeline stackId={stack.id} layers={layers} />
          </Card>
        </Section>

        <div className="space-y-10">
          <Section
            title="Proof"
            action={
              <Link href={routes.verification(stack.id)} className="text-[13px] text-ink-3 hover:text-ink">
                Verification
              </Link>
            }
          >
            <Card>
              <ul className="divide-y divide-line">
                {verification.checks.map((check) => (
                  <li key={check.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        check.state === "pass" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
                      )}
                    >
                      {check.state === "pass" ? <Check className="size-3" strokeWidth={2.8} /> : <HalfCircle className="size-3" />}
                    </span>
                    <span className="flex-1 text-[14px] text-ink">{check.label}</span>
                    <span className={cn("text-[13px] tabular-nums", check.state === "pass" ? "text-ink-3" : "text-warn")}>
                      {check.value}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 py-3">
                <p className="text-[12px] text-ink-3">Head tree</p>
                <p className="mt-0.5 font-mono text-[12px] text-ink-2">
                  {shortHash(verification.headTree)} = Layer {pad2(layers.length)} tree {shortHash(verification.topTree)}
                </p>
              </div>
            </Card>
          </Section>

          <Section
            title="Bob's work"
            action={
              <Link href={routes.activity(stack.id)} className="text-[13px] text-ink-3 hover:text-ink">
                Activity
              </Link>
            }
          >
            <Card>
              <dl className="divide-y divide-line text-[14px]">
                <BobRow label="Ran in" value={`${bob.surface} · ${bob.mode}`} />
                <BobRow label="Subagents" value={bob.subagents === null ? "—" : `${bob.subagents} read-only`} />
                <BobRow label="Cleave tool calls" value={countOrDash(bob.mcpCalls)} />
                <BobRow label="Plan changes" value={plural(verification.repairs.length, "atom move")} />
                <BobRow label="Lines of code written" value={String(verification.foreignLines)} strong />
                <BobRow label="Bobcoins" value={coinsOrDash(bob.bobcoins)} />
                <BobRow label="Duration" value={secondsOrDash(bob.durationSec)} />
              </dl>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}

function BobRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("text-right tabular-nums", strong ? "font-medium text-ok" : "text-ink")}>{value}</dd>
    </div>
  );
}
