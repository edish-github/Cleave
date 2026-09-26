"use server";

import { redirect } from "next/navigation";
import { auth, devLoginEnabled, githubConfigured, liveEnabled, signIn, signOut } from "@/server/auth";
import { clearSession, writeSession } from "@/services/sample/state";

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/app") ? next : "/app";
}

/** Sign in with GitHub (Auth.js). */
export async function gitHubSignInAction(formData: FormData): Promise<void> {
  if (!githubConfigured) redirect("/login?error=github");
  await clearSession();
  await signIn("github", { redirectTo: safeNext(formData.get("next")) });
}

/** Open the labelled sample workspace. No account, no GitHub access. */
export async function sampleSignInAction(formData: FormData): Promise<void> {
  await writeSession({ name: "Sample User", email: "sample@cleave.dev" });
  redirect(safeNext(formData.get("next")));
}

/** Local testing only (see devLoginEnabled). */
export async function devSignInAction(formData: FormData): Promise<void> {
  if (!devLoginEnabled) redirect("/login");
  await clearSession();
  await signIn("dev", { login: String(formData.get("login") ?? ""), redirectTo: safeNext(formData.get("next")) });
}

export async function signOutAction(): Promise<void> {
  await clearSession();
  if (liveEnabled && (await auth())) await signOut({ redirectTo: "/login" });
  redirect("/login");
}
