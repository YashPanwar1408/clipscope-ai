import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-[linear-gradient(145deg,rgba(155,135,245,.2),rgba(110,168,254,.08))] text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
        <span className="absolute left-1 top-1 h-2 w-2 rounded-tl border-l border-t border-violet-200/70" />
        <Scissors aria-hidden="true" className="h-[17px] w-[17px]" strokeWidth={1.8} />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-semibold tracking-[-0.035em] text-zinc-100">
            ClipScope <span className="text-violet-300">AI</span>
          </span>
          <span className="mt-1 block truncate text-[9px] font-medium uppercase tracking-[0.13em] text-zinc-500">
            Short-form intelligence
          </span>
        </span>
      )}
    </span>
  );
}
