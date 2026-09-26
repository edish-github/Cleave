import type { Metadata } from "next";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearancePage() {
  return <AppearanceSettings />;
}
