"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routes } from "@/lib/site";
import { api } from "@/services";
import type { ActionResult } from "./stacks";

/** Queue a split for the user's runner, then open its run page. */
export async function startRunAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const repoId = String(formData.get("repoId") ?? "");
  const prNumber = Number(formData.get("prNumber"));
  if (!repoId || !Number.isInteger(prNumber) || prNumber < 1) return { error: "Choose a repository and a pull request." };

  let runId: string;
  try {
    ({ runId } = await api.runs.start({ repoId, prNumber }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't queue the run." };
  }
  revalidatePath("/app", "layout");
  redirect(routes.run(runId));
}

export async function cancelRunAction(runId: string): Promise<ActionResult> {
  try {
    await api.runs.cancel(runId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't cancel the run." };
  }
  revalidatePath(routes.run(runId));
  return { error: null };
}
