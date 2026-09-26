import { NextResponse } from "next/server";
import { routes, site } from "@/lib/site";
import { jsonError, readJson, requireRunner } from "@/server/http";
import { completeJob, JobError, runningJobFor } from "@/server/jobs";
import { validateCompletion } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runner/runs/:runId/complete — {status: "succeeded", bundle} or
 * {status: "failed", error}. A bundle is stored like `cleave push` and the response names
 * the stack; a failure answers 204.
 */
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await requireRunner(request);
  if ("response" in auth) return auth.response;
  const { runId } = await params;

  const body = await readJson(request, 20 * 1024 * 1024);
  if ("response" in body) return body.response;
  const completion = validateCompletion(body.data);
  if (!completion.ok) return jsonError("Body doesn't match /schemas/job.schema.json#/$defs/completion.", 422, completion.errors);
  if (completion.value.status === "succeeded" && !completion.value.bundle) return jsonError("A succeeded job needs its bundle.", 422);

  try {
    const job = await runningJobFor(auth.runner, runId);
    const stored = await completeJob(auth.runner, job, completion.value);
    if (!stored) return new NextResponse(null, { status: 204 });
    return NextResponse.json({
      stack_id: stored.stackId,
      run_id: stored.runId,
      status: stored.status,
      stack_url: `${site.url}${routes.stack(stored.stackId)}`,
      proof_url: `${site.url}${routes.proof(stored.stackId)}`,
    });
  } catch (e) {
    if (e instanceof JobError) return jsonError(e.message, e.status);
    console.error("complete failed", e);
    return jsonError("Couldn't complete the job.", 500);
  }
}
