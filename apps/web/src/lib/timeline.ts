import type { TimelineEvent } from "@/components/stack/ActivityTimeline";
import { formatDateTime, timeAgo } from "./format";
import { routes } from "./site";
import type { ActivityEvent } from "./types";

/**
 * Formats activity on the server so client components render the same strings
 * the server did (no hydration drift from relative times).
 */
export function toTimeline(events: ActivityEvent[], now: number, stackTitles?: Map<string, string>): TimelineEvent[] {
  return events.map((event) => ({
    ...event,
    when: timeAgo(event.at, now),
    whenExact: formatDateTime(event.at),
    ...(stackTitles
      ? { stackTitle: stackTitles.get(event.stackId), stackHref: routes.stack(event.stackId) }
      : {}),
  }));
}
