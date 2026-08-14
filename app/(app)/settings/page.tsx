import type { Metadata } from "next";
import Link from "next/link";
import { User, Bell, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { getCurrentProfile } from "@/lib/profile/server";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, email } = await getCurrentProfile();

  return (
    <div className="space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <PageHeader eyebrow="Account preferences" title="Settings" description="Manage your profile, notification preferences, and account security." />

      <Tabs defaultValue="profile">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5" />Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Profile information</CardTitle>
              <CardDescription>Update your display name and account details.</CardDescription>
            </CardHeader>
            <CardContent><ProfileSettingsForm profile={profile} email={email} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notification preferences</CardTitle>
              <CardDescription>Choose when you want to be notified.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm text-zinc-500">Notification settings coming soon.</p></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Password</CardTitle>
              <CardDescription>Send a secure password reset link to your account email.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline"><Link href="/auth/recover">Send password reset link</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
