-- =============================================================================
-- Supabase Storage Setup for ClipScope AI
-- Run this in the Supabase SQL Editor to set up the reports bucket
-- =============================================================================

-- Create the private reports bucket (or make an existing bucket private).
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Bucket name: reports
-- Public access: false (private bucket)

-- ─── Storage Policies ────────────────────────────────────────────────────────

-- Policy: Allow authenticated users to upload to their workspace's report folder
DROP POLICY IF EXISTS "reports_upload_auth" ON storage.objects;
DROP POLICY IF EXISTS "reports_download_member" ON storage.objects;
DROP POLICY IF EXISTS "reports_delete_member" ON storage.objects;

CREATE POLICY "reports_upload_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::text = (storage.foldername(name))[1]
      AND public.can_write_workspace(workspace.id)
  )
);

-- Policy: Allow workspace members to download their workspace's reports
CREATE POLICY "reports_download_member"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::text = (storage.foldername(name))[1]
      AND public.is_workspace_member(workspace.id)
  )
);

-- Policy: Allow workspace members to delete their workspace's reports
CREATE POLICY "reports_delete_member"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::text = (storage.foldername(name))[1]
      AND public.can_write_workspace(workspace.id)
  )
);

-- ─── Manual Setup Instructions ────────────────────────────────────────────────

-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named "reports"
-- 3. Set "Public bucket" to OFF (this is a private bucket)
-- 4. Run the SQL above to create the RLS policies
-- 5. Verify the policies are applied in the Storage > Policies section
