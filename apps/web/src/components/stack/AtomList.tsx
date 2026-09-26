"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Atom } from "@/lib/types";

function DiffView({ patch, truncated, additions }: { patch: string; truncated: boolean; additions: number }) {
  const lines = patch.split("\n");
  const shown = lines.filter((l) => l.startsWith("+")).length;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-line bg-sunken">
      <pre className="scroll-thin overflow-x-auto py-2 text-[12px] leading-[1.65]">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "px-4 whitespace-pre",
              line.startsWith("@@") && "text-ink-3",
              line.startsWith("+") && "bg-ok-soft/70 text-ink",
              line.startsWith("-") && "bg-bad-soft/70 text-ink-2",
            )}
          >
            {line || " "}
          </div>
        ))}
      </pre>
      {truncated && additions > shown ? (
        <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">
          Showing {shown} of {additions} added lines.
        </p>
      ) : null}
    </div>
  );
}

export function AtomList({ atoms }: { atoms: Atom[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {atoms.map((atom) => {
        const expanded = open.has(atom.id);
        const name = atom.file.split("/").pop() ?? atom.file;
        const dir = atom.file.slice(0, atom.file.length - name.length).replace(/\/$/, "");
        const body = (
          <>
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft">
              <Check className="size-3 text-ok" strokeWidth={2.6} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[13px] text-ink">{name}</span>
                {dir ? <span className="truncate font-mono text-[12px] text-ink-3">{dir}</span> : null}
                {atom.kind === "new-file" ? (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[11px] font-medium text-accent-ink">new file</span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[14px] text-ink-2">{atom.summary}</span>
            </span>
            <span className="shrink-0 pt-0.5 font-mono text-[12px] tabular-nums">
              <span className="text-ok">+{atom.additions}</span>{" "}
              <span className={atom.deletions ? "text-bad" : "text-ink-3"}>−{atom.deletions}</span>
            </span>
          </>
        );

        return (
          <li key={atom.id} className="px-4 py-3.5 sm:px-5">
            {atom.patch ? (
              <>
                <button
                  type="button"
                  onClick={() => toggle(atom.id)}
                  aria-expanded={expanded}
                  aria-controls={`patch-${atom.id}`}
                  className="flex w-full items-start gap-3 text-left"
                >
                  {body}
                  <ChevronDown
                    className={cn("mt-1 size-4 shrink-0 text-ink-3 transition-transform duration-200", expanded && "rotate-180")}
                    aria-hidden="true"
                  />
                  <span className="sr-only">{expanded ? "Hide change" : "Show change"}</span>
                </button>
                {expanded ? (
                  <div id={`patch-${atom.id}`} className="animate-fade-in">
                    <DiffView patch={atom.patch} truncated={atom.patchTruncated} additions={atom.additions} />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-start gap-3">
                {body}
                <span className="size-4 shrink-0" aria-hidden="true" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
