"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "@/server/actions/settings";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import type { User } from "@/lib/types";
import { SettingsSection } from "./SettingsSection";

const initial: ProfileState = { error: null, saved: false };

export function ProfileForm({ user }: { user: User }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={action}>
      <SettingsSection
        title="Profile"
        description="How you appear on stacks and in activity."
        footer={
          <>
            <p className="text-[13px] text-ink-3" aria-live="polite">
              {state.saved && !pending ? (
                <span className="inline-flex items-center gap-1.5 text-ok">
                  <Check className="size-3.5" strokeWidth={2.6} /> Saved
                </span>
              ) : (
                "Your email comes from how you signed in."
              )}
            </p>
            <Button type="submit" size="sm" loading={pending}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={state.error}>
            <Input
              id="name"
              name="name"
              defaultValue={user.name}
              autoComplete="name"
              required
              minLength={2}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "name-error" : undefined}
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" value={user.email} readOnly disabled />
          </Field>
        </div>
      </SettingsSection>
    </form>
  );
}
