"use client";

import { ArrowRight, CornerDownLeft, FolderGit2, Layers, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SearchItem } from "@/lib/types";
import { Kbd } from "@/components/ui/Kbd";

const groupIcon = {
  Stacks: <Layers className="size-4" />,
  Repositories: <FolderGit2 className="size-4" />,
  "Go to": <ArrowRight className="size-4" />,
} as const;

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandMenu({
  items,
  open,
  onClose,
}: {
  items: SearchItem[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q))
      : items.filter((i) => i.group !== "Repositories").slice(0, 9);
    return matched.slice(0, 12);
  }, [items, query]);

  const close = useCallback(() => {
    setQuery("");
    setActive(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [close]);

  const go = (item: SearchItem | undefined) => {
    if (!item) return;
    close();
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  let lastGroup: string | null = null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto mt-[12vh] w-[min(92vw,560px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop open:animate-pop-in"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-ink-3" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          placeholder="Search stacks, repositories and pages"
          className="h-13 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <Kbd>Esc</Kbd>
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
        {results.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-ink-3">No matches for “{query}”.</li>
        ) : (
          results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id} role="presentation">
                {header ? (
                  <div className="px-3 pt-3 pb-1.5 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{header}</div>
                ) : null}
                <div
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                    index === active ? "bg-subtle" : "",
                  )}
                >
                  <span className="text-ink-3">{groupIcon[item.group]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{item.label}</span>
                    <span className="block truncate text-[12px] text-ink-3">{item.hint}</span>
                  </span>
                  {index === active ? <CornerDownLeft className="size-3.5 text-ink-3" aria-hidden="true" /> : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </dialog>
  );
}
