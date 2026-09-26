import { ArrowUpRight, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { BackendRequiredButton } from "@/components/ui/BackendRequired";
import { ButtonLink } from "@/components/ui/Button";
import { Diamond } from "@/components/ui/Diamond";
import { commands } from "@/content/bob";
import { routes } from "@/lib/site";

export const metadata: Metadata = { title: "Bob & runners" };

const tokenCopy = {
  title: "Runner tokens need the backend",
  description:
    "Tokens are created and stored (as hashes) by the Cleave backend, which this preview doesn't run yet. You can still set up the ✂ Cleave mode in Bob IDE today.",
};

export default function RunnersSettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsSection
        title="Bob IDE"
        description="Split changes where you work: the ✂ Cleave mode plans the layers in Bob IDE, then cleave push sends the run here."
        footer={
          <>
            <p className="text-[13px] text-ink-3">Mode, MCP server and hooks install with one command.</p>
            <ButtonLink href={routes.bobDocs} variant="secondary" size="sm" trailingIcon={<ArrowUpRight className="size-3.5" />}>
              Setup guide
            </ButtonLink>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CodeBlock title="In your repository" code={commands.init} />
          <CodeBlock title="After a run in Bob IDE" code={commands.push} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Runners"
        description="A runner executes bob run on your own machine with your Bob Shell login, git and gh credentials. No secrets reach Cleave."
        footer={
          <>
            <p className="text-[13px] text-ink-3">Each token is shown once and stored only as a hash.</p>
            <BackendRequiredButton variant="primary" size="sm" icon={<KeyRound className="size-3.5" />} {...tokenCopy}>
              Create token
            </BackendRequiredButton>
          </>
        }
      >
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-8 text-center">
          <Diamond className="size-6 text-ink-3" />
          <p className="mt-3 text-[14px] font-medium text-ink">No runners yet</p>
          <p className="mt-1 max-w-[360px] text-[13px] text-ink-3">
            Create a token, then start a runner. It shows up here with its Bob Shell version and when it was last seen.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <CodeBlock title="Start a runner" code={commands.runner} wrap />
          <CodeBlock title="What the runner calls" code={commands.headless} wrap />
        </div>
      </SettingsSection>
    </div>
  );
}
