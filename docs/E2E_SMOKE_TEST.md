# End-to-End Smoke Test Procedure

This document describes the manual smoke test procedure to verify the complete ClipScope AI workflow with live infrastructure.

## Prerequisites

- Supabase project configured and running
- Inngest application configured
- Groq API key configured as `GROQ_API_KEY`
- YouTube Data API key configured (optional, for metadata)
- Local development environment or deployed application

## Test Procedure

### 1. Authentication Test

```bash
# Navigate to the application
# Expected: Landing page loads

# Click "Sign up"
# Expected: Registration page loads

# Fill in name, email, password, and confirm password
# Submit the form
# Expected: Redirect to dashboard or email confirmation page
# Verify: User record created in Supabase auth.users
# Verify: Profile record created in public.profiles
# Verify: Default workspace created in public.workspaces
# Verify: Workspace membership created in public.workspace_members

# Sign out
# Expected: Redirect to landing page

# Sign in with the same credentials
# Expected: Redirect to dashboard
# Verify: Session is persistent (refresh page maintains login)
```

### 2. Workspace Test

```bash
# Navigate to Workspaces page
# Expected: List of workspaces (at least the default workspace)

# Create a new workspace
# Expected: Workspace creation dialog appears
# Enter name and description
# Submit
# Expected: New workspace appears in list
# Verify: Workspace record created in public.workspaces
# Verify: Owner is set to authenticated user

# Switch to the new workspace
# Expected: Active workspace cookie updated
# Verify: cs_active_workspace_id cookie set

# Delete the workspace
# Expected: Confirmation dialog appears
# Confirm deletion
# Expected: Workspace removed from list
# Verify: Workspace record deleted from public.workspaces
# Verify: Cascade deletion of related records (videos, jobs, etc.)
```

### 3. Video Import Test

```bash
# Navigate to Library page
# Expected: Video library with import form

# Import a YouTube Short
# Use URL: https://www.youtube.com/shorts/dQw4w9WgXcQ
# Submit
# Expected: Job created and redirect to job detail page
# Verify: Video record created in public.videos
# Verify: Ingestion job created in public.ingestion_jobs
# Verify: Job items created in public.ingestion_job_items
# Verify: Outbox event created in public.outbox_events

# Monitor job progress
# Expected: Progress bar updates
# Expected: Status changes from queued → running → completed
# Verify: job.status updates in database
# Verify: job_items.status updates for each item
# Verify: metadata_status becomes "ready" or "partial"
# Verify: transcript_status becomes "ready", "unavailable", or "error"

# After job completes, navigate to video detail
# Expected: Video details page with metadata
# Verify: title, description, creator name populated
# Verify: views, likes, comments populated (if available)
# Verify: metrics remain null if unavailable (never fabricated to 0)
```

### 4. Inngest Workflow Test

```bash
# Run Inngest local dev server (in development)
npm run inngest

# Or verify Inngest cloud integration (in production)
# Navigate to Inngest dashboard
# Expected: Functions registered: ingest-job, ai-analysis, generate-comparison, generate-report, reconcile-jobs

# Create a new video import job
# Expected: Event "job/ingest.requested" sent to Inngest
# Verify: Inngest dashboard shows event received
# Verify: Workflow execution starts
# Verify: Durable steps execute in order
# Verify: Workflow completes successfully

# Check reconciliation cron
# Expected: Reconciliation runs every 5 minutes
# Verify: Pending outbox events dispatched
# Verify: Stale jobs re-queued
```

### 5. AI Analysis Test

```bash
# Navigate to a video with a transcript
# Expected: Video detail page shows transcript

# Click "Regenerate Analysis" (if available)
# Expected: Analysis status changes to "processing"
# Verify: Event "video/analysis.requested" sent to Inngest
# Verify: AI analysis workflow executes
# Verify: video_analyses record created in database
# Verify: analysis_status becomes "ready" or "error"

# View analysis results
# Expected: Hook summary, content theme, narrative structure displayed
# Verify: Evidence excerpts from transcript
# Verify: Strengths and weaknesses listed
# Verify: No fabricated information when evidence insufficient
```

### 6. Comparison Test

```bash
# Navigate to Compare page
# Expected: Comparison creation form

# Select 2-5 videos from the workspace
# Enter comparison title
# Submit
# Expected: Comparison created and redirect to detail page
# Verify: comparisons record created in database
# Verify: Event "comparison/generate.requested" sent to Inngest
# Verify: AI comparison workflow executes
# Verify: comparison_data populated with analysis

# View comparison results
# Expected: Side-by-side video details
# Expected: Hook comparison, theme comparison, structure comparison
# Expected: Strengths and weaknesses per video
# Expected: Recommendations
```

### 7. Research Chat Test

```bash
# Navigate to Chat page
# Expected: Research chat interface

# Create a new chat session
# Expected: New session created
# Verify: chat_sessions record created in database

# Ask a question about your videos
# Example: "Which videos have the strongest hooks?"
# Expected: AI response with citations
# Verify: transcript evidence is retrieved through the current term-based search implementation
# Verify: Evidence retrieved from transcripts
# Verify: Citations reference real video IDs
# Verify: chat_messages record created with citations_json

# Ask follow-up question
# Expected: Context maintained
# Verify: Previous messages shown in history
```

### 8. Report Generation Test

```bash
# Navigate to Reports page
# Expected: Reports list

# Generate a new report
# Select report type (PDF, Markdown, CSV)
# Submit
# Expected: Report created with status "pending"
# Verify: reports record created in database
# Verify: Event "report/generate.requested" sent to Inngest
# Verify: Report generation workflow executes
# Verify: Files uploaded to Supabase Storage (reports bucket)
# Verify: storage_path populated
# Verify: status becomes "ready"

# Download the report
# Click download button
# Expected: File download initiated
# Verify: Authorization check passes
# Verify: File content is valid (opens correctly)
# Verify: Download headers set correctly
```

### 9. Analytics Test

```bash
# Navigate to Analytics page
# Expected: Analytics dashboard

# Verify data is real (not fake)
# Expected: Total videos count matches database
# Expected: Platform distribution chart matches actual videos
# Expected: Job outcomes chart matches actual job records
# Expected: Metrics by platform uses real retrieved metrics
# Expected: Empty state when no data exists

# Import more videos to populate analytics
# Expected: Charts update with real data
# Verify: No fabricated statistics
```

### 10. Data Honesty Verification

```bash
# Import a video without public metrics
# Expected: Video imported successfully
# Verify: views, likes, comments_count are NULL in database
# Verify: UI displays "—" not "0"

# Import a video without transcript
# Expected: Video imported successfully
# Verify: transcript_status is "unavailable"
# Verify: Clear message about unavailable transcript
# Verify: No fabricated transcript created

# Try analysis without sufficient evidence
# Expected: Analysis returns insufficient evidence message
# Verify: hasSufficientEvidence is false
# Verify: No fabricated insights generated
```

## Expected Database State After Smoke Test

```sql
-- Verify records exist
SELECT COUNT(*) FROM profiles;                    -- Should be >= 1
SELECT COUNT(*) FROM workspaces;                  -- Should be >= 1
SELECT COUNT(*) FROM workspace_members;           -- Should be >= 1
SELECT COUNT(*) FROM videos;                     -- Should be >= 1
SELECT COUNT(*) FROM ingestion_jobs;              -- Should be >= 1
SELECT COUNT(*) FROM ingestion_job_items;         -- Should be >= 1
SELECT COUNT(*) FROM transcripts;                 -- Should be >= 0
SELECT COUNT(*) FROM video_analyses;              -- Should be >= 0
SELECT COUNT(*) FROM comparisons;                 -- Should be >= 0
SELECT COUNT(*) FROM chat_sessions;              -- Should be >= 0
SELECT COUNT(*) FROM chat_messages;               -- Should be >= 0
SELECT COUNT(*) FROM reports;                     -- Should be >= 0

-- Verify terminal job status
SELECT status, COUNT(*) FROM ingestion_jobs GROUP BY status;
-- Should have at least one job with status 'completed', 'partial', or 'failed'

-- Verify metadata retrieved
SELECT metadata_status, COUNT(*) FROM videos GROUP BY metadata_status;
-- Should have at least one video with metadata_status 'ready' or 'partial'

-- Verify no fabricated metrics
SELECT COUNT(*) FROM videos WHERE views = 0 OR likes = 0 OR comments_count = 0;
-- Should be 0 (null values used for unavailable metrics)
```

## Known Limitations

- Instagram Reels transcripts are not available via public API
- YouTube transcript extraction requires manual entry or paid API
- Some metrics may be unavailable depending on video privacy settings
- AI analysis requires transcript evidence; insufficient evidence produces explicit errors

## Success Criteria

All tests pass if:
1. Authentication flow works end-to-end
2. Workspace CRUD operations persist correctly
3. Video import creates jobs and processes successfully
4. Inngest workflows execute and update database state
5. AI analysis produces grounded results
6. Comparisons generate correctly
7. Research chat returns evidence-based answers
8. Reports generate and download correctly
9. Analytics shows real database data
10. No data is fabricated when unavailable
