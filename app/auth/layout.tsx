import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your ClipScope AI account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#08090b]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(111,87,196,.12),transparent_48%)]"
      />
      <header className="relative z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4 sm:px-7">
        <Link href="/" aria-label="ClipScope AI home"><BrandMark /></Link>
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#101217]/90 p-6 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
