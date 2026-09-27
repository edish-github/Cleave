"use client";

import { Check } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { Section } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import type { RepoConfig } from "@/lib/types";
import { updateRunSettingsAction, type RunSettingsState } from "@/server/actions/repositories";

const initial: RunSettingsState = { error: null, saved: false };

/**
 * A repository's run settings: shown as a list, edited in place. Splits started from the
 * browser run with them on a fresh clone, so the setup command must install what the check
 * needs. In the sample workspace `readOnlyAction` replaces the Edit button.
 */
export function RunSettings({
  repoId,
  config,
  readOnlyAction,
  footer,
}: {
  repoId: string;
  config: RepoConfig;
  readOnlyAction?: ReactNode;
  footer: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: RunSettingsState, formData: FormData) => {
      const next = await updateRunSettingsAction(repoId, prev, formData);
      if (next.saved) setEditing(false);
      return next;
    },
    initial,
  );

  // After a rejected save React resets the form to its defaults: make those what was typed.
  const value = (key: keyof RepoConfig) => state.values?.[key] ?? String(config[key] ?? "");

  const edit = readOnlyAction ?? (
    <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={editing}>
      Edit
    </Button>
  );

  return (
    <Section title="Run settings" action={edit}>
      {editing ? (
        <Card>
          <form action={action} className="space-y-4 p-4">
            <Field label="Check command" htmlFor="checkCommand" hint="Must pass on every layer.">
              <Input id="checkCommand" name="checkCommand" defaultValue={value("checkCommand")} required className="font-mono text-[13px]" />
            </Field>
            <Field
              label="Setup command"
              htmlFor="setupCommand"
              hint="Runs in each layer's fresh checkout before the check, e.g. creating .venv and installing requirements."
            >
              <Input id="setupCommand" name="setupCommand" defaultValue={value("setupCommand")} className="font-mono text-[13px]" />
            </Field>
            <Field label="Working directory" htmlFor="workingDirectory" hint="Where both commands run, relative to the repository root.">
              <Input id="workingDirectory" name="workingDirectory" defaultValue={value("workingDirectory")} className="font-mono text-[13px]" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Layer size limit" htmlFor="maxLayerLines">
                <Input id="maxLayerLines" name="maxLayerLines" type="number" min={50} max={5000} step={1} defaultValue={value("maxLayerLines")} required />
              </Field>
              <Field label="Bobcoin cap" htmlFor="bobcoinCap">
                <Input id="bobcoinCap" name="bobcoinCap" type="number" min={0.5} max={50} step={0.5} defaultValue={value("bobcoinCap")} required />
              </Field>
            </div>
            {state.error ? (
              <p className="text-[13px] text-bad" role="alert">
                {state.error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={pending}>
                Save
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <dl className="divide-y divide-line text-[13px]">
            <Setting label="Check command" value={config.checkCommand} mono hint="Must pass on every layer" />
            <Setting label="Setup command" value={config.setupCommand || "None"} mono={Boolean(config.setupCommand)} />
            <Setting label="Working directory" value={config.workingDirectory} mono />
            <Setting label="Layer size limit" value={`${config.maxLayerLines} lines`} />
            <Setting label="Bobcoin cap" value={`${config.bobcoinCap} per run`} hint="Passed to bob run as --max-cost" />
          </dl>
        </Card>
      )}
      <p className="px-1 text-[12px] text-ink-3" aria-live="polite">
        {state.saved && !editing ? (
          <span className="mr-2 inline-flex items-center gap-1 text-ok">
            <Check className="size-3.5" strokeWidth={2.6} /> Saved.
          </span>
        ) : null}
        {footer}
      </p>
    </Section>
  );
}

function Setting({ label, value, mono, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className={mono ? "mt-1 font-mono text-[12px] break-all text-ink" : "mt-1 text-[14px] text-ink"}>{value}</dd>
      {hint ? <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}
