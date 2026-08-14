import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background,color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "primary-action bg-violet-300 text-[#171321] shadow-[0_1px_0_rgba(255,255,255,.22)_inset] hover:bg-violet-200 hover:shadow-[0_0_22px_rgba(155,135,245,.16)]",
        destructive:
          "border border-red-400/20 bg-red-400/[0.08] text-red-300 hover:bg-red-400/[0.14]",
        outline:
          "border border-white/[0.11] bg-white/[0.025] text-zinc-200 hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-zinc-50",
        secondary:
          "border border-white/[0.06] bg-white/[0.07] text-zinc-200 hover:bg-white/[0.11]",
        ghost:
          "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
        link: "text-violet-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
