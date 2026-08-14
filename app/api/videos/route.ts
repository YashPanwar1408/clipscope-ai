import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  batchImportSchema,
  videoImportSchema,
  workspaceIdSchema,
} from "@/lib/schemas";
import {
  createIngestionJob,
  dispatchOutboxEvent,
} from "@/lib/ingestion/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/api/rate-limit";

// Union-typed body: either a single URL or a batch of URLs.
const importBodySchema = videoImportSchema.or(batchImportSchema);

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, importBodySchema);
  if (parsed.response) return parsed.response;

  try {
    const user = await requireUser();

    // Rate limiting: 30 requests per minute per user
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
    const identifier = getRateLimitIdentifier(user.id, ip);
    const rateLimit = checkRateLimit(identifier, 30);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
          },
        }
      );
    }

    const data = parsed.data;
    const workspaceId = data.workspaceId;
    await requireWorkspaceAccess(workspaceId, "editor");

    const urls = "urls" in data ? data.urls : [data.url];
    const idempotencyKey = data.idempotencyKey;

    const result = await createIngestionJob(
      workspaceId,
      user.id,
      urls,
      idempotencyKey
    );

    // Best-effort dispatch of the outbox event immediately.
    // If it fails, the reconciliation cron will pick it up.
    if (result.created && result.outboxId) {
      await dispatchOutboxEvent(result.outboxId);
    }

    return NextResponse.json(
      {
        jobId: result.jobId,
        videoIds: result.videoIds,
        skippedUrls: result.skippedUrls,
        created: result.created,
      },
      {
        status: result.created ? 201 : 200,
        headers: {
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import video";
    if (message.includes("already exist")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to import video");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    const parsedId = workspaceIdSchema.safeParse(workspaceId);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "A valid workspaceId is required" },
        { status: 400 }
      );
    }

    await requireWorkspaceAccess(parsedId.data, "viewer");
    const supabase = await createClient();
    const { data: videos, error } = await supabase
      .from("videos")
      .select("*")
      .eq("workspace_id", parsedId.data)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to fetch videos");
    return NextResponse.json({ videos: videos ?? [] });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch videos");
  }
}
