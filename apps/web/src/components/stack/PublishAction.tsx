"use client";

import { ArrowRight } from "lucide-react";
import { useState, useTransition } from "react";
import { publishStackAction } from "@/server/actions/stacks";
import { Button } from "@/components/ui/Button";

export function PublishAction({
  stackId,
  layerCount,
  label = "Publish to GitHub",
}: {
  stackId: string;
  layerCount: number;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="lg"
        className="w-full sm:w-auto"
        loading={pending}
        trailingIcon={<ArrowRight className="size-4" />}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await publishStackAction(stackId);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? `Publishing ${layerCount} layers` : label}
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
