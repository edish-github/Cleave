"use client";

import { Check, Lock, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { connectRepositoryAction } from "@/server/actions/repositories";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { routes } from "@/lib/site";
import type { AvailableRepository } from "@/lib/types";

export function ConnectRepository({
  available,
  variant = "secondary",
}: {
  available: AvailableRepository[];
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter((r) => !q || r.fullName.toLowerCase().includes(q)).slice(0, 50);
  }, [available, query]);

  const connect = (fullName: string) => {
    setBusy(fullName);
    setError(null);
    startTransition(async () => {
      const result = await connectRepositoryAction(fullName);
      setBusy(null);
      if (result.error || !result.repoId) {
        setError(result.error ?? "We couldn't connect that repository.");
        return;
      }
      setOpen(false);
      router.push(routes.repository(result.repoId));
    });
  };

  return (
    <>
      <Button variant={variant} icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Connect repository
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Connect a repository"
        description="Repositories you can push to on GitHub. Cleave reads their pull requests and opens stacked ones; it never pushes to your default branch."
        className="w-[min(92vw,560px)]"
      >
        {available.length ? (
          <div className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Filter repositories</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name"
                className="h-9 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-accent-soft"
              />
            </label>
            <ul className="scroll-thin max-h-[360px] divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {visible.map((r) => (
                <li key={r.fullName} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[14px] text-ink">
                      {r.fullName}
                      {r.private ? <Lock className="size-3 shrink-0 text-ink-3" aria-label="Private" /> : null}
                    </span>
                    {r.language ? <span className="block text-[12px] text-ink-3">{r.language}</span> : null}
                  </span>
                  {r.connected ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-ok">
                      <Check className="size-3.5" /> Connected
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy === r.fullName} disabled={busy !== null} onClick={() => connect(r.fullName)}>
                      Connect
                    </Button>
                  )}
                </li>
              ))}
              {!visible.length ? <li className="px-3.5 py-6 text-center text-[13px] text-ink-3">No repositories match.</li> : null}
            </ul>
            {error ? (
              <p role="alert" className="text-[13px] text-bad">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[14px] text-ink-2">
            No repositories came back from GitHub. Sign out and sign in with GitHub again to grant repository access.
          </p>
        )}
      </Dialog>
    </>
  );
}
