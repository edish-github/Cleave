import { Check } from "lucide-react";

const layers = [
  { w: "78%", label: "Data model" },
  { w: "64%", label: "Booking logic" },
  { w: "86%", label: "Cancellation" },
  { w: "58%", label: "API changes" },
  { w: "72%", label: "Tests" },
];

/** Dark, abstract panel for the auth pages. Pure CSS, no image asset. */
export function AuthVisual() {
  return (
    <div className="grain relative hidden overflow-hidden bg-[#0d0d11] lg:flex lg:flex-col">
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute top-[8%] left-[10%] h-[46%] w-[60%] rounded-full bg-[#5b5bd6] opacity-45 blur-[110px]" />
        <div className="absolute top-[40%] left-[40%] h-[40%] w-[50%] rounded-full bg-[#e58bc7] opacity-25 blur-[120px]" />
        <div className="absolute bottom-[4%] left-[6%] h-[30%] w-[40%] rounded-full bg-[#f4a56b] opacity-20 blur-[120px]" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-14">
        <div className="w-full max-w-[380px] space-y-2.5">
          {layers.map((layer, i) => (
            <div
              key={layer.label}
              className="flex animate-fade-up items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 backdrop-blur-sm"
              style={{ animationDelay: `${150 + i * 90}ms`, marginLeft: `${i * 10}px` }}
            >
              <span className="font-mono text-[11px] text-white/40">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[13px] text-white/85">{layer.label}</span>
              <span className="ml-auto h-1 rounded-full bg-white/15" style={{ width: layer.w, maxWidth: 120 }} />
              <span className="flex size-4 items-center justify-center rounded-full bg-[#5fc596]/20">
                <Check className="size-2.5 text-[#7fd6ab]" strokeWidth={3} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-14 pb-14">
        <p className="max-w-md font-display text-[30px] leading-[1.15] text-white/95">
          Every layer passes on its own. The stack is the original change, byte for byte.
        </p>
      </div>
    </div>
  );
}
