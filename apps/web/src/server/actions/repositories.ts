"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/lib/site";
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

export interface RunSettingsState {
  error: string | null;
  saved: boolean;
  /** What was submitted, so a rejected form keeps it. */
  values?: Record<string, string>;
}

/** Validates and stores a repository's run settings (what a split started in the browser runs with). */
export async function updateRunSettingsAction(repoId: string, _prev: RunSettingsState, formData: FormData): Promise<RunSettingsState> {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const checkCommand = text("checkCommand");
  const setupCommand = text("setupCommand");
  const workingDirectory = text("workingDirectory") || ".";
  const maxLayerLines = Number(text("maxLayerLines"));
  const bobcoinCap = Number(text("bobcoinCap"));
  const values = Object.fromEntries(
    ["checkCommand", "setupCommand", "workingDirectory", "maxLayerLines", "bobcoinCap"].map((k) => [k, text(k)]),
  );
  const reject = (error: string): RunSettingsState => ({ error, saved: false, values });

  if (!checkCommand) return reject("Enter the check command every layer must pass.");
  if (checkCommand.length > 1000 || setupCommand.length > 2000) return reject("That command is too long.");
  if (workingDirectory.startsWith("/") || workingDirectory.split("/").includes("..")) {
    return reject("The working directory must be a path inside the repository, like booking_system_backend.");
  }
  if (!Number.isInteger(maxLayerLines) || maxLayerLines < 50 || maxLayerLines > 5000) {
    return reject("The layer size limit must be a whole number from 50 to 5000.");
  }
  if (!Number.isFinite(bobcoinCap) || bobcoinCap <= 0 || bobcoinCap > 50) {
    return reject("The Bobcoin cap must be more than 0 and at most 50.");
  }
  try {
    await api.repositories.updateConfig(repoId, { checkCommand, setupCommand, workingDirectory, maxLayerLines, bobcoinCap });
  } catch (error) {
    return reject(error instanceof Error ? error.message : "We couldn't save the run settings.");
  }
  revalidatePath(routes.repository(repoId));
  return { error: null, saved: true };
}
