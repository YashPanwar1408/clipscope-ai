// ==============================================================================
// CONTENT STUDIO — Shorts vs Reels Intelligence
// Database Types (matches Supabase schema)
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type JobStatus =
  | "pending"
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"

export type JobItemStatus =
  | "pending"
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: "owner" | "admin" | "editor" | "viewer"
          created_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: "owner" | "admin" | "editor" | "viewer"
          created_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: "owner" | "admin" | "editor" | "viewer"
          created_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          workspace_id: string
          platform: "youtube_shorts" | "instagram_reels"
          canonical_url: string
          platform_video_id: string
          title: string | null
          description: string | null
          creator_name: string | null
          thumbnail_url: string | null
          duration_seconds: number | null
          published_at: string | null
          views: number | null
          likes: number | null
          comments_count: number | null
          metadata_status: "pending" | "fetching" | "ready" | "error" | "partial"
          transcript_status: "pending" | "fetching" | "ready" | "unavailable" | "error"
          analysis_status: "pending" | "processing" | "ready" | "error" | "none"
          metadata_json: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          platform: "youtube_shorts" | "instagram_reels"
          canonical_url: string
          platform_video_id: string
          title?: string | null
          description?: string | null
          creator_name?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number | null
          published_at?: string | null
          views?: number | null
          likes?: number | null
          comments_count?: number | null
          metadata_status?: "pending" | "fetching" | "ready" | "error" | "partial"
          transcript_status?: "pending" | "fetching" | "ready" | "unavailable" | "error"
          analysis_status?: "pending" | "processing" | "ready" | "error" | "none"
          metadata_json?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          platform?: "youtube_shorts" | "instagram_reels"
          canonical_url?: string
          platform_video_id?: string
          title?: string | null
          description?: string | null
          creator_name?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number | null
          published_at?: string | null
          views?: number | null
          likes?: number | null
          comments_count?: number | null
          metadata_status?: "pending" | "fetching" | "ready" | "error" | "partial"
          transcript_status?: "pending" | "fetching" | "ready" | "unavailable" | "error"
          analysis_status?: "pending" | "processing" | "ready" | "error" | "none"
          metadata_json?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      ingestion_jobs: {
        Row: {
          id: string
          workspace_id: string
          requested_by: string
          status: JobStatus
          total_videos: number
          processed_videos: number
          failed_videos: number
          progress_pct: number
          current_stage: string | null
          attempt_count: number
          last_error_code: string | null
          last_error_message: string | null
          idempotency_key: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          requested_by: string
          status?: JobStatus
          total_videos?: number
          processed_videos?: number
          failed_videos?: number
          progress_pct?: number
          current_stage?: string | null
          attempt_count?: number
          last_error_code?: string | null
          last_error_message?: string | null
          idempotency_key?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          requested_by?: string
          status?: JobStatus
          total_videos?: number
          processed_videos?: number
          failed_videos?: number
          progress_pct?: number
          current_stage?: string | null
          attempt_count?: number
          last_error_code?: string | null
          last_error_message?: string | null
          idempotency_key?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
      }
      ingestion_job_items: {
        Row: {
          id: string
          job_id: string
          video_id: string | null
          status: JobItemStatus
          current_stage: string | null
          attempt_count: number
          error_code: string | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          video_id?: string | null
          status?: JobItemStatus
          current_stage?: string | null
          attempt_count?: number
          error_code?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          video_id?: string | null
          status?: JobItemStatus
          current_stage?: string | null
          attempt_count?: number
          error_code?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
      }
      transcripts: {
        Row: {
          id: string
          video_id: string
          language: string
          transcript_text: string | null
          segments_json: Json | null
          source: string | null
          confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          language?: string
          transcript_text?: string | null
          segments_json?: Json | null
          source?: string | null
          confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          language?: string
          transcript_text?: string | null
          segments_json?: Json | null
          source?: string | null
          confidence?: number | null
          created_at?: string
        }
      }
      video_analyses: {
        Row: {
          id: string
          video_id: string
          analysis_version: string
          hook_summary: string | null
          content_theme: string | null
          target_audience: string | null
          narrative_structure: string | null
          call_to_action: string | null
          pacing_observations: string | null
          content_strengths: string[] | null
          content_weaknesses: string[] | null
          evidence_json: Json | null
          model_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          analysis_version?: string
          hook_summary?: string | null
          content_theme?: string | null
          target_audience?: string | null
          narrative_structure?: string | null
          call_to_action?: string | null
          pacing_observations?: string | null
          content_strengths?: string[] | null
          content_weaknesses?: string[] | null
          evidence_json?: Json | null
          model_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          analysis_version?: string
          hook_summary?: string | null
          content_theme?: string | null
          target_audience?: string | null
          narrative_structure?: string | null
          call_to_action?: string | null
          pacing_observations?: string | null
          content_strengths?: string[] | null
          content_weaknesses?: string[] | null
          evidence_json?: Json | null
          model_name?: string | null
          created_at?: string
        }
      }
      video_metric_snapshots: {
        Row: {
          id: string
          video_id: string
          captured_at: string
          views: number | null
          likes: number | null
          comments_count: number | null
          source: string | null
        }
        Insert: {
          id?: string
          video_id: string
          captured_at?: string
          views?: number | null
          likes?: number | null
          comments_count?: number | null
          source?: string | null
        }
        Update: {
          id?: string
          video_id?: string
          captured_at?: string
          views?: number | null
          likes?: number | null
          comments_count?: number | null
          source?: string | null
        }
      }
      comparisons: {
        Row: {
          id: string
          workspace_id: string
          title: string
          selected_video_ids: string[]
          comparison_data: Json | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          selected_video_ids?: string[]
          comparison_data?: Json | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          selected_video_ids?: string[]
          comparison_data?: Json | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: "user" | "assistant"
          content: string
          citations_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: "user" | "assistant"
          content: string
          citations_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: "user" | "assistant"
          content?: string
          citations_json?: Json | null
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          workspace_id: string
          created_by: string
          report_type: "pdf" | "markdown" | "json" | "summary"
          status: "pending" | "generating" | "ready" | "error"
          storage_path: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          created_by: string
          report_type: "pdf" | "markdown" | "json" | "summary"
          status?: "pending" | "generating" | "ready" | "error"
          storage_path?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          created_by?: string
          report_type?: "pdf" | "markdown" | "json" | "summary"
          status?: "pending" | "generating" | "ready" | "error"
          storage_path?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      outbox_events: {
        Row: {
          id: string
          workspace_id: string
          event_name: string
          event_key: string | null
          payload: Json
          status: "pending" | "sent" | "dead"
          attempts: number
          last_error: string | null
          created_at: string
          sent_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          event_name: string
          event_key?: string | null
          payload?: Json
          status?: "pending" | "sent" | "dead"
          attempts?: number
          last_error?: string | null
          created_at?: string
          sent_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          event_name?: string
          event_key?: string | null
          payload?: Json
          status?: "pending" | "sent" | "dead"
          attempts?: number
          last_error?: string | null
          created_at?: string
          sent_at?: string | null
          updated_at?: string
        }
      }
    }
    Functions: {
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      can_write_workspace: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      can_manage_workspace: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      manage_workspace_member: {
        Args: { target_workspace_id: string; target_user_id: string; target_role: string | null }
        Returns: undefined
      }
      compute_job_progress: {
        Args: { job_id: string }
        Returns: undefined
      }
    }
  }
}
