"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/schemas";
import type { Profile } from "@/lib/types/domain";

export function ProfileSettingsForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string | null;
}) {
  const router = useRouter();
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: profile.fullName ?? "", avatarUrl: profile.avatarUrl },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    setRequestError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: data.fullName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to save profile");
      toast({ title: "Profile saved", description: "Your display name was updated." });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile";
      setRequestError(message);
      toast({ title: "Profile update failed", description: message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Full name</Label>
        <Input id="profile-name" autoComplete="name" {...register("fullName")} />
        {errors.fullName && <p className="text-xs text-red-400">{errors.fullName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" value={email ?? ""} readOnly />
        <p className="text-xs text-zinc-500">Email changes are managed by Supabase Auth.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-id">Account ID</Label>
        <Input id="account-id" value={profile.id} readOnly className="font-mono text-xs" />
        <p className="text-xs text-zinc-500">Share this ID with a workspace owner so they can add you as a member.</p>
      </div>
      {requestError && <p role="alert" className="text-sm text-red-400">{requestError}</p>}
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
