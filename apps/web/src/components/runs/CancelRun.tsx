"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cancelRunAction } from "@/server/actions/runs";

export function CancelRun({ runId }: { runId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const result = await cancelRunAction(runId);
            setError(result.error);
          })
        }
      >
        Cancel run
      </Button>
      {error ? (
        <p role="alert" className="text-[12px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
