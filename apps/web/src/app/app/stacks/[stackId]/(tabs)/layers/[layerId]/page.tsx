import { ArrowLeft, ArrowRight, Check, GitBranch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/layout/PageHeader";
import { AtomList } from "@/components/stack/AtomList";
import { BackLink } from "@/components/stack/StackHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { cn } from "@/lib/cn";
import { fileName, formatDuration, formatNumber, pad2, plural } from "@/lib/format";
import { routes } from "@/lib/site";
import type { Atom, Dependency } from "@/lib/types";
import { api } from "@/services";

type Params = Promise<{ stackId: string; layerId: string }>;

async function load(params: Params) {
  const { stackId, layerId } = await params;
  const index = Number.parseInt(layerId, 10);
  if (!Number.isInteger(index) || String(index) !== layerId) return null;
  return api.stacks.layer(stackId, index);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await load(params);
  return { title: found ? `Layer ${pad2(found.layer.index)} · ${found.layer.name}` : "Layer" };
}

const kindLabel: Record<Dependency["kind"], string> = {
  import: "import",
  call: "call",
  model: "model",
  fixture: "fixture",
  runtime: "runtime",
};

export default async function LayerPage({ params }: { params: Params }) {
  const found = await load(params);
  if (!found) notFound();
  const { stack, layer } = found;

  const atoms = stack.atoms.filter((a) => a.layerIndex === layer.index);
  const byId = new Map(stack.atoms.map((a) => [a.id, a]));
  const inLayer = new Set(atoms.map((a) => a.id));
  const dependsOn = stack.dependencies.filter((d) => inLayer.has(d.fromAtomId) && !inLayer.has(d.toAtomId));
  const neededBy = stack.dependencies.filter((d) => inLayer.has(d.toAtomId) && !inLayer.has(d.fromAtomId));
  const internal = stack.dependencies.filter((d) => inLayer.has(d.fromAtomId) && inLayer.has(d.toAtomId)).length;

  const prev = stack.layers.find((l) => l.index === layer.index - 1);
  const next = stack.layers.find((l) => l.index === layer.index + 1);
  const base = prev ? prev.branch : stack.base;

  return (
    <div className="space-y-10">
      <div>
        <BackLink href={routes.layers(stack.id)}>All layers</BackLink>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[12px] text-ink-3">
              Layer {pad2(layer.index)} of {pad2(stack.layers.length)}
            </p>
            <h2 className="mt-1.5 text-[22px] font-medium tracking-[-0.01em] text-ink">{layer.name}</h2>
          </div>
          {layer.status === "pass" ? (
            <Badge tone="ok" dot>
              Passes on its own
            </Badge>
          ) : (
            <Badge tone="attention" dot>
              Fails on its own
            </Badge>
          )}
        </div>
        <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-ink-2">{layer.rationale}</p>
      </div>

      <Card className="grid grid-cols-2 gap-y-6 px-6 py-6 md:grid-cols-4 md:divide-x md:divide-line md:px-0">
        <Stat className="md:px-6" value={String(atoms.length)} label="Atoms" detail={plural(layer.files.length, "file")} />
        <Stat
          className="md:px-6"
          value={formatNumber(layer.additions + layer.deletions)}
          label="Lines"
          detail={`+${formatNumber(layer.additions)} −${formatNumber(layer.deletions)}`}
        />
        <Stat
          className="md:px-6"
          value={layer.status === "pass" ? String(layer.testsPassed) : String(layer.testsFailed)}
          label={layer.status === "pass" ? "Tests passed" : "Tests failing"}
          detail={`${stack.verification.command} · ${formatDuration(layer.durationMs)}`}
        />
        <Stat
          className="md:px-6"
          value={String(dependsOn.length)}
          label="Needs earlier layers"
          detail={`${internal} inside this layer`}
        />
      </Card>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-canvas/60 px-5 py-4 font-mono text-[12px] text-ink-2 sm:flex-row sm:items-center sm:gap-3">
        <GitBranch className="hidden size-4 shrink-0 text-ink-3 sm:block" />
        <span className="min-w-0 truncate text-ink">{layer.branch}</span>
        <span className="hidden text-ink-3 sm:inline">→</span>
        <span className="min-w-0 truncate text-ink-3">
          <span className="sm:hidden">based on </span>
          {base}
        </span>
        {layer.prNumber ? <span className="text-ink-3 sm:ml-auto">PR #{layer.prNumber}</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title={`Changes · ${plural(atoms.length, "atom")}`}>
          <AtomList atoms={atoms} />
          <p className="text-[12px] text-ink-3">
            Hunks are copied verbatim from #{stack.prNumber}. Cleave never edits them; it only decides which layer each
            one belongs to.
          </p>
        </Section>

        <div className="space-y-10">
          <DependencySection
            title="Needs"
            empty="Nothing from earlier layers. This layer stands on the base branch alone."
            deps={dependsOn}
            byId={byId}
            side="to"
            stackId={stack.id}
          />
          <DependencySection
            title="Needed by"
            empty="No later layer depends on this one."
            deps={neededBy}
            byId={byId}
            side="from"
            stackId={stack.id}
          />
        </div>
      </div>

      <nav aria-label="Layers" className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link
            href={routes.layer(stack.id, prev.index)}
            className="group rounded-2xl border border-line px-4 py-3 transition-colors hover:border-line-strong"
          >
            <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" /> Previous
            </span>
            <span className="mt-1 block truncate text-[14px] font-medium text-ink">
              {pad2(prev.index)} · {prev.name}
            </span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          <Link
            href={routes.layer(stack.id, next.index)}
            className="group rounded-2xl border border-line px-4 py-3 text-right transition-colors hover:border-line-strong"
          >
            <span className="flex items-center justify-end gap-1.5 text-[12px] text-ink-3">
              Next <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-1 block truncate text-[14px] font-medium text-ink">
              {pad2(next.index)} · {next.name}
            </span>
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

function DependencySection({
  title,
  empty,
  deps,
  byId,
  side,
  stackId,
}: {
  title: string;
  empty: string;
  deps: Dependency[];
  byId: Map<string, Atom>;
  /** Which end of the edge lives in another layer. */
  side: "to" | "from";
  stackId: string;
}) {
  return (
    <Section title={`${title} · ${deps.length}`}>
      {deps.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {deps.map((d) => {
            const other = byId.get(side === "to" ? d.toAtomId : d.fromAtomId);
            const own = byId.get(side === "to" ? d.fromAtomId : d.toAtomId);
            return (
              <li key={d.id} className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <code className="truncate font-mono text-[13px] text-ink">{d.symbol}</code>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 text-[11px]",
                      d.discoveredByVerification
                        ? "border-accent-line bg-accent-soft text-accent-ink"
                        : "border-line bg-subtle text-ink-3",
                    )}
                  >
                    {d.discoveredByVerification ? "found by tests" : kindLabel[d.kind]}
                  </span>
                </div>
                {other && own ? (
                  <p className="mt-1.5 text-[12px] text-ink-3">
                    {side === "to" ? (
                      <>
                        {fileName(own.file)} uses{" "}
                        <Link href={routes.layer(stackId, other.layerIndex)} className="text-ink-2 hover:text-ink">
                          {fileName(other.file)} · L{pad2(other.layerIndex)}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href={routes.layer(stackId, other.layerIndex)} className="text-ink-2 hover:text-ink">
                          {fileName(other.file)} · L{pad2(other.layerIndex)}
                        </Link>{" "}
                        uses {fileName(own.file)}
                      </>
                    )}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl border border-dashed border-line px-4 py-4 text-[13px] text-ink-3">
          {side === "to" ? <Check className="mt-0.5 size-3.5 shrink-0 text-ok" /> : null}
          {empty}
        </p>
      )}
    </Section>
  );
}
