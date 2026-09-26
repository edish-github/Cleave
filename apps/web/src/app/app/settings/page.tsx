import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SignOutButton } from "@/components/settings/SignOutButton";
import { api } from "@/services";

export const metadata: Metadata = { title: "Settings" };

export default async function ProfileSettingsPage() {
  const user = await api.user.get();
  return (
    <div className="space-y-6">
      <ProfileForm user={user} />
      <SettingsSection title="Session" description="Sign out of Cleave on this device.">
        <SignOutButton />
      </SettingsSection>
    </div>
  );
}
