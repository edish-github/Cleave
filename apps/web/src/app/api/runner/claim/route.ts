import { NextResponse } from "next/server";
import { jsonError, requireRunner } from "@/server/http";
import { claimJob, JobError } from "@/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/runner/claim — `cleave runner` long-polls here.
 * Waits up to 25 s for a queued job of the runner's account. 200 with a Job
 * (/schemas/job.schema.json), or 204 when nothing is queued.
 */
export async function POST(request: Request) {
  const auth = await requireRunner(request);
  if ("response" in auth) return auth.response;
  try {
    const job = await claimJob(auth.runner, request.signal);
    return job ? NextResponse.json(job) : new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof JobError) return jsonError(e.message, e.status);
    console.error("claim failed", e);
    return jsonError("Couldn't claim a job.", 500);
  }
}
