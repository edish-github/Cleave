"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Visibility } from "@/lib/types";
import { routes } from "@/lib/site";
import { api } from "@/services";

export interface ActionResult {
  error: string | null;
}

export async function startSplitAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const repoId = String(formData.get("repoId") ?? "");
  const prNumber = Number(formData.get("prNumber"));
  if (!repoId || !Number.isInteger(prNumber)) return { error: "Choose a repository and a pull request." };

  let stackId: string;
  try {
    ({ stackId } = await api.stacks.start({ repoId, prNumber }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't start the analysis." };
  }
  revalidatePath("/app", "layout");
  redirect(routes.stack(stackId));
}

export async function publishStackAction(stackId: string): Promise<ActionResult> {
  try {
    await api.stacks.publish(stackId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't publish this stack." };
  }
  revalidatePath("/app", "layout");
  redirect(routes.published(stackId));
}

export async function resolveReviewAction(stackId: string): Promise<ActionResult> {
  try {
    await api.stacks.resolveReview(stackId, "merge");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't apply that change." };
  }
  revalidatePath("/app", "layout");
  return { error: null };
}

export async function setVisibilityAction(stackId: string, visibility: Visibility): Promise<ActionResult> {
  try {
    await api.stacks.setVisibility(stackId, visibility);
  } catch {
    return { error: "We couldn't update sharing." };
  }
  revalidatePath(routes.stack(stackId));
  revalidatePath(routes.proof(stackId));
  return { error: null };
}
