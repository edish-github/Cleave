import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { assets } from "@/lib/assets";
import { routes } from "@/lib/site";

const parts = [
  { title: "A custom mode", body: "No edit and no shell access. The mode's only write path is Cleave's MCP tools." },
  { title: "Lifecycle hooks", body: "A PreToolUse hook blocks any write outside the plan. Every call lands in an audit log." },
  { title: "Parallel subagents", body: "Read-only subagents study slices of the diff at once, so large changes stay readable." },
];

export function BobSection() {
  return (
    <section className="border-y border-line bg-surface px-5 py-24 sm:px-8 md:py-28">
      <div className="mx-auto grid max-w-[1200px] gap-14 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-[13px] font-medium text-accent-ink">Runs in IBM Bob</p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.06] tracking-[-0.02em] text-ink sm:text-[44px]">
            The AI can only move hunks.
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
            Cleave ships as a mode for IBM Bob. Bob decides how a change should be layered; Cleave checks every decision in
            code.
          </p>
          <dl className="mt-8 space-y-5">
            {parts.map((p) => (
              <div key={p.title} className="border-l border-line pl-4">
                <dt className="text-[14px] font-medium text-ink">{p.title}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-ink-3">{p.body}</dd>
              </div>
            ))}
          </dl>
          <Link
            href={routes.bobDocs}
            className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-ink hover:text-accent"
          >
            Set up the Bob mode <ArrowRight className="size-4" />
          </Link>
        </div>
        <Image
          src={assets.landingBobScreenshot.src}
          width={assets.landingBobScreenshot.width}
          height={assets.landingBobScreenshot.height}
          alt={assets.landingBobScreenshot.alt}
          className="h-auto w-full rounded-2xl border border-line shadow-pop"
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>
    </section>
  );
}
