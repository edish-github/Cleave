import { cn } from "@/lib/cn";

/** Soft, blurred color field behind the hero. Pure CSS, no image asset. */
export function SpectrumBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("grain pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute top-[4%] left-[18%] h-[62%] w-[42%] rounded-full bg-[#b9b9f6] opacity-55 blur-[90px]" />
      <div className="absolute top-[2%] left-[48%] h-[52%] w-[34%] rounded-full bg-[#a7cdf3] opacity-50 blur-[90px]" />
      <div className="absolute top-[36%] left-[36%] h-[46%] w-[30%] rounded-full bg-[#f3c4da] opacity-45 blur-[100px]" />
      <div className="absolute top-[30%] left-[62%] h-[40%] w-[24%] rounded-full bg-[#f7dab4] opacity-45 blur-[100px]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}
