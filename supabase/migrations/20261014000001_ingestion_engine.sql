-- =============================================================================
-- Ingestion engine: expanded job states, idempotency keys, durable outbox
-- =============================================================================

-- 1. Expand ingestion job status enum (drop old check, add new one)
ALTER TABLE ingestion_jobs DROP CONSTRAINT IF EXISTS ingestion_jobs_status_check;
ALTER TABLE ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_status_check
  CHECK (status IN (
    'pending', 'queued', 'running', 'retrying',
    'completed', 'partial', 'failed', 'cancelled'
  ));

ALTER TABLE ingestion_job_items DROP CONSTRAINT IF EXISTS ingestion_job_items_status_check;
ALTER TABLE ingestion_job_items
  ADD CONSTRAINT ingestion_job_items_status_check
  CHECK (status IN (
    'pending', 'queued', 'running', 'retrying',
    'completed', 'failed', 'cancelled', 'skipped'
  ));

-- 2. Idempotency key on jobs (client-generated, prevents duplicate submissions)
ALTER TABLE ingestion_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingestion_jobs_idempotency_key
  ON ingestion_jobs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Durable outbox for reliable workflow event dispatch
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created
  ON outbox_events (status, created_at);

DROP TRIGGER IF EXISTS trg_outbox_events_updated_at ON public.outbox_events;
CREATE TRIGGER trg_outbox_events_updated_at
  BEFORE UPDATE ON public.outbox_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Helper to mark a job terminal safely (used by workflows)
CREATE OR REPLACE FUNCTION compute_job_progress(job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  total INTEGER;
  done INTEGER;
  failed INTEGER;
  pct INTEGER;
  final_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO total, done, failed
  FROM ingestion_job_items
  WHERE job_id = $1;

  IF total = 0 THEN
    pct := 100;
    final_status := 'completed';
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

  UPDATE ingestion_jobs
  SET
    processed_videos = done,
    failed_videos = failed,
    progress_pct = pct,
    status = COALESCE(final_status, status),
    completed_at = CASE WHEN final_status IS NOT NULL THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = $1;
END;
$$;
