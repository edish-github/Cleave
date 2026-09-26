"use server";

import { redirect } from "next/navigation";
import { api } from "@/services";

export interface AuthFormState {
  error: string | null;
  fieldErrors: Partial<Record<"name" | "email" | "password", string>>;
  values: { name?: string; email?: string };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/app") ? next : "/app";
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (!EMAIL.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (Object.keys(fieldErrors).length) return { error: null, fieldErrors, values: { email } };

  try {
    await api.session.signIn({ email, password });
  } catch {
    return { error: "We couldn't sign you in. Try again in a moment.", fieldErrors: {}, values: { email } };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (name.length < 2) fieldErrors.name = "Enter your name.";
  if (!EMAIL.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (Object.keys(fieldErrors).length) return { error: null, fieldErrors, values: { name, email } };

  try {
    await api.session.signUp({ name, email, password });
  } catch {
    return { error: "We couldn't create your account. Try again in a moment.", fieldErrors: {}, values: { name, email } };
  }
  redirect("/app");
}

export async function gitHubSignInAction(formData: FormData): Promise<void> {
  await api.session.signInWithGitHub();
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  await api.session.signOut();
  redirect("/login");
}
