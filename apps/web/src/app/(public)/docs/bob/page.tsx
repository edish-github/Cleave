import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { SiteShell } from "@/components/landing/SiteShell";
import { ButtonLink } from "@/components/ui/Button";
import { bobFiles, commands, guardRules, mcpTools } from "@/content/bob";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Run Cleave in Bob",
  description: "Install the ✂ Cleave mode in IBM Bob: the custom mode, the MCP server that is Bob's only write surface, and the guard hooks.",
};

const sections = [
  { id: "install", label: "Install" },
  { id: "mode", label: "The mode" },
  { id: "tools", label: "Cleave tools" },
  { id: "hooks", label: "Hooks" },
  { id: "run", label: "Run a split" },
  { id: "headless", label: "Headless runs" },
];

export default function BobDocsPage() {
  return (
    <SiteShell>
    <main id="main" className="mx-auto max-w-[1200px] px-5 pt-12 pb-24 sm:px-8 sm:pt-20">
      <div className="max-w-[720px]">
        <p className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">Docs · IBM Bob</p>
        <h1 className="mt-4 font-display text-[48px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[64px]">
          Run Cleave in Bob
        </h1>
        <p className="mt-6 text-[18px] leading-relaxed text-ink-2">
          Cleave&apos;s planner is a custom mode in IBM Bob. Bob groups and orders the hunks Cleave gives it, and it has no
          tool that can write code. These are the files the mode ships with, exactly as <code className="font-mono text-[15px]">cleave init</code>{" "}
          installs them.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-8">
            <p className="text-[12px] font-medium text-ink-3">On this page</p>
            <ul className="mt-3 space-y-1 border-l border-line">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-[14px] text-ink-3 hover:border-ink hover:text-ink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 max-w-[760px] space-y-20">
          <Step id="install" n={1} title="Install the engine and the mode">
            <p>
              The engine is a Python package with a <code>cleave</code> command. <code>cleave init</code> copies the mode, the
              MCP server entry, the hooks and the mode rules into your repository&apos;s <code>.bob/</code> folder, so the
              whole team shares the same setup.
            </p>
            <CodeBlock title="From the Cleave repository" code={commands.install} />
            <CodeBlock title="In the repository you want to split" code={commands.init} />
          </Step>

          <Step id="mode" n={2} title="The ✂ Cleave mode">
            <p>
              The mode&apos;s tool groups are the guarantee. It can read, call MCP tools, spawn read-only{" "}
              <code>explore</code> subagents and keep a todo list. It has no <code>edit</code> and no <code>execute</code>{" "}
              group, so it cannot change a file or run a command, however it is prompted.
            </p>
            <CodeBlock title={bobFiles.mode.path} code={bobFiles.mode.code} />
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ["read", true],
                ["mcp", true],
                ["subagent (explore)", true],
                ["todo", true],
                ["edit", false],
                ["execute", false],
              ].map(([group, allowed]) => (
                <li key={String(group)} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px]">
                  {allowed ? <Check className="size-4 text-ok" strokeWidth={2.4} /> : <X className="size-4 text-ink-3" />}
                  <code className={allowed ? "text-ink" : "text-ink-3 line-through"}>{String(group)}</code>
                </li>
              ))}
            </ul>
          </Step>

          <Step id="tools" n={3} title="Cleave tools: Bob's only write surface">
            <p>
              Bob changes the plan only through the Cleave MCP server. None of its eleven tools can write source code;
              the ones that write touch the plan, <code>.cleave/</code> or <code>cleave/*</code> branches built from
              existing hunks.
            </p>
            <CodeBlock title={bobFiles.mcp.path} code={bobFiles.mcp.code} />
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line bg-canvas/60 text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Tool</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">What it does</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Writes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mcpTools.map((tool) => (
                    <tr key={tool.name}>
                      <td className="px-4 py-3 align-top">
                        <code className="text-[12px] break-words text-ink">{tool.name}</code>
                        <p className="mt-1 text-ink-3 sm:hidden">{tool.does}</p>
                      </td>
                      <td className="hidden px-4 py-3 align-top text-ink-2 sm:table-cell">{tool.does}</td>
                      <td className="px-4 py-3 text-right align-top whitespace-nowrap text-ink-3">{tool.writes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Step>

          <Step id="hooks" n={4} title="Hooks: a second lock and an audit trail">
            <p>
              A <code>PreToolUse</code> hook guards every tool call while a run is active, and a <code>PostToolUse</code>{" "}
              hook appends each call to the run&apos;s event log. That log is where &ldquo;0 lines written&rdquo; on every
              proof page comes from. Hooks are shell commands, so they cost no Bobcoins.
            </p>
            <CodeBlock title={bobFiles.hooks.path} code={bobFiles.hooks.code} />
            <ul className="space-y-2">
              {guardRules.map((rule) => (
                <li key={rule} className="flex items-start gap-3 text-[15px] text-ink-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
                  {rule}
                </li>
              ))}
            </ul>
          </Step>

          <Step id="run" n={5} title="Run a split in Bob IDE">
            <p>
              Switch Bob to <strong className="font-medium text-ink">✂ Cleave</strong> and name the branch to split. Bob
              reads the diff in parallel slices with <code>explore</code> subagents, proposes layers, verifies them, and
              moves atoms when a layer fails. After three rounds it merges the two layers and says so instead of writing
              glue code.
            </p>
            <CodeBlock title="Message to Bob" code={commands.ideRequest} />
            <p>When the run finishes, send it to the web app to get the stack pages and a shareable proof.</p>
            <CodeBlock title="Terminal" code={commands.push} wrap />
          </Step>

          <Step id="headless" n={6} title="Headless runs with bob run">
            <p>
              The same mode runs without the IDE through Bob Shell. The runner uses this command, and the cost cap comes
              from the repository&apos;s Bobcoin setting.
            </p>
            <CodeBlock title="Terminal" code={commands.headless} wrap />
            <p>
              To start splits from the web app instead, keep a runner going on your machine. It asks for runs you queue on
              New split, runs each one with the command above, streams its events to the run&apos;s page and sends the
              finished bundle, exactly like <code>cleave push</code>.
            </p>
            <CodeBlock title="Terminal" code={`export CLEAVE_URL=<your deployment> CLEAVE_TOKEN=clv_…\n${commands.runner}`} wrap />
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] text-ink-2">See what a finished run looks like.</p>
              <div className="flex gap-2">
                <ButtonLink href={routes.login} size="sm">
                  Get started
                </ButtonLink>
              </div>
            </div>
          </Step>

          <p className="border-t border-line pt-6 text-[13px] text-ink-3">
            Bob configuration references: custom modes, MCP, lifecycle hooks and non-interactive runs in the{" "}
            <a
              href="https://bob.ibm.com/docs"
              target="_blank"
              rel="noreferrer"
              className="text-ink-2 underline-offset-2 hover:text-ink hover:underline"
            >
              IBM Bob documentation
            </a>
            .
          </p>
        </div>
      </div>
    </main>
    </SiteShell>
  );
}

function Step({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <p className="font-mono text-[12px] text-ink-3">0{n}</p>
      <h2 id={`${id}-title`} className="mt-2 text-[26px] leading-tight font-medium tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <div className="mt-5 space-y-5 text-[16px] leading-relaxed text-ink-2 [&_code]:rounded [&_code]:bg-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13.5px] [&_code]:text-ink">
        {children}
      </div>
    </section>
  );
}
