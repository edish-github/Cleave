"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import type { ThemePreference } from "@/lib/types";
import { SettingsSection } from "./SettingsSection";

const THEME_KEY = "cleave-theme";
const MOTION_KEY = "cleave-motion";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies to this page.
  }
}

function applyTheme(theme: ThemePreference) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const saved = read(THEME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with storage after hydration
    if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    setReduceMotion(read(MOTION_KEY) === "reduce");
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const chooseTheme = (next: ThemePreference) => {
    setTheme(next);
    write(THEME_KEY, next);
    applyTheme(next);
  };

  const chooseMotion = (next: boolean) => {
    setReduceMotion(next);
    write(MOTION_KEY, next ? "reduce" : null);
    if (next) document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Theme" description="Applies to the app on this device. The public pages stay light.">
        <SegmentedControl
          label="Theme"
          value={theme}
          onChange={chooseTheme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Motion">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-[14px] font-medium text-ink">Reduce motion</p>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Turns off entrance animations and progress effects. Your system setting is always respected.
            </p>
          </div>
          <Switch checked={reduceMotion} onChange={chooseMotion} label="Reduce motion" />
        </div>
      </SettingsSection>
    </div>
  );
}
