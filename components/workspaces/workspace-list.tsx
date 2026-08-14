"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FolderOpen,
  Plus,
  MoreVertical,
  Check,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/status";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  deleteWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type DeleteWorkspaceInput,
} from "@/lib/schemas";
import type { Workspace } from "@/lib/types/domain";
import { MembersDialog } from "@/components/workspaces/members-dialog";
import { PageHeader } from "@/components/ui/page-header";

interface WorkspaceListProps {
  initialWorkspaces: Workspace[];
  activeWorkspaceId: string | null;
}

export function WorkspaceList({ initialWorkspaces, activeWorkspaceId }: WorkspaceListProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>(initialWorkspaces);
  const [activeId, setActiveId] = React.useState<string | null>(activeWorkspaceId);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingWorkspace, setEditingWorkspace] = React.useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = React.useState<Workspace | null>(null);
  const [membersWorkspace, setMembersWorkspace] = React.useState<Workspace | null>(null);

  // Forms
  const createForm = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
  });

  const deleteForm = useForm<DeleteWorkspaceInput>({
    resolver: zodResolver(deleteWorkspaceSchema),
    defaultValues: { confirmName: "" },
  });

  // Switch workspace
  const handleSwitch = async (id: string) => {
    try {
      const res = await fetch(`/api/workspaces/${id}/switch`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to switch workspace");
      setActiveId(id);
      toast({
        title: "Workspace switched",
        description: "Active workspace updated successfully.",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to switch workspace",
        variant: "destructive",
      });
    }
  };

  // Create workspace
  const onCreateSubmit = async (data: CreateWorkspaceInput) => {
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create workspace");

      setWorkspaces((prev) => [resData.workspace, ...prev]);
      setActiveId(resData.workspace.id);
      setIsCreateOpen(false);
      createForm.reset();

      toast({
        title: "Workspace created",
        description: `"${resData.workspace.name}" has been created.`,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Creation failed",
        description: err instanceof Error ? err.message : "Error creating workspace",
        variant: "destructive",
      });
    }
  };

  // Edit workspace
  const onEditSubmit = async (data: UpdateWorkspaceInput) => {
    if (!editingWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update workspace");

      setWorkspaces((prev) =>
        prev.map((w) => (w.id === editingWorkspace.id ? { ...w, ...resData.workspace } : w))
      );
      setEditingWorkspace(null);

      toast({
        title: "Workspace updated",
        description: "Changes have been saved.",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Error updating workspace",
        variant: "destructive",
      });
    }
  };

  // Delete workspace
  const onDeleteSubmit = async (data: DeleteWorkspaceInput) => {
    if (!deletingWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${deletingWorkspace.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to delete workspace");

      const remaining = workspaces.filter((w) => w.id !== deletingWorkspace.id);
      setWorkspaces(remaining);
      if (activeId === deletingWorkspace.id) {
        setActiveId(remaining[0]?.id ?? null);
      }
      setDeletingWorkspace(null);
      deleteForm.reset();

      toast({
        title: "Workspace deleted",
        description: `"${deletingWorkspace.name}" was removed.`,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Deletion failed",
        description: err instanceof Error ? err.message : "Error deleting workspace",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization"
        title="Workspaces"
        description="Keep research and collaborators organized in separate workspaces."
        actions={<Button size="sm" onClick={() => setIsCreateOpen(true)}><Plus className="h-3.5 w-3.5" />New workspace</Button>}
      />

      {workspaces.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-5 w-5" />}
          title="No workspaces yet"
          description="Create a workspace to start organizing your videos, comparisons, and research sessions."
          action={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create your first workspace
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeId;
            return (
              <Card
                key={ws.id}
                className={`relative flex flex-col justify-between transition-all ${
                  isActive ? "border-violet-200/20 bg-violet-300/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.035)]" : "hover:border-white/[0.14]"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-medium text-zinc-100">
                          {ws.name}
                        </CardTitle>
                        {isActive && (
                          <Badge variant="outline" className="border-violet-500/40 text-violet-400 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {ws.role ?? "member"}
                      </Badge>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-zinc-400 hover:text-zinc-200">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleSwitch(ws.id)}>
                          <Check className="mr-2 h-3.5 w-3.5" />
                          Set as active
                        </DropdownMenuItem>
                        {(ws.role === "owner" || ws.role === "admin") && (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingWorkspace(ws);
                              editForm.reset({ name: ws.name, description: ws.description ?? "" });
                            }}
                          >
                            <Edit2 className="mr-2 h-3.5 w-3.5" />
                            Rename & details
                          </DropdownMenuItem>
                        )}
                        {(ws.role === "owner" || ws.role === "admin") && (
                          <DropdownMenuItem onClick={() => setMembersWorkspace(ws)}>
                            <FolderOpen className="mr-2 h-3.5 w-3.5" />
                            Manage members
                          </DropdownMenuItem>
                        )}
                        {ws.isOwner && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-400"
                              onClick={() => {
                                setDeletingWorkspace(ws);
                                deleteForm.reset({ confirmName: "" });
                              }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete workspace
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="line-clamp-2 text-xs text-zinc-400">
                    {ws.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
                    <span>Created {formatDate(ws.createdAt)}</span>
                    {!isActive ? (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleSwitch(ws.id)}>
                        Switch
                      </Button>
                    ) : (
                      <span className="text-xs text-violet-400 font-medium">Currently Selected</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Workspaces isolate videos, comparisons, and intelligence dossiers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Workspace name</Label>
              <Input
                id="create-name"
                placeholder="e.g. Q4 Competitor Analysis"
                {...createForm.register("name")}
              />
              {createForm.formState.errors.name && (
                <p className="text-xs text-red-400">
                  {createForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-desc">Description (optional)</Label>
              <Textarea
                id="create-desc"
                placeholder="Add context on the goals of this research..."
                rows={3}
                {...createForm.register("description")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog open={!!editingWorkspace} onOpenChange={(open) => !open && setEditingWorkspace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>Update workspace details and metadata.</DialogDescription>
          </DialogHeader>

          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Workspace name</Label>
              <Input id="edit-name" {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-red-400">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" rows={3} {...editForm.register("description")} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingWorkspace(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={editForm.formState.isSubmitting}>
                {editForm.formState.isSubmitting && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Confirmation Dialog */}
      <Dialog
        open={!!deletingWorkspace}
        onOpenChange={(open) => !open && setDeletingWorkspace(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Delete Workspace</DialogTitle>
            </div>
            <DialogDescription>
              This action cannot be undone. All videos, transcripts, comparisons, and reports in{" "}
              <strong className="text-zinc-200">&quot;{deletingWorkspace?.name}&quot;</strong> will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">
                Type <span className="font-semibold text-zinc-100">{deletingWorkspace?.name}</span> to confirm:
              </Label>
              <Input
                id="confirm-name"
                placeholder={deletingWorkspace?.name}
                {...deleteForm.register("confirmName")}
              />
              {deleteForm.formState.errors.confirmName && (
                <p className="text-xs text-red-400">
                  {deleteForm.formState.errors.confirmName.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingWorkspace(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={deleteForm.formState.isSubmitting}
              >
                {deleteForm.formState.isSubmitting && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Permanently delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {membersWorkspace && (
        <MembersDialog
          workspace={membersWorkspace}
          open={!!membersWorkspace}
          onOpenChange={(open) => !open && setMembersWorkspace(null)}
        />
      )}
    </div>
  );
}
