"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { addMemberSchema, type AddMemberInput } from "@/lib/schemas";
import type { Workspace, WorkspaceMember } from "@/lib/types/domain";

export function MembersDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<AddMemberInput>({ userId: "", role: "viewer" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const canAssignAdmin = workspace.role === "owner";

  const loadMembers = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load members");
      setMembers(result.members ?? []);
    } catch (error) {
      toast({
        title: "Could not load members",
        description: error instanceof Error ? error.message : "Failed to load members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [workspace.id]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) void loadMembers();
    onOpenChange(nextOpen);
  };

  const submitMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const validation = addMemberSchema.safeParse(form);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? "Check the member details");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to add member");
      setForm({ userId: "", role: "viewer" });
      await loadMembers();
      router.refresh();
      toast({ title: "Member added", description: "Workspace access has been updated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add member";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to update role");
      await loadMembers();
      toast({ title: "Role updated", description: "The member's permissions have been changed." });
    } catch (error) {
      toast({
        title: "Role update failed",
        description: error instanceof Error ? error.message : "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const removeMember = async (member: WorkspaceMember) => {
    if (member.role === "owner") return;
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members/${member.userId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to remove member");
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
      router.refresh();
      toast({ title: "Member removed", description: "Workspace access has been revoked." });
    } catch (error) {
      toast({
        title: "Could not remove member",
        description: error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage members</DialogTitle>
          <DialogDescription>
            Add an existing ClipScope AI account by its account ID and assign a workspace role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitMember} className="space-y-3 border-b border-zinc-800 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-user-id">Account ID</Label>
            <Input
              id="member-user-id"
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
              placeholder="Account ID from their Settings page"
              autoComplete="off"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="member-role">Role</Label>
              <select
                id="member-role"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AddMemberInput["role"] }))}
                className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200"
              >
                {canAssignAdmin && <option value="admin">Admin</option>}
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
          {formError && <p role="alert" className="text-xs text-red-400">{formError}</p>}
        </form>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          <p className="text-xs font-medium text-zinc-400">Members</p>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading members...
            </div>
          ) : members.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No members found.</p>
          ) : members.map((member) => (
            <div key={member.userId} className="flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs text-zinc-400">{member.userId}</code>
              {member.role === "owner" ? (
                <Badge variant="secondary">Owner</Badge>
              ) : (
                <>
                  <select
                    aria-label={`Role for ${member.userId}`}
                    value={member.role}
                    onChange={(event) => void updateRole(member.userId, event.target.value)}
                    className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs capitalize text-zinc-200"
                  >
                    {canAssignAdmin && <option value="admin">Admin</option>}
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${member.userId}`}
                    onClick={() => void removeMember(member)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
