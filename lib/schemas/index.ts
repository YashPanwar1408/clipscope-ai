import { z } from "zod";

// ─── Shared URL validation ────────────────────────────────────────────────────

const supportedVideoUrl = z
  .string()
  .max(2048, "URL is too long")
  .url("Please enter a valid URL")
  .refine(
    (url) => {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const ytShorts =
        (hostname === "youtube.com" && /^\/shorts\/[A-Za-z0-9_-]+/.test(parsed.pathname)) ||
        (hostname === "youtu.be" && /^\/[A-Za-z0-9_-]+/.test(parsed.pathname));
      const igReels =
        hostname === "instagram.com" && /^\/reels?\/[A-Za-z0-9_-]+/.test(parsed.pathname);
      return parsed.protocol === "https:" && (ytShorts || igReels);
    },
    { message: "URL must be a YouTube Shorts or Instagram Reels link" }
  );

// ─── Video Import (single) ────────────────────────────────────────────────────

export const videoImportSchema = z.object({
  url: supportedVideoUrl,
  workspaceId: z.string().uuid("Invalid workspace ID"),
  idempotencyKey: z.string().uuid("Invalid idempotency key").optional(),
});

export type VideoImportInput = z.infer<typeof videoImportSchema>;

// ─── Batch Video Import (1–10 URLs) ───────────────────────────────────────────

export const batchImportSchema = z
  .object({
    urls: z
      .array(supportedVideoUrl)
      .min(1, "Provide at least one video URL")
      .max(10, "You can import up to 10 videos at a time"),
    workspaceId: z.string().uuid("Invalid workspace ID"),
    idempotencyKey: z.string().uuid("Invalid idempotency key").optional(),
  })
  .refine((data) => new Set(data.urls).size === data.urls.length, {
    message: "Duplicate URLs are not allowed in the same request",
    path: ["urls"],
  });

export type BatchImportInput = z.infer<typeof batchImportSchema>;

// ─── Manual Transcript ────────────────────────────────────────────────────────

export const manualTranscriptSchema = z.object({
  transcriptText: z
    .string()
    .trim()
    .min(1, "Transcript cannot be empty")
    .max(50000, "Transcript is too long (max 50,000 characters)"),
  language: z.string().trim().max(20, "Language code too long").default("en"),
});

export type ManualTranscriptInput = z.infer<typeof manualTranscriptSchema>;

// ─── Workspace ────────────────────────────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be under 80 characters"),
  description: z
    .string()
    .trim()
    .max(300, "Description must be under 300 characters")
    .optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be under 80 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(300, "Description must be under 300 characters")
    .nullable()
    .optional(),
}).refine((data) => data.name !== undefined || data.description !== undefined, {
  message: "Provide a workspace name or description to update",
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const deleteWorkspaceSchema = z.object({
  confirmName: z
    .string()
    .max(80)
    .min(1, "Please type the workspace name to confirm deletion"),
});

export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;

export const addMemberSchema = z.object({
  userId: z.string().uuid("Enter a valid account ID"),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// ─── Auth & Profile ───────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    fullName: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const passwordRecoverySchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export type PasswordRecoveryInput = z.infer<typeof passwordRecoverySchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  avatarUrl: z.string().url("Must be a valid URL").nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Research Chat ────────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(8000, "Message too long"),
  sessionId: z.string().uuid(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// ─── Report ───────────────────────────────────────────────────────────────────

export const createReportSchema = z.object({
  title: z.string().min(2).max(120),
  format: z.enum(["pdf", "markdown", "json"]),
  workspaceId: z.string().uuid(),
  videoIds: z.array(z.string().uuid()).min(1, "Select at least one video"),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

// ─── Comparison ───────────────────────────────────────────────────────────────

export const createComparisonSchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
    workspaceId: z.string().uuid("Invalid workspace ID"),
    videoIds: z
      .array(z.string().uuid("Invalid video ID"))
      .min(2, "Select at least 2 videos to compare")
      .max(10, "You can compare up to 10 videos"),
  })
  .refine((data) => new Set(data.videoIds).size === data.videoIds.length, {
    message: "Duplicate videos are not allowed",
    path: ["videoIds"],
  });

export type CreateComparisonInput = z.infer<typeof createComparisonSchema>;

export const renameChatSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(120),
});

export type RenameChatInput = z.infer<typeof renameChatSchema>;

export const workspaceIdSchema = z.string().uuid("Invalid workspace ID");
export const userIdSchema = z.string().uuid("Invalid user ID");
