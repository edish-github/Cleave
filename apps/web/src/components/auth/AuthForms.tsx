"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { routes } from "@/lib/site";
import { GitHubSignIn } from "./GitHubSignIn";

const initial: AuthFormState = { error: null, fieldErrors: {}, values: {} };

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[12px] text-ink-3" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
      {message}
    </p>
  );
}

export function LoginForm({ next, sample }: { next: string; sample: boolean }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  const fe = state.fieldErrors;

  return (
    <div>
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <FormError message={state.error} />
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values.email}
            aria-invalid={Boolean(fe.email)}
            aria-describedby={fe.email ? "email-error" : undefined}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={fe.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(fe.password)}
            aria-describedby={fe.password ? "password-error" : undefined}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Continue
        </Button>
      </form>
      <Divider />
      <GitHubSignIn next={next} sample={sample} />
      <p className="mt-8 text-center text-[14px] text-ink-3">
        Don&rsquo;t have an account?{" "}
        <Link href={routes.signup} className="font-medium text-ink underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
      {sample ? (
        <p className="mt-3 text-center text-[12px] text-ink-3">This preview signs you in to a sample workspace.</p>
      ) : null}
    </div>
  );
}

export function SignupForm({ sample }: { sample: boolean }) {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const fe = state.fieldErrors;

  return (
    <div>
      <form action={action} className="space-y-4" noValidate>
        <FormError message={state.error} />
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={state.values.name}
            aria-invalid={Boolean(fe.name)}
            aria-describedby={fe.name ? "name-error" : undefined}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values.email}
            aria-invalid={Boolean(fe.email)}
            aria-describedby={fe.email ? "email-error" : undefined}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={fe.password} hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(fe.password)}
            aria-describedby={fe.password ? "password-error" : "password-hint"}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>
      <Divider />
      <GitHubSignIn next="/app" sample={sample} />
      <p className="mt-8 text-center text-[14px] text-ink-3">
        Already have an account?{" "}
        <Link href={routes.login} className="font-medium text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
