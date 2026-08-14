"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [success, setSuccess] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setRequestError(null);
    if (!isSupabaseConfigured()) {
      setRequestError("Password reset is unavailable until Supabase is configured.");
      return;
    }

    try {
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !sessionData.user) {
        setRequestError("This password reset link is invalid or expired. Request a new one.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) {
        setRequestError(error.message);
        toast({ title: "Password update failed", description: error.message, variant: "destructive" });
        return;
      }

      setSuccess(true);
      toast({ title: "Password updated", description: "Your password has been changed successfully." });

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch {
      setRequestError("Unable to connect to Supabase. Check your project URL and publishable key.");
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center animate-fade-in">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/20">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Password reset complete</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Your new password is saved. Redirecting you to your dashboard...
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Set new password</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Enter your new password below
        </p>
      </div>

      {requestError && (
        <p role="alert" className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {requestError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/auth/login" className="text-violet-400 hover:text-violet-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
