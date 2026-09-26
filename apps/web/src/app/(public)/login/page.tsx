import type { Metadata } from "next";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { devLoginEnabled, githubConfigured } from "@/server/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/app") ? params.next : "/app";
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <>
      <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-ink">Welcome to Cleave</h1>
      <p className="mt-2 mb-8 text-[15px] text-ink-3">Sign in with the GitHub account that owns your pull requests.</p>
      <LoginPanel next={next} github={githubConfigured} dev={devLoginEnabled} error={error} />
    </>
  );
}
