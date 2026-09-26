import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";
import { api } from "@/services";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-ink">Create your account</h1>
      <p className="mt-2 mb-8 text-[15px] text-ink-3">Split your first pull request in a few minutes.</p>
      <SignupForm sample={api.source === "sample"} />
    </>
  );
}
