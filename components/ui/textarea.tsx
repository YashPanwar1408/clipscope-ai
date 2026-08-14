import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-white/[0.09] bg-[#0c0e12] px-3 py-2 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-600 transition-colors hover:border-white/[0.14]",
        "focus-visible:outline-none focus-visible:border-violet-300/50 focus-visible:ring-2 focus-visible:ring-violet-300/20 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
