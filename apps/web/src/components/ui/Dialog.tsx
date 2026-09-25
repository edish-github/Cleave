"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Accessible modal built on <dialog>. showModal() gives focus containment,
 * Escape to close and an inert background without extra dependencies.
 */
function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const onBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return { ref, onBackdropClick };
}

export function Dialog({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const { ref, onBackdropClick } = useNativeDialog(open, onClose);
  const titleId = useId();
  const descId = useId();

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop open:animate-pop-in backdrop:animate-fade-in",
        className,
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[17px] font-medium tracking-[-0.01em]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-full p-1.5 text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        {description ? (
          <p id={descId} className="mt-2 text-sm leading-relaxed text-ink-2">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

export function Drawer({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const { ref, onBackdropClick } = useNativeDialog(open, onClose);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      aria-labelledby={titleId}
      className={cn(
        "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[480px] border-l border-line bg-surface p-0 text-ink shadow-pop open:animate-slide-in-right backdrop:animate-fade-in",
        className,
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-medium tracking-[-0.01em]">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[13px] text-ink-3">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-1.5 text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}
