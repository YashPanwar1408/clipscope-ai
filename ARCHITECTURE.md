# Architecture Decision Record — ClipScope AI

## Executive Overview

**ClipScope AI — Short-form Intelligence** is an AI-powered SaaS research platform purpose-built for comparing short-form content across YouTube Shorts and Instagram Reels.

This document records the core architectural decisions, technology boundaries, data honesty principles, and implementation patterns governing the codebase.

---

## 1. System Topology & Fixed Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   Next.js App Router (React 19, Tailwind CSS, Lucide Icons) │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
          HTTPS / JSON                   Server Components / SSR
               │                              │
┌──────────────▼──────────────────────────────┴───────────────┐
│              Next.js 16 Application Server (Vercel)         │
│  - Route Handlers (/api/videos, /api/inngest)               │
│  - Server Components (SSR & Protected App Shell)            │
│  - Server-Only Adapters (YouTube API, RapidAPI, Groq AI)  │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
       Durable Trigger / Events        Status / Steps
               │                              │
┌──────────────▼──────────────────────────────┴───────────────┐
│               Inngest Workflow Engine (Durable)             │
│  - video/import.requested  → metadata + transcript fetch    │
│  - video/analysis.requested → Groq hook & narrative arc   │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
     SQL Queries / RLS Auth              JWT Session
               │                              │
┌──────────────▼──────────────────────────────┴───────────────┐
│                     Supabase PostgreSQL                     │
│  - Row Level Security (RLS) on all tables                   │
│  - PostgreSQL Full-Text Search (tsvector + pg_trgm)         │
│  - Supabase Storage (PDF & Markdown reports)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architecture Decisions (ADRs)

### ADR 01: Next.js App Router & Server Components
- **Decision:** Use Next.js App Router with TypeScript in strict mode.
- **Rationale:** Minimizes client-side JavaScript bundle, eliminates API round trips for initial page renders, and guarantees that sensitive API credentials (Groq, YouTube, RapidAPI) remain strictly server-side.
- **Client/Server Boundary:** Interactive UI components (e.g., forms, dropdown menus, mobile navigation) use `"use client"`. Data fetching and privileged business logic live in Server Components or server-only modules (`import "server-only"`).

### ADR 02: Inngest for Background Workflows (No Celery/Redis)
- **Decision:** Use Inngest for all asynchronous video ingestion, metadata retrieval, transcript polling, and AI synthesis.
- **Rationale:** Traditional background architectures (Celery + Redis + separate FastAPI service or long-running worker processes) introduce high operational complexity, state synchronization failures, and deployment costs. Inngest provides durable, step-based execution with automatic retries over serverless HTTP without maintaining dedicated worker VMs.

### ADR 03: Keyword Retrieval Before Vector Search
- **Current implementation:** Research chat uses `ILIKE` keyword matching and application-side term-frequency scoring. PostgreSQL `tsvector` columns and GIN indexes exist but are not used by chat retrieval yet.
- **Future direction:** PostgreSQL full-text search can replace the current query path without adding an external vector database. Validate ranking and citations against real transcripts before changing retrieval behavior.
- **Rationale:** For short-form video transcripts (typically 50–300 words), PostgreSQL FTS delivers sub-millisecond retrieval, exact keyword matching, and zero external infrastructure overhead compared to premature vector databases (e.g., Qdrant, Pinecone). Vector embeddings can be layered cleanly in future iterations without refactoring data access layers.

### ADR 04: The Data Honesty Principle
- **Decision:** Strict adherence to factual data availability:
  - If YouTube or Instagram metrics (views, likes, comments) are unavailable or private, the field **must remain `null`** and be displayed as `—`.
  - Missing metrics are **never fabricated, simulated, or mocked with fake numbers**.
  - Transcript extraction failures are explicitly flagged with `status: "unavailable"` and clear user notices.
  - Groq AI analysis prompts require strict grounding in actual transcript excerpts (`evidenceExcerpt`). If evidence is absent, the model returns explicit rationale stating the data gap.

### ADR 05: Graceful Unconfigured State Handling
- **Decision:** If third-party API credentials (`NEXT_PUBLIC_SUPABASE_URL`, `GROQ_API_KEY`, `YOUTUBE_API_KEY`, `RAPIDAPI_KEY`) are omitted or contain default placeholders, the application does not crash.
- **Rationale:** Allows local development, design review, UI walkthroughs, and automated CI pipelines to function without requiring live external production secrets. Dedicated integration status dashboards (`/integrations`) show exact configuration status with setup instructions.

---

## 3. Database Schema Overview

All tables enforce PostgreSQL Row Level Security (RLS) scoped to `auth.uid() = user_id`:

- `workspaces`: Multi-video organizational containers.
- `videos`: Imported YouTube Shorts and Instagram Reels with provider IDs, metrics, and transcript status.
- `transcripts`: Transcript text and optional segments with a full-text search vector (`tsv`).
- `comparisons`: Side-by-side comparison sessions linking multiple videos.
- `ai_insights`: AI-generated hook assessments, pacing notes, and narrative arcs with verbatim evidence citations.
- `chat_sessions` & `chat_messages`: Research assistant conversations with grounded transcript sources.
- `reports`: Generated intelligence exports in PDF, Markdown, or JSON formats stored in Supabase Storage.
