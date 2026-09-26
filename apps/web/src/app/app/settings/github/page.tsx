import { Check } from "lucide-react";
import type { Metadata } from "next";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { Badge } from "@/components/ui/Badge";
import { GitHubMark } from "@/components/ui/GitHubMark";
import { api } from "@/services";

export const metadata: Metadata = { title: "GitHub" };

const permissions = [
  "Read the diff of pull requests you choose to split",
  "Create branches named cleave/<stack>/<layer>",
  "Open one pull request per layer, each based on the one before it",
  "Read CI status on those pull requests",
];

export default async function GitHubSettingsPage() {
  const user = await api.user.get();
  const connected = user.githubLogin !== null;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="GitHub"
        description="Cleave reads pull requests and opens stacked ones through your GitHub account."
        footer={
          <>
            <p className="text-[13px] text-ink-3">
              {connected ? `Signed in as ${user.githubLogin}.` : "Requests the read:user and repo scopes."}
            </p>
            {connected ? null : (
              <BackendRequiredButton
                variant="primary"
                size="sm"
                icon={<GitHubMark className="size-3.5" />}
                title="GitHub connects through the backend"
                description="Signing in with GitHub needs the Cleave backend, which this preview doesn't run yet. The sample workspace works without it."
              >
                Connect GitHub
              </BackendRequiredButton>
            )}
          </>
        }
      >
        <div className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5">
          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-canvas">
            <GitHubMark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink">{connected ? user.githubLogin : "Not connected"}</p>
            <p className="text-[13px] text-ink-3">
              {connected ? "Repositories and pull requests sync automatically." : "You're using the sample workspace."}
            </p>
          </div>
          {connected ? <Badge tone="ok" dot>Connected</Badge> : <Badge>Sample</Badge>}
        </div>
      </SettingsSection>

      <SettingsSection title="What Cleave does with access" description="Nothing is pushed to your default branch.">
        <ul className="space-y-2.5">
          {permissions.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[14px] text-ink-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
              {p}
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
