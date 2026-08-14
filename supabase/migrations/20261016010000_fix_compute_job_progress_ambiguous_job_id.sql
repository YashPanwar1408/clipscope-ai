-- Qualify job_id in the aggregate query because the function argument has the
-- same name as the ingestion_job_items column.
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
  SELECT jobs.total_videos
  INTO expected_total
  FROM public.ingestion_jobs AS jobs
  WHERE jobs.id = $1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE items.status = 'completed'),
    COUNT(*) FILTER (WHERE items.status = 'failed')
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
    status = COALESCE(final_status, jobs.status),
    last_error_code = CASE
      WHEN total = 0 AND expected_total > 0 THEN 'NO_JOB_ITEMS'
      WHEN final_status IS NOT NULL THEN NULL
      ELSE jobs.last_error_code
    END,
    last_error_message = CASE
      WHEN total = 0 AND expected_total > 0 THEN
        'No video item records were found. Start a new job with the video URLs.'
      WHEN final_status IS NOT NULL THEN NULL
      ELSE jobs.last_error_message
    END,
    completed_at = CASE WHEN final_status IS NOT NULL THEN now() ELSE jobs.completed_at END,
    updated_at = now()
  WHERE jobs.id = $1;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_job_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_job_progress(UUID) TO authenticated, service_role;

-- Repair running jobs whose previous progress update failed with the ambiguity.
DO $$
DECLARE
  running_job RECORD;
BEGIN
  FOR running_job IN
    SELECT id
    FROM public.ingestion_jobs
    WHERE status IN ('running', 'retrying')
  LOOP
    PERFORM public.compute_job_progress(running_job.id);
  END LOOP;
END;
$$;
