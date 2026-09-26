"use client";

import { ExternalLink, Share2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setVisibilityAction } from "@/server/actions/stacks";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Dialog } from "@/components/ui/Dialog";
import { Switch } from "@/components/ui/Switch";
import type { Visibility } from "@/lib/types";

export function ShareProof({
  stackId,
  visibility,
  proofUrl,
  disabled,
}: {
  stackId: string;
  visibility: Visibility;
  proofUrl: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(visibility === "public");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (next: boolean) => {
    setIsPublic(next);
    startTransition(async () => {
      const result = await setVisibilityAction(stackId, next ? "public" : "private");
      if (result.error) {
        setIsPublic(!next);
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Share2 className="size-3.5" />} onClick={() => setOpen(true)} disabled={disabled}>
        Share proof
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share the proof"
        description="A public page with this stack's checks, layers and evidence. Anyone with the link can view it; no code is shown."
        footer={
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <span>
              <span className="block text-[14px] font-medium text-ink">Public proof page</span>
              <span className="block text-[13px] text-ink-3">{isPublic ? "Anyone with the link" : "Only you"}</span>
            </span>
            <Switch checked={isPublic} onChange={toggle} label="Public proof page" disabled={pending} />
          </label>
          {isPublic ? (
            <div className="flex items-center gap-2 rounded-xl bg-subtle px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{proofUrl}</span>
              <CopyButton value={proofUrl} />
              <a
                href={proofUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open proof page"
                className="rounded-full p-1.5 text-ink-3 hover:bg-surface hover:text-ink"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          ) : null}
          {error ? <p className="text-[13px] text-bad">{error}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
