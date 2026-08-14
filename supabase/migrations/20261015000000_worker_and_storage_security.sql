-- Keep workflow-only dispatch records unavailable to end-user JWTs.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.outbox_events;
DROP TRIGGER IF EXISTS trg_outbox_events_updated_at ON public.outbox_events;
CREATE TRIGGER trg_outbox_events_updated_at
  BEFORE UPDATE ON public.outbox_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbox_events_server_only" ON public.outbox_events;
REVOKE ALL ON TABLE public.outbox_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.outbox_events TO service_role;

-- Summary reports include multiple downloadable formats, so their record type
-- describes the report rather than one particular output file.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_report_type_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_report_type_check
  CHECK (report_type IN ('summary', 'pdf', 'markdown', 'json'));

-- The bucket is named "reports", so the first object folder must be the
-- workspace ID: {workspace_id}/{report_id}.{extension}.
DROP POLICY IF EXISTS "reports_upload_auth" ON storage.objects;
DROP POLICY IF EXISTS "reports_download_member" ON storage.objects;
DROP POLICY IF EXISTS "reports_delete_member" ON storage.objects;

CREATE POLICY "reports_upload_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::text = (storage.foldername(name))[1]
      AND public.can_write_workspace(workspace.id)
  )
);

CREATE POLICY "reports_download_member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::text = (storage.foldername(name))[1]
      AND public.is_workspace_member(workspace.id)
  )
);

CREATE POLICY "reports_delete_member"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::text = (storage.foldername(name))[1]
      AND public.can_write_workspace(workspace.id)
  )
);
