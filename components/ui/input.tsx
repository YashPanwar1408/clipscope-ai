import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-white/[0.09] bg-[#0c0e12] px-3 py-1 text-sm text-zinc-100 shadow-[inset_0_1px_1px_rgba(0,0,0,.18)] transition-[border-color,background,box-shadow] placeholder:text-zinc-600 hover:border-white/[0.14]",
          "focus-visible:outline-none focus-visible:border-violet-300/50 focus-visible:ring-2 focus-visible:ring-violet-300/20 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
