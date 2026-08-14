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
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'running', 'retrying', 'completed', 'partial', 'failed', 'cancelled')),
  total_videos       INTEGER NOT NULL DEFAULT 0,
  processed_videos   INTEGER NOT NULL DEFAULT 0,
  failed_videos      INTEGER NOT NULL DEFAULT 0,
  progress_pct       INTEGER NOT NULL DEFAULT 0,
  current_stage      TEXT,
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  last_error_code    TEXT,
  last_error_message TEXT,
  idempotency_key    TEXT UNIQUE,
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
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'running', 'retrying', 'completed', 'failed', 'cancelled', 'skipped')),
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
  report_type  TEXT NOT NULL CHECK (report_type IN ('summary', 'pdf', 'markdown', 'json')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'error')),
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── 14. Outbox Events (for reliable workflow dispatch) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_name    TEXT NOT NULL,
  event_key     TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dead')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_workspace ON public.videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_platform_id ON public.videos(platform, platform_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_search ON public.videos USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_ws ON public.ingestion_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_idempotency ON public.ingestion_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingestion_items_job ON public.ingestion_job_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_transcripts_video ON public.transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_search ON public.transcripts USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_video_analyses_video ON public.video_analyses(video_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_video ON public.video_metric_snapshots(video_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparisons_workspace ON public.comparisons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_ws ON public.chat_sessions(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reports_workspace ON public.reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created ON public.outbox_events(status, created_at);

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

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
DROP TRIGGER IF EXISTS trg_ingestion_jobs_updated_at ON public.ingestion_jobs;
DROP TRIGGER IF EXISTS trg_ingestion_job_items_updated_at ON public.ingestion_job_items;
DROP TRIGGER IF EXISTS trg_comparisons_updated_at ON public.comparisons;
DROP TRIGGER IF EXISTS trg_chat_sessions_updated_at ON public.chat_sessions;
DROP TRIGGER IF EXISTS trg_outbox_events_updated_at ON public.outbox_events;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_jobs_updated_at BEFORE UPDATE ON public.ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_job_items_updated_at BEFORE UPDATE ON public.ingestion_job_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comparisons_updated_at BEFORE UPDATE ON public.comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_outbox_events_updated_at BEFORE UPDATE ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

-- ─── Helper Functions ─────────────────────────────────────────────────────────

-- Helper to compute job progress from items
CREATE OR REPLACE FUNCTION public.compute_job_progress(job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  total INTEGER;
  expected_total INTEGER;
  done INTEGER;
  failed INTEGER;
  pct INTEGER;
  final_status TEXT;
BEGIN
  SELECT total_videos
  INTO expected_total
  FROM public.ingestion_jobs AS jobs
  WHERE jobs.id = $1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO total, done, failed
  FROM public.ingestion_job_items AS items
  WHERE items.job_id = $1;

  IF total = 0 THEN
    IF expected_total = 0 THEN
      pct := 100;
      final_status := 'completed';
    ELSE
      pct := 0;
      final_status := 'failed';
    END IF;
  ELSE
    pct := ROUND(((done + failed)::numeric / total) * 100);
    IF done + failed = total THEN
      IF failed = 0 THEN
        final_status := 'completed';
      ELSIF done = 0 THEN
        final_status := 'failed';
      ELSE
        final_status := 'partial';
      END IF;
    END IF;
  END IF;

  UPDATE public.ingestion_jobs AS jobs
  SET
    processed_videos = done,
    failed_videos = failed,
    progress_pct = pct,
    status = COALESCE(final_status, status),
    last_error_code = CASE
      WHEN total = 0 AND expected_total > 0 THEN 'NO_JOB_ITEMS'
      WHEN final_status IS NOT NULL THEN NULL
      ELSE last_error_code
    END,
    last_error_message = CASE
      WHEN total = 0 AND expected_total > 0 THEN
        'No video item records were found. Start a new job with the video URLs.'
      WHEN final_status IS NOT NULL THEN NULL
      ELSE last_error_message
    END,
    completed_at = CASE WHEN final_status IS NOT NULL THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE jobs.id = $1;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_job_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_job_progress(UUID) TO service_role;

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

-- Harden the initial ClipScope AI schema for authenticated, multi-tenant use.
-- All data access continues to use the caller's Supabase JWT and RLS.

-- Remove permissive policies from the initial migration before replacing them.
DO $migration$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'workspaces', 'workspace_members', 'videos',
        'ingestion_jobs', 'ingestion_job_items', 'transcripts',
        'video_analyses', 'video_metric_snapshots', 'comparisons',
        'chat_sessions', 'chat_messages', 'reports', 'outbox_events'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END
$migration$;

DROP FUNCTION IF EXISTS public.is_workspace_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.can_write_workspace(UUID, UUID);

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = target_workspace_id
      AND workspace.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.workspace_members AS member
    WHERE member.workspace_id = target_workspace_id
      AND member.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = target_workspace_id
      AND workspace.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.workspace_members AS member
    WHERE member.workspace_id = target_workspace_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin', 'editor')
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = target_workspace_id
      AND workspace.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.workspace_members AS member
    WHERE member.workspace_id = target_workspace_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin')
  );
$function$;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_workspace(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_workspace(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(UUID) TO authenticated;

-- Membership changes go through this checked function. Direct writes to the
-- membership table are intentionally unavailable to regular authenticated users.
CREATE OR REPLACE FUNCTION public.manage_workspace_member(
  target_workspace_id UUID,
  target_user_id UUID,
  target_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  caller_id UUID := auth.uid();
  workspace_owner_id UUID;
  caller_role TEXT;
  existing_role TEXT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT workspace.owner_id
  INTO workspace_owner_id
  FROM public.workspaces AS workspace
  WHERE workspace.id = target_workspace_id;

  IF workspace_owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found' USING ERRCODE = 'P0002';
  END IF;

  IF workspace_owner_id = caller_id THEN
    caller_role := 'owner';
  ELSE
    SELECT member.role
    INTO caller_role
    FROM public.workspace_members AS member
    WHERE member.workspace_id = target_workspace_id
      AND member.user_id = caller_id;
  END IF;

  IF COALESCE(caller_role, '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  IF target_user_id = caller_id OR target_user_id = workspace_owner_id THEN
    RAISE EXCEPTION 'You cannot change the workspace owner or your own membership' USING ERRCODE = '42501';
  END IF;

  SELECT member.role
  INTO existing_role
  FROM public.workspace_members AS member
  WHERE member.workspace_id = target_workspace_id
    AND member.user_id = target_user_id;

  IF existing_role = 'owner' THEN
    RAISE EXCEPTION 'Workspace owner membership cannot be changed' USING ERRCODE = '42501';
  END IF;

  IF caller_role = 'admin' AND (target_role = 'admin' OR existing_role = 'admin') THEN
    RAISE EXCEPTION 'Only the workspace owner can assign or change admin roles' USING ERRCODE = '42501';
  END IF;

  IF target_role IS NULL THEN
    DELETE FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = target_user_id
      AND role <> 'owner';
  ELSIF target_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid workspace member role' USING ERRCODE = '22023';
  ELSE
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (target_workspace_id, target_user_id, target_role)
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_workspace_member(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_workspace_member(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_workspace_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Workspace ownership cannot be changed';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_workspace_owner_change ON public.workspaces;
CREATE TRIGGER trg_prevent_workspace_owner_change
  BEFORE UPDATE OF owner_id ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_owner_change();

CREATE OR REPLACE FUNCTION public.validate_comparison_videos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(NEW.selected_video_ids) AS selected(video_id)
    LEFT JOIN public.videos AS video ON video.id = selected.video_id
    WHERE video.id IS NULL OR video.workspace_id <> NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Comparison videos must belong to the selected workspace';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_comparison_videos ON public.comparisons;
CREATE TRIGGER trg_validate_comparison_videos
  BEFORE INSERT OR UPDATE OF workspace_id, selected_video_ids ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION public.validate_comparison_videos();

-- Pin search paths in the definer triggers used during signup and workspace creation.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url;

  INSERT INTO public.workspaces (owner_id, name, description)
  VALUES (
    NEW.id,
    'My Workspace',
    'Default research workspace for short-form video intelligence'
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_workspace() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_workspace_owner_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_comparison_videos() FROM PUBLIC, anon, authenticated;

-- Updated timestamp triggers are safe to reapply and cover all mutable rows.
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
DROP TRIGGER IF EXISTS trg_ingestion_jobs_updated_at ON public.ingestion_jobs;
DROP TRIGGER IF EXISTS trg_ingestion_job_items_updated_at ON public.ingestion_job_items;
DROP TRIGGER IF EXISTS trg_comparisons_updated_at ON public.comparisons;
DROP TRIGGER IF EXISTS trg_chat_sessions_updated_at ON public.chat_sessions;
DROP TRIGGER IF EXISTS trg_outbox_events_updated_at ON public.outbox_events;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_jobs_updated_at BEFORE UPDATE ON public.ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_job_items_updated_at BEFORE UPDATE ON public.ingestion_job_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comparisons_updated_at BEFORE UPDATE ON public.comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_outbox_events_updated_at BEFORE UPDATE ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcripts_video_language_unique
  ON public.transcripts(video_id, language);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_analyses_video_version_unique
  ON public.video_analyses(video_id, analysis_version);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role
  ON public.workspace_members(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_workspace_created
  ON public.ingestion_jobs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_workspace_created
  ON public.reports(workspace_id, created_at DESC);

-- Profiles are private to their owner.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profile_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profile_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Workspace access derives from owner_id or an explicit workspace_members row.
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_select_member" ON public.workspaces
  FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY "workspace_insert_owner" ON public.workspaces
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspace_update_manager" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(id))
  WITH CHECK (public.can_manage_workspace(id));
CREATE POLICY "workspace_delete_owner" ON public.workspaces
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_select_member" ON public.workspace_members
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
-- All membership mutations use manage_workspace_member(), which checks the caller's role.

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos_select_member" ON public.videos
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "videos_insert_writer" ON public.videos
  FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "videos_update_writer" ON public.videos
  FOR UPDATE TO authenticated
  USING (public.can_write_workspace(workspace_id))
  WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "videos_delete_writer" ON public.videos
  FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id));

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_select_member" ON public.ingestion_jobs
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "jobs_insert_writer" ON public.ingestion_jobs
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.can_write_workspace(workspace_id));
CREATE POLICY "jobs_update_writer" ON public.ingestion_jobs
  FOR UPDATE TO authenticated
  USING (public.can_write_workspace(workspace_id))
  WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "jobs_delete_writer" ON public.ingestion_jobs
  FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id));

ALTER TABLE public.ingestion_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_items_select_member" ON public.ingestion_job_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs AS job
      WHERE job.id = job_id AND public.is_workspace_member(job.workspace_id)
    )
  );
CREATE POLICY "job_items_insert_writer" ON public.ingestion_job_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs AS job
      WHERE job.id = job_id AND public.can_write_workspace(job.workspace_id)
    )
  );
CREATE POLICY "job_items_update_writer" ON public.ingestion_job_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs AS job
      WHERE job.id = job_id AND public.can_write_workspace(job.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs AS job
      WHERE job.id = job_id AND public.can_write_workspace(job.workspace_id)
    )
  );
CREATE POLICY "job_items_delete_writer" ON public.ingestion_job_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs AS job
      WHERE job.id = job_id AND public.can_write_workspace(job.workspace_id)
    )
  );

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transcripts_select_member" ON public.transcripts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.is_workspace_member(video.workspace_id)
    )
  );
CREATE POLICY "transcripts_write_writer" ON public.transcripts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.can_write_workspace(video.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.can_write_workspace(video.workspace_id)
    )
  );

ALTER TABLE public.video_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyses_select_member" ON public.video_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.is_workspace_member(video.workspace_id)
    )
  );
CREATE POLICY "analyses_write_writer" ON public.video_analyses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.can_write_workspace(video.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.can_write_workspace(video.workspace_id)
    )
  );

ALTER TABLE public.video_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots_select_member" ON public.video_metric_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.is_workspace_member(video.workspace_id)
    )
  );
CREATE POLICY "snapshots_write_writer" ON public.video_metric_snapshots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.can_write_workspace(video.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos AS video
      WHERE video.id = video_id AND public.can_write_workspace(video.workspace_id)
    )
  );

ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comparisons_select_member" ON public.comparisons
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "comparisons_insert_writer" ON public.comparisons
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_write_workspace(workspace_id));
CREATE POLICY "comparisons_update_writer" ON public.comparisons
  FOR UPDATE TO authenticated
  USING (public.can_write_workspace(workspace_id))
  WITH CHECK (public.can_write_workspace(workspace_id) AND created_by = auth.uid());
CREATE POLICY "comparisons_delete_writer" ON public.comparisons
  FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id));

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_sessions_own_member" ON public.chat_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id))
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_session_owner" ON public.chat_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = session_id
        AND session.user_id = auth.uid()
        AND public.is_workspace_member(session.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions AS session
      WHERE session.id = session_id
        AND session.user_id = auth.uid()
        AND public.is_workspace_member(session.workspace_id)
    )
  );

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_member" ON public.reports
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "reports_insert_writer" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_write_workspace(workspace_id));
CREATE POLICY "reports_update_creator" ON public.reports
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.can_write_workspace(workspace_id))
  WITH CHECK (created_by = auth.uid() AND public.can_write_workspace(workspace_id));
CREATE POLICY "reports_delete_writer" ON public.reports
  FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id));

-- Outbox Events (server-side only, but still protected)
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbox_select_member" ON public.outbox_events;
DROP POLICY IF EXISTS "outbox_insert_writer" ON public.outbox_events;
DROP POLICY IF EXISTS "outbox_update_writer" ON public.outbox_events;
DROP POLICY IF EXISTS "outbox_delete_writer" ON public.outbox_events;
DROP POLICY IF EXISTS "outbox_events_server_only" ON public.outbox_events;
REVOKE ALL ON TABLE public.outbox_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.outbox_events TO service_role;
