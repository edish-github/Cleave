"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { createRunnerTokenAction, revokeRunnerAction, type CreateTokenState } from "@/server/actions/runners";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";

export interface RunnerView {
  id: string;
  name: string;
  prefix: string;
  createdLabel: string;
  lastSeenLabel: string | null;
  bobVersion: string | null;
}

const initial: CreateTokenState = { token: null, name: null, error: null };

export function RunnerTokens({ runners, siteUrl }: { runners: RunnerView[]; siteUrl: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createRunnerTokenAction, initial);
  const [revoking, startRevoke] = useTransition();
  const [shownToken, setShownToken] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the new token once, when the action returns it
    if (state.token) setShownToken(state.token);
  }, [state.token]);

  const close = () => {
    setOpen(false);
    setShownToken(null);
  };

  const env = shownToken ? `export CLEAVE_URL=${siteUrl}\nexport CLEAVE_TOKEN=${shownToken}` : "";

  return (
    <>
      {runners.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {runners.map((r) => (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-ink-3">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{r.name}</p>
                <p className="truncate text-[12px] text-ink-3">
                  <span className="font-mono">{r.prefix}…</span> · created {r.createdLabel} ·{" "}
                  {r.lastSeenLabel ? `last used ${r.lastSeenLabel}` : "never used"}
                  {r.bobVersion ? ` · Bob Shell ${r.bobVersion}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={revoking}
                onClick={() => startRevoke(async () => void (await revokeRunnerAction(r.id)))}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-3">
          No tokens yet. Create one to push runs with <code className="font-mono">cleave push</code>.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="sm" icon={<KeyRound className="size-3.5" />} onClick={() => setOpen(true)}>
          Create token
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title={shownToken ? "Copy your token now" : "Create a runner token"}
        description={
          shownToken
            ? "This is the only time it's shown. Cleave stores a hash, not the token."
            : "The token lets `cleave push` and the runner send runs to your account."
        }
        footer={
          shownToken ? (
            <Button size="sm" onClick={close}>
              Done
            </Button>
          ) : undefined
        }
      >
        {shownToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-subtle px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{shownToken}</code>
              <CopyButton value={shownToken} />
            </div>
            <div className="rounded-xl border border-line bg-sunken">
              <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                <span className="font-mono text-[11px] text-ink-3">Your shell</span>
                <CopyButton value={env} />
              </div>
              <pre className="scroll-thin overflow-x-auto px-3 py-2 text-[12px] text-ink">{env}</pre>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <Field label="Name" htmlFor="runner-name" hint="Where you'll use it, e.g. “MacBook” or “CI”." error={state.error}>
              <Input id="runner-name" name="name" placeholder="My machine" maxLength={60} autoFocus />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={pending}>
                Create token
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
