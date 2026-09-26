"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ActivitySource } from "@/lib/types";
import { ActivityTimeline, type TimelineEvent } from "./ActivityTimeline";

const labels: Record<ActivitySource, string> = {
  bob: "Bob",
  engine: "Cleave",
  hook: "Hooks",
  github: "GitHub",
  you: "You",
};

const order: ActivitySource[] = ["bob", "engine", "hook", "you", "github"];

export function StackActivity({ events }: { events: TimelineEvent[] }) {
  const [source, setSource] = useState<"all" | ActivitySource>("all");
  const present = order.filter((s) => events.some((e) => e.source === s));
  const visible = source === "all" ? events : events.filter((e) => e.source === source);

  return (
    <div className="space-y-6">
      <div className="scroll-thin -mx-1 overflow-x-auto px-1 pb-1">
        <SegmentedControl
          label="Filter by source"
          value={source}
          onChange={setSource}
          options={[
            { value: "all" as const, label: "All", count: events.length },
            ...present.map((s) => ({ value: s, label: labels[s], count: events.filter((e) => e.source === s).length })),
          ]}
        />
      </div>
      <div className="rounded-2xl border border-line bg-surface px-5 pt-6 pb-3 sm:px-6">
        <ActivityTimeline events={visible} />
      </div>
    </div>
  );
}
