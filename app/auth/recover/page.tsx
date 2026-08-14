"use client"

import * as React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, CheckCircle2 } from "lucide-react"
import { passwordRecoverySchema, type PasswordRecoveryInput } from "@/lib/schemas"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export default function RecoverPage() {
  const [sent, setSent] = React.useState(false)
  const [requestError, setRequestError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordRecoveryInput>({
    resolver: zodResolver(passwordRecoverySchema),
  })

  const onSubmit = async (data: PasswordRecoveryInput) => {
    setRequestError(null)
    if (!isSupabaseConfigured()) {
      setRequestError("Password recovery is unavailable until Supabase is configured.")
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fauth%2Freset`,
      })
      if (error) {
        setRequestError(error.message)
        toast({ title: "Could not send reset link", description: error.message, variant: "destructive" })
        return
      }
      setSent(true)
    } catch {
      setRequestError("Unable to connect to Supabase. Check your project URL and publishable key.")
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/20">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Check your inbox</h2>
          <p className="mt-1 text-sm text-zinc-400">
            If that email is registered, you&apos;ll receive a password reset link.
          </p>
        </div>
        <Link href="/auth/login" className="inline-block text-sm text-violet-400 hover:text-violet-300">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Reset password</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {requestError && (
        <p role="alert" className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {requestError}
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        Remember your password?{" "}
        <Link href="/auth/login" className="text-violet-400 hover:text-violet-300">
          Sign in
        </Link>
      </p>
    </div>
  )
}
