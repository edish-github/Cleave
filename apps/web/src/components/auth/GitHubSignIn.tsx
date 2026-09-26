"use client";

import { useState } from "react";
import { gitHubSignInAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { GitHubMark } from "@/components/ui/GitHubMark";

/**
 * In the sample workspace there is no OAuth app to talk to, so the button says
 * so and offers the sample workspace instead of pretending to authenticate.
 */
export function GitHubSignIn({ next, sample }: { next: string; sample: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        icon={<GitHubMark />}
        onClick={() => setOpen(true)}
      >
        Continue with GitHub
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={sample ? "GitHub sign-in isn't connected yet" : "Continue with GitHub"}
        description={
          sample
            ? "This preview runs without the Cleave backend, so there is no GitHub app to authorize. You can explore the sample workspace instead."
            : "You'll be sent to GitHub to authorize Cleave."
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={gitHubSignInAction} onSubmit={() => setPending(true)}>
              <input type="hidden" name="next" value={next} />
              <Button type="submit" size="sm" loading={pending}>
                {sample ? "Open the sample workspace" : "Continue"}
              </Button>
            </form>
          </>
        }
      />
    </>
  );
}
