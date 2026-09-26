import type { Metadata } from "next";
import { BobStatsCard } from "@/components/stack/BobStatsCard";
import { HookAuditTable, type HookAuditRow } from "@/components/stack/HookAuditTable";
import { StackActivity } from "@/components/stack/StackActivity";
import { EmptyState } from "@/components/ui/EmptyState";
import { toTimeline } from "@/lib/timeline";
import type { ActivityEvent } from "@/lib/types";
import { requestNow, requireStack } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Activity" };

/** Hook decisions per tool. Blocked calls are the events the hook marked for attention. */
function hookRows(events: ActivityEvent[]): HookAuditRow[] {
  const byTool = new Map<string, HookAuditRow>();
  for (const e of events) {
    if (e.source !== "hook" || !e.tool) continue;
    const row = byTool.get(e.tool) ?? { tool: e.tool, allowed: 0, blocked: 0 };
    if (e.tone === "attention") row.blocked += 1;
    else row.allowed += 1;
    byTool.set(e.tool, row);
  }
  return [...byTool.values()].sort((a, b) => b.blocked - a.blocked || b.allowed - a.allowed || a.tool.localeCompare(b.tool));
}

export default async function ActivityPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  const raw = await api.activity.forStack(stack.id);
  const events = toTimeline(raw, requestNow());

  return (
    <div className="space-y-6">
      <p className="max-w-[640px] text-[15px] leading-relaxed text-ink-2">
        Every step of the run, newest first: Cleave&apos;s engine, Bob&apos;s tool calls and subagents, and each decision
        the guard hook made. Select an event to see its details.
      </p>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {events.length ? (
          <StackActivity events={events} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState title="No activity yet" description="Events appear here as soon as the run is pushed." />
          </div>
        )}
        <div className="space-y-6">
          <HookAuditTable rows={hookRows(raw)} allowed={stack.bob.hookAllowed} blocked={stack.bob.hookBlocked} />
          <BobStatsCard bob={stack.bob} atomMoves={stack.verification.repairs.length} />
        </div>
      </div>
    </div>
  );
}
