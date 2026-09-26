"use client";

import { ArrowRight, Combine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resolveReviewAction } from "@/server/actions/stacks";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { pad2 } from "@/lib/format";
import type { Atom, Repair, VerificationIssue } from "@/lib/types";
import { HalfCircle } from "./StackStatus";

export function ReviewIssue({
  stackId,
  issue,
  repairs,
  atoms,
}: {
  stackId: string;
  issue: VerificationIssue;
  repairs: Repair[];
  atoms: Atom[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resolve = () =>
    startTransition(async () => {
      setError(null);
      const result = await resolveReviewAction(stackId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <section aria-label="Issue" className="overflow-hidden rounded-2xl border border-warn-line bg-surface">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <HalfCircle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <h3 className="text-[15px] font-medium text-ink">{issue.title}</h3>
              <p className="mt-1 text-[14px] text-ink-3">
                Bob tried {issue.attempts} repairs. Layer {pad2(issue.layerIndex)} still fails its tests without the
                layers after it.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)} trailingIcon={<ArrowRight className="size-3.5" />}>
            Review
          </Button>
        </div>
        <dl className="grid border-t border-line text-[13px] sm:grid-cols-2">
          <div className="border-b border-line px-5 py-3.5 sm:border-r sm:border-b-0">
            <dt className="text-ink-3">Expected</dt>
            <dd className="mt-1 font-mono text-[12px] text-ink">{issue.expected}</dd>
          </div>
          <div className="px-5 py-3.5">
            <dt className="text-ink-3">Found</dt>
            <dd className="mt-1 font-mono text-[12px] break-words text-warn">{issue.found}</dd>
          </div>
        </dl>
      </section>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={issue.title}
        description={`${issue.test} · Layer ${pad2(issue.layerIndex)}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button size="sm" loading={pending} icon={<Combine className="size-3.5" />} onClick={resolve}>
              {pending ? "Merging and verifying" : issue.resolution.label}
            </Button>
          </>
        }
      >
        <div className="space-y-7">
          <section>
            <h3 className="text-[13px] font-medium text-ink-2">What happened</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink">{issue.explanation}</p>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-ink-2">Test output</h3>
            <pre className="scroll-thin mt-2 overflow-x-auto rounded-xl border border-line bg-sunken p-4 text-[12px] leading-relaxed text-ink-2">
              {issue.log}
            </pre>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-ink-2">What Bob tried</h3>
            <ol className="mt-3 space-y-3">
              {repairs.map((r, i) => {
                const atom = atoms.find((a) => a.id === r.atomId);
                return (
                  <li key={i} className="rounded-xl border border-line px-4 py-3">
                    <p className="text-[13px] text-ink">
                      Moved <span className="font-mono text-[12px]">{atom ? `${atom.file.split("/").pop()} · ${atom.summary}` : r.atomId}</span>{" "}
                      from Layer {pad2(r.fromLayer)} to Layer {pad2(r.toLayer)}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-3">{r.reason}</p>
                  </li>
                );
              })}
              <li className="rounded-xl border border-line px-4 py-3 text-[13px] text-ink-3">
                Stopped after {repairs.length + 1} verification rounds, the limit for one run.
              </li>
            </ol>
          </section>

          <section className="rounded-xl bg-accent-soft/60 px-4 py-4">
            <h3 className="text-[13px] font-medium text-accent-ink">Suggested resolution</h3>
            <p className="mt-1 text-[14px] text-ink">{issue.resolution.label}</p>
            <p className="mt-1 text-[13px] text-ink-2">{issue.resolution.description}</p>
          </section>

          {error ? (
            <p role="alert" className="text-[13px] text-bad">
              {error}
            </p>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
