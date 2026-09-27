import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber, plural } from "@/lib/format";

export interface HookAuditRow {
  tool: string;
  allowed: number;
  blocked: number;
}

/** What the guard hook decided during the run, per tool. The proof of "0 source writes". */
export function HookAuditTable({ rows, allowed, blocked }: { rows: HookAuditRow[]; allowed: number; blocked: number }) {
  return (
    <section aria-label="Guard hook" className="rounded-2xl border border-line bg-surface">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ok-soft text-ok">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-medium text-ink">Guard hook</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {plural(allowed, "tool call")} allowed, {formatNumber(blocked)} blocked. Writes to source are never allowed while a run is active.
          </p>
        </div>
      </div>
      {rows.length ? (
        <table className="mt-4 w-full text-[13px]">
          <thead className="border-y border-line bg-canvas/50 text-ink-3">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-medium">Tool</th>
              <th scope="col" className="w-0 px-3 py-2 text-right font-medium">Allowed</th>
              <th scope="col" className="w-0 px-5 py-2 text-right font-medium">Blocked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.tool}>
                <td className="w-full px-5 py-2 font-mono text-[12px] break-all text-ink">{r.tool}</td>
                <td className="px-3 py-2 text-right text-ink-2 tabular-nums">{formatNumber(r.allowed)}</td>
                <td className={cn("px-5 py-2 text-right tabular-nums", r.blocked ? "font-medium text-warn" : "text-ink-3")}>
                  {formatNumber(r.blocked)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-5 pt-3 pb-5 text-[13px] text-ink-3">Per-tool decisions appear when the run&apos;s hook events are pushed.</p>
      )}
      {rows.length ? <div className="h-2" /> : null}
    </section>
  );
}
