import { NextResponse } from "next/server";
import type { Event } from "@/lib/contracts";
import { jsonError, readText, requireRunner } from "@/server/http";
import { appendJobEvents, JobError, MAX_EVENTS_PER_BATCH, runningJobFor } from "@/server/jobs";
import { validateEvent } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runner/runs/:runId/events — a batch of events.ndjson lines (NDJSON, or a JSON
 * array), each checked against /schemas/event.schema.json. 204, or 409 when the job was
 * cancelled and the runner should stop.
 */
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await requireRunner(request);
  if ("response" in auth) return auth.response;
  const { runId } = await params;

  const body = await readText(request, 5 * 1024 * 1024);
  if ("response" in body) return body.response;

  let items: unknown[];
  try {
    const text = body.text.trim();
    items = text.startsWith("[") ? (JSON.parse(text) as unknown[]) : text ? text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as unknown) : [];
  } catch {
    return jsonError("Body must be NDJSON (one event per line) or a JSON array of events.", 400);
  }
  if (items.length > MAX_EVENTS_PER_BATCH) return jsonError(`At most ${MAX_EVENTS_PER_BATCH} events per batch.`, 413);

  const events: Event[] = [];
  for (const [i, item] of items.entries()) {
    const checked = validateEvent(item);
    if (!checked.ok) return jsonError(`Event ${i + 1} doesn't match /schemas/event.schema.json.`, 422, checked.errors);
    events.push(checked.value);
  }

  try {
    const job = await runningJobFor(auth.runner, runId);
    await appendJobEvents(job, events);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof JobError) return jsonError(e.message, e.status);
    console.error("events failed", e);
    return jsonError("Couldn't store the events.", 500);
  }
}
