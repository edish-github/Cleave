"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/services";

export async function connectRepositoryAction(fullName: string): Promise<{ error: string | null; repoId: string | null }> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return { error: "Choose a repository.", repoId: null };
  try {
    const { repoId } = await api.repositories.connect(fullName);
    revalidatePath("/app", "layout");
    return { error: null, repoId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't connect that repository.", repoId: null };
  }
}
