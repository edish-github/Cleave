import type { Metadata } from "next";
import { StackActivity } from "@/components/stack/StackActivity";
import { EmptyState } from "@/components/ui/EmptyState";
import { toTimeline } from "@/lib/timeline";
import { requestNow, requireStack } from "@/server/queries";
import { api } from "@/services";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ stackId: string }> }) {
  const { stackId } = await params;
  const stack = await requireStack(stackId);
  const events = toTimeline(await api.activity.forStack(stack.id), requestNow());

  return (
    <div className="space-y-6">
      <p className="max-w-[640px] text-[15px] leading-relaxed text-ink-2">
        Every step of the run, newest first: Cleave&apos;s engine, Bob&apos;s tool calls and subagents, and each decision
        the guard hook made. Select an event to see its details.
      </p>
      {events.length ? (
        <StackActivity events={events} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState title="No activity yet" description="Events appear here as soon as the run starts." />
        </div>
      )}
    </div>
  );
}
