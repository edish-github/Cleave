import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { Logo } from "@/components/ui/Logo";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <AuthVisual />
      <div className="flex flex-col px-6 sm:px-10">
        <header className="flex h-16 items-center">
          <Link href="/" aria-label="Cleave home">
            <Logo />
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center pb-16">
          <div className="w-full max-w-[380px] animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
