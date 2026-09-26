import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";
import { api } from "@/services";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/app") ? params.next : "/app";
  return (
    <>
      <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-ink">Welcome back</h1>
      <p className="mt-2 mb-8 text-[15px] text-ink-3">Log in to see your stacks.</p>
      <LoginForm next={next} sample={api.source === "sample"} />
    </>
  );
}
