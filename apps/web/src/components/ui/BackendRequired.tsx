"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

type Variant = "primary" | "secondary" | "ghost" | "quiet";

/**
 * A button for actions that need the Cleave backend (GitHub, real publishing).
 * In the sample workspace it explains why the action isn't available instead of
 * pretending it happened.
 */
export function BackendRequiredButton({
  children,
  title = "Available once GitHub is connected",
  description = "This is the sample workspace. Connecting GitHub needs the Cleave backend, which this preview doesn't run yet. Everything else here works with sample data.",
  variant = "secondary",
  size = "md",
  icon,
  className,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} icon={icon} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        footer={
          <Button size="sm" onClick={() => setOpen(false)}>
            Got it
          </Button>
        }
      />
    </>
  );
}
