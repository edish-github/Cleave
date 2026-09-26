import { Check, ChevronRight, GitBranch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LayerStrip } from "@/components/stack/LayerStrip";
import { HalfCircle } from "@/components/stack/StackStatus";
import { cn } from "@/lib/cn";
import { formatNumber, pad2, plural } from "@/lib/format";
import { routes } from "@/lib/site";
import { requireStack } from "@/server/queries";

export const metadata: Metadata = { title: "Layers" };

export default async function LayersPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <p className="max-w-[620px] text-[15px] leading-relaxed text-ink-2">
          Each layer includes every layer above it and passes{" "}
          <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[13px] text-ink">{stack.verification.command}</code>{" "}
          on its own. Reviewers read them in order, one small change at a time.
        </p>
        <p className="shrink-0 text-[13px] text-ink-3">
          {plural(stack.atoms.length, "atom")} in {plural(stack.layers.length, "layer")}
        </p>
      </div>

      <LayerStrip layers={stack.layers} />

      <ol className="space-y-3">
        {stack.layers.map((layer, i) => (
          <li key={layer.index} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <Link
              href={routes.layer(stack.id, layer.index)}
              className="group block rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-card sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border font-mono text-[12px]",
                    layer.status === "pass" ? "border-line bg-canvas text-ink-2" : "border-warn-line bg-warn-soft text-warn",
                  )}
                >
                  {pad2(layer.index)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[16px] font-medium text-ink">{layer.name}</h2>
                    {layer.status === "pass" ? (
                      <Check className="size-4 shrink-0 text-ok" strokeWidth={2.4} aria-label="Passes on its own" />
                    ) : (
                      <HalfCircle className="size-4 shrink-0 text-warn" />
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-2">{layer.rationale}</p>

                  <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                    <Meta label="Atoms" value={String(layer.atomIds.length)} />
                    <Meta label="Files" value={String(layer.files.length)} />
                    <Meta label="Lines" value={`+${formatNumber(layer.additions)} −${formatNumber(layer.deletions)}`} />
                    <Meta
                      label="Tests"
                      value={layer.status === "pass" ? `${layer.testsPassed} passed` : `${layer.testsFailed} failing`}
                      tone={layer.status === "pass" ? undefined : "warn"}
                    />
                    <Meta label="Depends on" value={plural(layer.dependencyCount, "link")} />
                  </dl>
                  <p className="mt-3 flex items-center gap-1.5 truncate font-mono text-[12px] text-ink-3">
                    <GitBranch className="size-3.5 shrink-0" />
                    <span className="truncate">{layer.branch}</span>
                  </p>
                </div>
                <ChevronRight className="mt-2 size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("tabular-nums", tone === "warn" ? "text-warn" : "text-ink")}>{value}</dd>
    </div>
  );
}
