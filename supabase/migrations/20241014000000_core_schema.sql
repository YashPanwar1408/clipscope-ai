-- ==============================================================================
-- CONTENT STUDIO — Shorts vs Reels Intelligence
-- Core Database Schema & Row Level Security
-- Migration: 20241014000000_core_schema.sql
-- ==============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── 1. Profiles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Workspaces ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Workspace Members ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- ─── 4. Videos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.videos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('youtube_shorts', 'instagram_reels')),
  canonical_url     TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  title             TEXT,
  description       TEXT,
  creator_name      TEXT,
  thumbnail_url     TEXT,
  duration_seconds  INTEGER,
  published_at      TIMESTAMPTZ,
  views             BIGINT,
  likes             BIGINT,
  comments_count    BIGINT,
  metadata_status   TEXT NOT NULL DEFAULT 'pending' CHECK (metadata_status IN ('pending', 'fetching', 'ready', 'error', 'partial')),
  transcript_status TEXT NOT NULL DEFAULT 'pending' CHECK (transcript_status IN ('pending', 'fetching', 'ready', 'unavailable', 'error')),
  analysis_status   TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'ready', 'error', 'none')),
  metadata_json     JSONB DEFAULT '{}'::jsonb,
  search_vector     TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(creator_name, ''))
  ) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_platform_video UNIQUE (workspace_id, platform, platform_video_id)
);

-- ─── 5. Ingestion Jobs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_videos       INTEGER NOT NULL DEFAULT 0,
  processed_videos   INTEGER NOT NULL DEFAULT 0,
  failed_videos      INTEGER NOT NULL DEFAULT 0,
  progress_pct       INTEGER NOT NULL DEFAULT 0,
  current_stage      TEXT,
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  last_error_code    TEXT,
  last_error_message TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 6. Ingestion Job Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingestion_job_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  video_id      UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_stage TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_code    TEXT,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 7. Transcripts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transcripts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id        UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  language        TEXT NOT NULL DEFAULT 'en',
  transcript_text TEXT,
  segments_json   JSONB DEFAULT '[]'::jsonb,
  source          TEXT,
  confidence      NUMERIC,
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(transcript_text, ''))
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 8. Video Analyses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.video_analyses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id            UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  analysis_version    TEXT NOT NULL DEFAULT 'v1',
  hook_summary        TEXT,
  content_theme       TEXT,
  target_audience     TEXT,
  narrative_structure TEXT,
  call_to_action      TEXT,
  pacing_observations TEXT,
  content_strengths   TEXT[] DEFAULT '{}',
  content_weaknesses  TEXT[] DEFAULT '{}',
  evidence_json       JSONB DEFAULT '{}'::jsonb,
  model_name          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 9. Video Metric Snapshots ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.video_metric_snapshots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id       UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  views          BIGINT,
  likes          BIGINT,
  comments_count BIGINT,
  source         TEXT
);

-- ─── 10. Comparisons ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comparisons (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  selected_video_ids UUID[] NOT NULL DEFAULT '{}',
  comparison_data    JSONB DEFAULT '{}'::jsonb,
  created_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 11. Chat Sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'New session',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 12. Chat Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role           TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content        TEXT NOT NULL,
  citations_json JSONB DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 13. Reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type  TEXT NOT NULL CHECK (report_type IN ('pdf', 'markdown', 'json')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'error')),
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_workspace ON public.videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_platform_id ON public.videos(platform, platform_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_search ON public.videos USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_ws ON public.ingestion_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_ingestion_items_job ON public.ingestion_job_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_transcripts_video ON public.transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_search ON public.transcripts USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_video_analyses_video ON public.video_analyses(video_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_video ON public.video_metric_snapshots(video_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparisons_workspace ON public.comparisons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_ws ON public.chat_sessions(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reports_workspace ON public.reports(workspace_id);

-- ─── Helper Functions for Authorization ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID, uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = uid
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = ws_id AND owner_id = uid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_write_workspace(ws_id UUID, uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = uid AND role IN ('owner', 'admin', 'editor')
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = ws_id AND owner_id = uid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile or fellow members"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid() OR
    id IN (
      SELECT wm.user_id FROM public.workspace_members wm
      WHERE wm.workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspaces they belong to"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can insert workspaces they own"
  ON public.workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Owners can delete their workspaces"
  ON public.workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- Workspace Members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view other members of their workspace"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins and owners can manage members"
  ON public.workspace_members FOR ALL
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()) OR
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Videos
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view videos in their workspace"
  ON public.videos FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Editors, admins, and owners can modify videos"
  ON public.videos FOR ALL
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));

-- Ingestion Jobs & Items
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ingestion jobs"
  ON public.ingestion_jobs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Editors and admins can create jobs"
  ON public.ingestion_jobs FOR ALL
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));

CREATE POLICY "Members can view ingestion job items"
  ON public.ingestion_job_items FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.ingestion_jobs WHERE public.is_workspace_member(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Authorized members can update job items"
  ON public.ingestion_job_items FOR ALL
  USING (
    job_id IN (
      SELECT id FROM public.ingestion_jobs WHERE public.can_write_workspace(workspace_id, auth.uid())
    )
  );

-- Transcripts, Video Analyses, Snapshots
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view transcripts"
  ON public.transcripts FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM public.videos WHERE public.is_workspace_member(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Authorized members can modify transcripts"
  ON public.transcripts FOR ALL
  USING (
    video_id IN (
      SELECT id FROM public.videos WHERE public.can_write_workspace(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Members can view video analyses"
  ON public.video_analyses FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM public.videos WHERE public.is_workspace_member(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Authorized members can modify video analyses"
  ON public.video_analyses FOR ALL
  USING (
    video_id IN (
      SELECT id FROM public.videos WHERE public.can_write_workspace(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Members can view metric snapshots"
  ON public.video_metric_snapshots FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM public.videos WHERE public.is_workspace_member(workspace_id, auth.uid())
    )
  );

CREATE POLICY "Authorized members can modify metric snapshots"
  ON public.video_metric_snapshots FOR ALL
  USING (
    video_id IN (
      SELECT id FROM public.videos WHERE public.can_write_workspace(workspace_id, auth.uid())
    )
  );

-- Comparisons
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view comparisons in their workspace"
  ON public.comparisons FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Authorized members can modify comparisons"
  ON public.comparisons FOR ALL
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));

-- Chat Sessions & Messages
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat sessions"
  ON public.chat_sessions FOR ALL
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage messages in their chat sessions"
  ON public.chat_messages FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reports in their workspace"
  ON public.reports FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Authorized members can modify reports"
  ON public.reports FOR ALL
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));

-- ─── Triggers & Handlers ──────────────────────────────────────────────────────

-- 1. updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supabase preview databases may already contain these triggers when the
-- migration history is being reconciled. Replace them safely on re-apply.
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
DROP TRIGGER IF EXISTS trg_ingestion_jobs_updated_at ON public.ingestion_jobs;
DROP TRIGGER IF EXISTS trg_ingestion_job_items_updated_at ON public.ingestion_job_items;
DROP TRIGGER IF EXISTS trg_comparisons_updated_at ON public.comparisons;
DROP TRIGGER IF EXISTS trg_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_jobs_updated_at BEFORE UPDATE ON public.ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_job_items_updated_at BEFORE UPDATE ON public.ingestion_job_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comparisons_updated_at BEFORE UPDATE ON public.comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Automatically link workspace creator as owner in workspace_members
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_workspace_created ON public.workspaces;
CREATE TRIGGER trg_on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- 3. Automatically create profile and default workspace on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Insert user profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name;

  -- Create initial workspace
  INSERT INTO public.workspaces (owner_id, name, description)
  VALUES (
    NEW.id,
    'My Workspace',
    'Default research workspace for short-form video intelligence'
  )
  RETURNING id INTO v_workspace_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggered by Supabase auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
