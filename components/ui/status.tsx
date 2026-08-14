"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/[0.07] motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.09] bg-white/[0.012] px-4 py-16 text-center", className)}>
      {icon && (
        <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-violet-200/70">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-xl border border-red-300/10 bg-red-300/[0.025] px-4 py-16 text-center", className)}>
      <div className="mb-4 rounded-2xl border border-red-300/10 bg-red-300/[0.04] p-4 text-red-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ─── Separator ────────────────────────────────────────────────────────────────

function Separator({ className, orientation = "horizontal", ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      className={cn(
        "shrink-0 bg-zinc-800",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton, EmptyState, ErrorState, Separator }
