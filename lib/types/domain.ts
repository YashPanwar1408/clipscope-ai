// ==============================================================================
// CONTENT STUDIO — Shorts vs Reels Intelligence
// Core Domain Types
// ==============================================================================

export type VideoPlatform = "youtube_shorts" | "instagram_reels";
export type VideoProvider = VideoPlatform; // Backward compatibility

export type MetadataStatus =
  | "pending"
  | "fetching"
  | "ready"
  | "error"
  | "partial";

export type TranscriptStatus =
  | "pending"
  | "fetching"
  | "ready"
  | "unavailable"
  | "error";

export type AnalysisStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error"
  | "none";

export type VideoStatus = MetadataStatus;

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Workspace & Membership ───────────────────────────────────────────────────

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  role?: WorkspaceRole;
  isOwner?: boolean;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  profile?: Profile | null;
}

// ─── Video ────────────────────────────────────────────────────────────────────

export interface Video {
  id: string;
  workspaceId: string;
  platform: VideoPlatform;
  canonicalUrl: string;
  platformVideoId: string;
  title: string | null;
  description: string | null;
  creatorName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  metadataStatus: MetadataStatus;
  transcriptStatus: TranscriptStatus;
  analysisStatus: AnalysisStatus;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Convenience aliases for existing UI components
  url?: string;
  provider?: VideoPlatform;
  providerId?: string;
  channelName?: string | null;
  channelId?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  status?: VideoStatus;
  transcript?: string | null;
}

export interface VideoImportRequest {
  url: string;
  workspaceId: string;
}

// ─── Ingestion Jobs ───────────────────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type JobItemStatus =
  | "pending"
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export interface IngestionJob {
  id: string;
  workspaceId: string;
  requestedBy: string;
  status: JobStatus;
  totalVideos: number;
  processedVideos: number;
  failedVideos: number;
  progressPct: number;
  currentStage: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface IngestionJobItem {
  id: string;
  jobId: string;
  videoId: string | null;
  status: JobItemStatus;
  currentStage: string | null;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

// ─── Transcripts ──────────────────────────────────────────────────────────────

export interface Transcript {
  id: string;
  videoId: string;
  language: string;
  transcriptText: string | null;
  segmentsJson: Array<{ start: number; end: number; text: string }> | null;
  source: string | null;
  confidence: number | null;
  createdAt: string;
}

// ─── Video Analyses ───────────────────────────────────────────────────────────

export interface VideoAnalysis {
  id: string;
  videoId: string;
  analysisVersion: string;
  hookSummary: string | null;
  contentTheme: string | null;
  targetAudience: string | null;
  narrativeStructure: string | null;
  callToAction: string | null;
  pacingObservations: string | null;
  contentStrengths: string[];
  contentWeaknesses: string[];
  evidenceJson: Record<string, unknown> | null;
  modelName: string | null;
  createdAt: string;
}

// ─── Video Metric Snapshots ───────────────────────────────────────────────────

export interface VideoMetricSnapshot {
  id: string;
  videoId: string;
  capturedAt: string;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  source: string | null;
}

// ─── Comparisons ──────────────────────────────────────────────────────────────

export interface Comparison {
  id: string;
  workspaceId: string;
  title: string;
  selectedVideoIds: string[];
  comparisonData: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  aiSummary?: string | null;
  status?: "pending" | "ready" | "error";
  videoIds?: string[];
  userId?: string;
}

// ─── Research Chat ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  citationsJson: ChatSource[] | null;
  createdAt: string;
  sources?: ChatSource[];
}

export interface ChatSource {
  videoId: string;
  videoTitle: string | null;
  excerpt: string;
  relevance: number;
}

export interface ChatSession {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  workspaceId: string;
  createdBy: string;
  reportType: "pdf" | "markdown" | "json" | "summary";
  status: "pending" | "generating" | "ready" | "error";
  storagePath: string | null;
  createdAt: string;
  completedAt: string | null;
  userId?: string;
  title?: string;
  format?: "pdf" | "markdown" | "json";
  updatedAt?: string;
}

// ─── Integration Status ──────────────────────────────────────────────────────

export interface IntegrationConfig {
  name: string;
  key: string;
  description: string;
  required: boolean;
  configured: boolean;
  docsUrl: string;
}
