import { Check, GitPullRequest } from "lucide-react";

/**
 * Abstract picture of the workflow: one pull request fans out into layers,
 * and the layers converge into one verified stack. Coordinates live in a
 * 1000 × 540 space shared by the SVG lines and the HTML tiles.
 */
const W = 1000;
const H = 540;
const pr = { x: 500, y: 72 };
const layerY = 272;
const layerXs = [150, 325, 500, 675, 850];
const done = { x: 500, y: 470 };
const layerNames = ["Data model", "Logic", "Feature", "API", "Tests"];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function WorkflowVisual() {
  return (
    <div className="relative mx-auto aspect-[1000/540] w-full max-w-[880px]" role="img" aria-label="One pull request splits into five layers, which converge into one verified stack">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="spectrum" gradientUnits="userSpaceOnUse" x1="0" y1="90" x2="0" y2="450">
            <stop offset="0" stopColor="#8f8ff2" />
            <stop offset="0.45" stopColor="#e58bc7" />
            <stop offset="0.8" stopColor="#f4a56b" />
            <stop offset="1" stopColor="#f2c05a" />
          </linearGradient>
        </defs>
        {layerXs.map((x, i) => (
          <path
            key={`out-${x}`}
            d={`M${pr.x} ${pr.y + 30} C ${pr.x} ${pr.y + 120}, ${x} ${layerY - 120}, ${x} ${layerY - 30}`}
            pathLength={1}
            className="draw-line"
            style={{ animationDelay: `${120 + i * 90}ms` }}
            fill="none"
            stroke="url(#spectrum)"
            strokeWidth={1.3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {layerXs.map((x, i) => (
          <path
            key={`in-${x}`}
            d={`M${x} ${layerY + 30} C ${x} ${layerY + 120}, ${done.x} ${done.y - 120}, ${done.x} ${done.y - 34}`}
            pathLength={1}
            className="draw-line"
            style={{ animationDelay: `${900 + i * 90}ms` }}
            fill="none"
            stroke="url(#spectrum)"
            strokeWidth={1.3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Pull request */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 animate-fade-up"
        style={{ left: pct(pr.x, W), top: pct(pr.y, H) }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-card backdrop-blur-md sm:px-4 sm:py-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-canvas">
            <GitPullRequest className="size-3.5" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-[13px] font-medium text-ink">One large pull request</span>
            <span className="block text-[11px] text-ink-3">Too big to review well</span>
          </span>
        </div>
      </div>

      {/* Layers */}
      {layerXs.map((x, i) => (
        <div
          key={x}
          className="absolute -translate-x-1/2 -translate-y-1/2 animate-fade-up"
          style={{ left: pct(x, W), top: pct(layerY, H), animationDelay: `${520 + i * 80}ms` }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-2 py-1.5 shadow-card backdrop-blur-md sm:px-3 sm:py-2">
            <span className="font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <span className="hidden text-[12px] font-medium text-ink md:block">{layerNames[i]}</span>
          </div>
        </div>
      ))}

      {/* Verified */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 animate-fade-up"
        style={{ left: pct(done.x, W), top: pct(done.y, H), animationDelay: "1500ms" }}
      >
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-5 rounded-[28px] bg-[conic-gradient(from_180deg,#8f8ff2,#e58bc7,#f4a56b,#f2c05a,#8fd0f2,#8f8ff2)] opacity-45 blur-2xl"
          />
          <div className="relative flex items-center gap-2.5 rounded-2xl border border-white/80 bg-white px-3 py-2 shadow-pop sm:px-4 sm:py-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-ok-soft text-ok">
              <Check className="size-4" strokeWidth={2.2} />
            </span>
            <span className="hidden sm:block">
              <span className="block text-[13px] font-medium text-ink">Verified stack</span>
              <span className="block text-[11px] text-ink-3">Every layer passes · identical to the original</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
