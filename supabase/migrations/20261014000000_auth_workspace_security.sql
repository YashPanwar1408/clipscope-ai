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
        'chat_sessions', 'chat_messages', 'reports'
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
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_jobs_updated_at BEFORE UPDATE ON public.ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ingestion_job_items_updated_at BEFORE UPDATE ON public.ingestion_job_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comparisons_updated_at BEFORE UPDATE ON public.comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
