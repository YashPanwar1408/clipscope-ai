"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { loginSchema, type LoginInput } from "@/lib/schemas"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { safeInternalPath } from "@/lib/auth/redirect"

export default function LoginPage() {
  const router = useRouter()
  const [requestError, setRequestError] = React.useState<string | null>(null)
  const [setupRequired] = React.useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("error") === "supabase_not_configured"
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setRequestError(null)
    if (!isSupabaseConfigured()) {
      setRequestError("Authentication is not configured yet. Add the Supabase URL and publishable key to .env.local.")
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        setRequestError(error.message)
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" })
        return
      }

      const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"))
      router.push(next)
      router.refresh()
    } catch {
      setRequestError("Unable to connect to Supabase. Check your project URL and publishable key.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Welcome back to ClipScope AI
        </p>
      </div>

      {(setupRequired || requestError) && (
        <p role="alert" className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {requestError ?? "Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app."}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/recover"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="text-violet-400 hover:text-violet-300">
          Create one
        </Link>
      </p>
    </div>
  )
}
