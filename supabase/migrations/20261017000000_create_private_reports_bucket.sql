-- Report generation uploads PDF, CSV, and Markdown objects to this bucket.
-- Keep it private; workspace-scoped object policies are defined by the
-- worker_and_storage_security migration.
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;
