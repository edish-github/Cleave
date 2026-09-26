import { Check, Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { LayerStrip } from "@/components/stack/LayerStrip";
import { HalfCircle } from "@/components/stack/StackStatus";
import { VerificationChecks } from "@/components/stack/VerificationChecks";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration, formatNumber, pad2, plural, shortHash } from "@/lib/format";
import { api } from "@/services";

type Params = Promise<{ stackId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stackId } = await params;
  const stack = await api.stacks.getPublic(stackId);
  if (!stack) return { title: "Proof not found", robots: { index: false } };
  const passing = stack.verification.checks.filter((c) => c.state === "pass").length;
  const description = `${stack.repoFullName} #${stack.prNumber} split into ${stack.layers.length} layers. ${passing} of ${stack.verification.checks.length} checks pass.`;
  return {
    title: `Proof · ${stack.title}`,
    description,
    openGraph: { title: `${stack.title} — proof of split`, description },
  };
}

export default async function ProofPage({ params }: { params: Params }) {
  const { stackId } = await params;
  const stack = await api.stacks.getPublic(stackId);
  if (!stack) notFound();

  const { verification, layers, bob } = stack;
  const passing = verification.checks.filter((c) => c.state === "pass").length;
  const total = verification.checks.length;
  const allPass = passing === total;
  const original = stack.additions + stack.deletions;
  const largest = Math.max(...layers.map((l) => l.additions + l.deletions), 0);
  const top = layers[layers.length - 1];

  return (
    <main id="main" className="mx-auto max-w-[920px] px-5 pt-10 pb-24 sm:px-8 sm:pt-16">
      {api.source === "sample" ? (
        <p className="mb-10 flex gap-3 rounded-2xl border border-accent-line bg-accent-soft/60 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <span>This proof comes from Cleave&apos;s sample workspace. The layout and checks are the ones every real stack gets.</span>
        </p>
      ) : null}

      <p className="font-mono text-[12px] text-ink-3">
        {stack.repoFullName} · #{stack.prNumber} · {stack.branch} → {stack.base}
      </p>
      <h1 className="mt-4 font-display text-[44px] leading-[1.02] tracking-[-0.01em] text-balance text-ink sm:text-[56px]">
        {stack.title}
      </h1>
      <p className="mt-5 max-w-[640px] text-[17px] leading-relaxed text-ink-2">
        A {formatNumber(original)}-line pull request, split into {plural(layers.length, "layer")}.{" "}
        {allPass
          ? `Each layer passes ${verification.command} on its own, and the last one is identical to the original.`
          : "One layer doesn't pass on its own yet; the other checks hold."}
      </p>

      <section
        aria-label="Verdict"
        className={cn(
          "mt-10 grid gap-6 rounded-3xl border px-6 py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:px-8",
          allPass ? "border-ok-line bg-gradient-to-br from-ok-soft/70 via-surface to-surface" : "border-warn-line bg-gradient-to-br from-warn-soft/70 via-surface to-surface",
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full ring-1",
              allPass ? "bg-ok-soft text-ok ring-ok-line" : "bg-warn-soft text-warn ring-warn-line",
            )}
          >
            {allPass ? <Check className="size-6" strokeWidth={2.2} /> : <HalfCircle className="size-6" />}
          </span>
          <div>
            <p className="text-[36px] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums">
              {passing}
              <span className="text-ink-3">/{total}</span>
            </p>
            <p className="mt-1.5 text-[13px] text-ink-2">checks pass</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3 sm:border-l sm:border-line sm:pl-8">
          <Fact label="Original" value={`${formatNumber(original)} lines`} />
          <Fact label="Largest layer" value={`${formatNumber(largest)} lines`} />
          <Fact label="Layers" value={String(layers.length)} />
          <Fact label="Head tree" value={shortHash(verification.headTree)} mono />
          <Fact label={`Layer ${pad2(top?.index ?? layers.length)} tree`} value={shortHash(verification.topTree)} mono />
          <Fact label="Code written by AI" value={`${verification.foreignLines} lines`} />
        </dl>
      </section>

      <section aria-label="Layers" className="mt-14">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">Layers</h2>
        <LayerStrip layers={layers} className="mt-4" />
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {layers.map((layer) => (
            <li key={layer.index} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[32px_minmax(0,1fr)_90px_110px_110px] sm:px-5">
              <span className="font-mono text-[12px] text-ink-3">{pad2(layer.index)}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink">{layer.name}</span>
                <span className="block text-[12px] text-ink-3 sm:hidden">
                  {plural(layer.atomIds.length, "atom")} · {formatNumber(layer.additions + layer.deletions)} lines
                </span>
              </span>
              <span className="hidden text-right text-[13px] text-ink-3 tabular-nums sm:block">{plural(layer.atomIds.length, "atom")}</span>
              <span className="hidden text-right text-[13px] text-ink-3 tabular-nums sm:block">
                {formatNumber(layer.additions + layer.deletions)} lines
              </span>
              <span
                className={cn(
                  "flex items-center justify-end gap-1.5 text-[13px] tabular-nums",
                  layer.status === "pass" ? "text-ok" : "text-warn",
                )}
              >
                {layer.status === "pass" ? <Check className="size-3.5" strokeWidth={2.6} /> : <HalfCircle className="size-3.5" />}
                {layer.status === "pass" ? `${layer.testsPassed} passed` : `${layer.testsFailed} failing`}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Checks" className="mt-14">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">Checks</h2>
        <div className="mt-4">
          <VerificationChecks checks={verification.checks} />
        </div>
      </section>

      <section aria-label="How Bob was used" className="mt-14">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">How Bob was used</h2>
        <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-ink-2">
          IBM Bob planned the layers in the ✂ Cleave mode, which has no tool that can edit files or run commands. Its
          only way to change the plan is to move existing hunks between layers.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
          <Tile label="Ran in" value={bob.surface} />
          <Tile label="Read-only subagents" value={String(bob.subagents)} />
          <Tile label="Cleave tool calls" value={String(bob.mcpCalls)} />
          <Tile label="Atoms moved in repair" value={String(verification.repairs.length)} />
          <Tile label="Tool calls allowed" value={String(bob.hookAllowed)} />
          <Tile label="Source edits blocked" value={String(bob.hookBlocked)} />
          <Tile label="Bobcoins" value={bob.bobcoins.toFixed(2)} />
          <Tile label="Duration" value={formatDuration(bob.durationSec * 1000)} />
        </dl>
      </section>

      {stack.status === "published" && top ? (
        <section aria-label="Check it yourself" className="mt-14">
          <h2 className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">Check it yourself</h2>
          <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-ink-2">
            Both commands print the same tree hash when the last layer matches the pull request. No Cleave needed.
          </p>
          <CodeBlock
            className="mt-4"
            title="git"
            wrap
            code={`git fetch origin ${stack.branch} ${top.branch}\ngit rev-parse origin/${stack.branch}^{tree} origin/${top.branch}^{tree}`}
          />
        </section>
      ) : null}

      <footer className="mt-16 border-t border-line pt-6 text-[13px] text-ink-3">
        This page shows evidence, not code.
        {stack.publishedAt ? ` Published ${formatDate(stack.publishedAt)}.` : ` Verified ${formatDate(stack.updatedAt)}.`}
      </footer>
    </main>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-ink", mono ? "font-mono text-[13px]" : "text-[14px]")}>{value}</dd>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="mt-1 text-[18px] font-medium tracking-[-0.01em] text-ink tabular-nums">{value}</dd>
    </div>
  );
}
