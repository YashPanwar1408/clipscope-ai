import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-zinc-950",
  {
    variants: {
      variant: {
        default:
          "border-violet-200/10 bg-violet-200/[0.09] text-violet-100",
        secondary:
          "border-white/[0.07] bg-white/[0.06] text-zinc-300",
        destructive:
          "border-red-300/10 bg-red-300/[0.08] text-red-300",
        outline: "border-zinc-700 text-zinc-400",
        success: "border-emerald-300/10 bg-emerald-300/[0.08] text-emerald-200",
        warning: "border-amber-300/10 bg-amber-300/[0.08] text-amber-200",
        info: "border-sky-300/10 bg-sky-300/[0.08] text-sky-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
