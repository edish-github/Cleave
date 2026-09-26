import Image from "next/image";
import { assets } from "@/lib/assets";

const facts = [
  { title: "Every layer passes on its own", body: "Each prefix of the stack is built in its own worktree and runs your test command." },
  { title: "Identical to the original", body: "The top layer's git tree hash matches the pull request's. Nothing lost, nothing added." },
  { title: "No code written by the AI", body: "Bob can only move existing hunks between layers. A hook blocks every source edit." },
];

export function ProductShowcase() {
  return (
    <section id="product" className="scroll-mt-20 px-5 sm:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="overflow-hidden rounded-[22px] border border-line bg-surface p-2 shadow-pop">
          <div className="flex h-8 items-center gap-2 px-3">
            <span className="size-2 rounded-full bg-line-strong" />
            <span className="size-2 rounded-full bg-line-strong" />
            <span className="size-2 rounded-full bg-line-strong" />
            <span className="mx-auto hidden rounded-full bg-subtle px-3 py-0.5 font-mono text-[11px] text-ink-3 sm:block">
              cleave · stack overview
            </span>
          </div>
          <Image
            src={assets.landingStackScreenshot.src}
            width={assets.landingStackScreenshot.width}
            height={assets.landingStackScreenshot.height}
            alt={assets.landingStackScreenshot.alt}
            className="h-auto w-full rounded-2xl border border-line"
            sizes="(min-width: 1200px) 1184px, 100vw"
            priority={false}
          />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {facts.map((f) => (
            <div key={f.title} className="border-t border-line pt-5">
              <h3 className="text-[15px] font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
