import "server-only";

// ─── Configuration ────────────────────────────────────────────────────────────

const ANALYSIS_VERSION = "2.0";
const MODEL_NAME = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

function getApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key || key.includes("your-")) return null;
  return key;
}

const SchemaType = {
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
} as const;

type SchemaTypeName = (typeof SchemaType)[keyof typeof SchemaType];

type ResponseSchema = {
  type: SchemaTypeName;
  description?: string;
  properties?: Record<string, ResponseSchema>;
  items?: ResponseSchema;
  required?: string[];
  enum?: string[];
};

type JsonSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: false;
  enum?: string[];
};

function toStrictJsonSchema(schema: ResponseSchema): JsonSchema {
  const description = schema.description ? { description: schema.description } : {};

  if (schema.type === SchemaType.OBJECT) {
    const properties = schema.properties ?? {};
    return {
      type: "object",
      ...description,
      properties: Object.fromEntries(
        Object.entries(properties).map(([key, property]) => [key, toStrictJsonSchema(property)])
      ),
      required: Object.keys(properties),
      additionalProperties: false,
    };
  }

  if (schema.type === SchemaType.ARRAY) {
    return {
      type: "array",
      ...description,
      items: schema.items ? toStrictJsonSchema(schema.items) : { type: "string" },
    };
  }

  const type = {
    [SchemaType.STRING]: "string",
    [SchemaType.NUMBER]: "number",
    [SchemaType.BOOLEAN]: "boolean",
  }[schema.type];

  return {
    type,
    ...description,
    ...(schema.enum ? { enum: schema.enum } : {}),
  };
}

// ─── Error classification ────────────────────────────────────────────────────

export type AIProviderErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_AUTH_ERROR"
  | "AI_INVALID_RESPONSE"
  | "AI_PROVIDER_ERROR"
  | "INSUFFICIENT_EVIDENCE";

export class AIProviderError extends Error {
  code: AIProviderErrorCode;
  constructor(code: AIProviderErrorCode, message: string) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

function classifyProviderError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("timeout") || msg.includes("abort")) {
    return new AIProviderError("AI_TIMEOUT", "AI request timed out");
  }
  if (msg.includes("429") || msg.includes("rate")) {
    return new AIProviderError("AI_RATE_LIMITED", "Groq rate limit reached; wait and retry");
  }
  if (msg.includes("quota") || msg.includes("limit")) {
    return new AIProviderError("AI_QUOTA_EXCEEDED", "Groq free-tier quota reached; try again later");
  }
  if (msg.includes("401") || msg.includes("unauthorized")) {
    return new AIProviderError("AI_AUTH_ERROR", "Groq rejected the API key; check GROQ_API_KEY");
  }
  if (msg.includes("invalid") || msg.includes("parse")) {
    return new AIProviderError("AI_INVALID_RESPONSE", "AI returned an invalid response");
  }
  return new AIProviderError(
    "AI_PROVIDER_ERROR",
    err instanceof Error ? err.message : "Unknown AI error"
  );
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Retry with exponential backoff ──────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) break;
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function isRetryableProviderError(err: unknown): boolean {
  if (err instanceof AIProviderError) {
    if ([
      "AI_TIMEOUT",
      "AI_RATE_LIMITED",
      "AI_QUOTA_EXCEEDED",
    ].includes(err.code)) return true;
    if (err.code === "AI_PROVIDER_ERROR") {
      return /5\d\d|network|fetch/i.test(err.message);
    }
  }
  return err instanceof Error && /timeout|rate|quota|5\d\d/i.test(err.message);
}

// ─── Structured output schemas ───────────────────────────────────────────────

const videoAnalysisSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    hookSummary: { type: SchemaType.STRING, description: "Summary of the opening hook" },
    hookStrength: {
      type: SchemaType.STRING,
      description: "Hook strength rating",
      enum: ["strong", "moderate", "weak"],
    },
    contentTheme: { type: SchemaType.STRING, description: "Main content theme" },
    targetAudience: { type: SchemaType.STRING, description: "Likely intended audience" },
    narrativeStructure: { type: SchemaType.STRING, description: "Narrative structure description" },
    callToAction: { type: SchemaType.STRING, description: "Call to action, or empty string if none" },
    pacingObservations: { type: SchemaType.STRING, description: "Pacing observations" },
    contentStrengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    contentWeaknesses: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    improvementOpportunities: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    evidence: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          claim: { type: SchemaType.STRING },
          excerpt: { type: SchemaType.STRING },
          source: { type: SchemaType.STRING },
        },
      },
    },
    hasSufficientEvidence: { type: SchemaType.BOOLEAN },
  },
  required: [
    "hookSummary",
    "hookStrength",
    "contentTheme",
    "targetAudience",
    "narrativeStructure",
    "callToAction",
    "pacingObservations",
    "contentStrengths",
    "contentWeaknesses",
    "improvementOpportunities",
    "evidence",
    "hasSufficientEvidence",
  ],
};

const comparisonAnalysisSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    hookComparison: { type: SchemaType.STRING },
    themeComparison: { type: SchemaType.STRING },
    structureComparison: { type: SchemaType.STRING },
    ctaComparison: { type: SchemaType.STRING },
    strengths: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          videoId: { type: SchemaType.STRING },
          points: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
      },
    },
    weaknesses: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          videoId: { type: SchemaType.STRING },
          points: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
      },
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    hasSufficientEvidence: { type: SchemaType.BOOLEAN },
  },
  required: [
    "summary",
    "hookComparison",
    "themeComparison",
    "structureComparison",
    "ctaComparison",
    "strengths",
    "weaknesses",
    "recommendations",
    "hasSufficientEvidence",
  ],
};

const researchAnswerSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: { type: SchemaType.STRING },
    hasSufficientEvidence: { type: SchemaType.BOOLEAN },
    citations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          videoId: { type: SchemaType.STRING },
          excerpt: { type: SchemaType.STRING },
          relevance: { type: SchemaType.NUMBER },
        },
      },
    },
  },
  required: ["answer", "hasSufficientEvidence", "citations"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoEvidence {
  claim: string;
  excerpt: string;
  source: string;
}

export interface VideoAnalysisResult {
  hookSummary: string;
  hookStrength: "strong" | "moderate" | "weak";
  contentTheme: string;
  targetAudience: string;
  narrativeStructure: string;
  callToAction: string;
  pacingObservations: string;
  contentStrengths: string[];
  contentWeaknesses: string[];
  improvementOpportunities: string[];
  evidence: VideoEvidence[];
  hasSufficientEvidence: boolean;
  modelName: string;
  analysisVersion: string;
}

export interface ComparisonAnalysisResult {
  summary: string;
  hookComparison: string;
  themeComparison: string;
  structureComparison: string;
  ctaComparison: string;
  strengths: Array<{ videoId: string; points: string[] }>;
  weaknesses: Array<{ videoId: string; points: string[] }>;
  recommendations: string[];
  hasSufficientEvidence: boolean;
}

export interface ResearchAnswerResult {
  answer: string;
  hasSufficientEvidence: boolean;
  citations: Array<{ videoId: string; excerpt: string; relevance: number }>;
}

// ─── Core generation ─────────────────────────────────────────────────────────

async function generateStructured<T>(
  schema: ResponseSchema,
  prompt: string
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AIProviderError("AI_NOT_CONFIGURED", "Add a Groq key to GROQ_API_KEY in .env");
  }

  return withRetry(
    async () => {
      try {
        const response = await withTimeout(
          (signal) => fetch(API_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODEL_NAME,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.2,
              reasoning_effort: "low",
              reasoning_format: "hidden",
              max_completion_tokens: 2048,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "clipscope_response",
                  strict: true,
                  schema: toStrictJsonSchema(schema),
                },
              },
            }),
            signal,
          }),
          REQUEST_TIMEOUT_MS
        );

        const payload = await response.json().catch(() => null) as {
          choices?: Array<{ message?: { content?: string | null } }>;
          error?: { message?: string };
        } | null;

        if (!response.ok) {
          const detail = payload?.error?.message ?? `Groq request failed (${response.status})`;
          if (response.status === 401) {
            throw new AIProviderError("AI_AUTH_ERROR", "Groq rejected the API key; check GROQ_API_KEY");
          }
          if (response.status === 429) {
            throw new AIProviderError("AI_RATE_LIMITED", "Groq rate limit reached; wait and retry");
          }
          if (response.status === 402 || response.status === 403) {
            throw new AIProviderError("AI_QUOTA_EXCEEDED", `Groq denied the request: ${detail}`);
          }
          const providerMessage = response.status >= 500
            ? `Groq service error (${response.status}): ${detail}`
            : detail;
          throw new AIProviderError("AI_PROVIDER_ERROR", providerMessage);
        }

        const content = payload?.choices?.[0]?.message?.content;
        if (!content) throw new AIProviderError("AI_INVALID_RESPONSE", "Groq returned an empty response");
        return JSON.parse(content) as T;
      } catch (err) {
        if (err instanceof AIProviderError) throw err;
        throw classifyProviderError(err);
      }
    },
    isRetryableProviderError
  );
}

// ─── Video analysis ───────────────────────────────────────────────────────────

export async function analyzeVideo(input: {
  title: string | null;
  description: string | null;
  transcript: string | null;
  platform: string;
  durationSeconds: number | null;
  views?: number | null;
  likes?: number | null;
  commentsCount?: number | null;
}): Promise<VideoAnalysisResult> {
  const { title, description, transcript, platform, durationSeconds, views, likes, commentsCount } = input;

  const evidence = transcript?.trim() ?? "";
  const metadataEvidence = [
    title ? `Title: ${title}` : null,
    description ? `Description: ${description.slice(0, 500)}` : null,
    views !== null && views !== undefined ? `Views: ${views}` : null,
    likes !== null && likes !== undefined ? `Likes: ${likes}` : null,
    commentsCount !== null && commentsCount !== undefined ? `Comments: ${commentsCount}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const metadata = [metadataEvidence, `Platform: ${platform}`, durationSeconds ? `Duration: ${durationSeconds}s` : null]
    .filter(Boolean)
    .join("\n");

  if (!evidence && !metadataEvidence) {
    throw new AIProviderError("INSUFFICIENT_EVIDENCE", "No metadata or transcript available for analysis");
  }

  const hasContentText = Boolean(evidence || title || description);
  const evidenceMode = evidence
    ? "transcript and supplied metadata"
    : hasContentText
      ? "title, description, and supplied performance metadata"
      : "performance metrics only";
  const prompt = `You are a short-form video content analyst. Analyze the following video using only the supplied ${evidenceMode}.

${metadata}

TRANSCRIPT (may be empty):
${evidence || "No transcript available."}

For each field, ground your analysis in the provided evidence. If no transcript is supplied, do not claim to know what is shown or spoken in the video, its pacing, or its narrative structure. If only performance metrics are available, explicitly mark content and creative observations as unknown and discuss only what those metrics support. Use short verbatim excerpts from supplied text as evidence when available. Never invent dialogue or scenes.

Return JSON matching the required schema.`;

  const result = await generateStructured<VideoAnalysisResult>(videoAnalysisSchema, prompt);

  return {
    ...result,
    modelName: MODEL_NAME,
    analysisVersion: ANALYSIS_VERSION,
  };
}

// ─── Comparison analysis ─────────────────────────────────────────────────────

export async function analyzeComparison(
  videos: Array<{
    id: string;
    title: string | null;
    platform: string;
    transcript: string | null;
    analysis: VideoAnalysisResult | null;
  }>
): Promise<ComparisonAnalysisResult> {
  if (videos.length < 2) {
    throw new AIProviderError("INSUFFICIENT_EVIDENCE", "Need at least 2 videos for comparison");
  }

  const videoSummaries = videos
    .map((v) => {
      const analysis = v.analysis
        ? `Hook: ${v.analysis.hookSummary}\nTheme: ${v.analysis.contentTheme}\nStructure: ${v.analysis.narrativeStructure}\nCTA: ${v.analysis.callToAction}\nStrengths: ${v.analysis.contentStrengths.join("; ")}\nWeaknesses: ${v.analysis.contentWeaknesses.join("; ")}`
        : "No prior analysis.";
      return `VIDEO [${v.id}] - ${v.title ?? "Untitled"} (${v.platform})\n${analysis}\nTranscript excerpt: ${(v.transcript ?? "").slice(0, 800) || "No transcript"}`;
    })
    .join("\n\n---\n\n");

  const prompt = `You are a short-form video comparison analyst. Compare the following videos based ONLY on the provided evidence.

${videoSummaries}

Provide a structured comparison. If evidence is insufficient for any comparison, say so. Do not invent metrics or facts.

Return JSON matching the required schema. For strengths and weaknesses, use the video IDs provided in brackets.`;

  return generateStructured<ComparisonAnalysisResult>(comparisonAnalysisSchema, prompt);
}

// ─── Research answer (RAG) ──────────────────────────────────────────────────

export async function answerResearchQuestion(
  question: string,
  evidence: Array<{ videoId: string; videoTitle: string | null; excerpt: string; relevance: number }>
): Promise<ResearchAnswerResult> {
  const context = evidence
    .map(
      (e, i) =>
        `[${i + 1}] Video: ${e.videoTitle ?? "Untitled"} (ID: ${e.videoId})\nExcerpt: "${e.excerpt}"`
    )
    .join("\n\n");

  const prompt = `You are a research assistant answering questions about short-form video content.

Question: ${question}

Retrieved evidence:
${context || "No evidence available."}

Instructions:
- Answer ONLY based on the provided evidence.
- If the evidence is insufficient to answer, set hasSufficientEvidence to false and explain what is missing.
- Cite sources by including the video IDs in your citations.
- Do not fabricate information, metrics, or quotes.
- Do not access records outside the provided evidence.

Return JSON matching the required schema.`;

  return generateStructured<ResearchAnswerResult>(researchAnswerSchema, prompt);
}

// ─── Legacy functions (backward compat) ──────────────────────────────────────

export interface HookAnalysis {
  hookText: string;
  hookType: "question" | "statement" | "statistic" | "story" | "other";
  hookStrength: "strong" | "moderate" | "weak";
  rationale: string;
  evidenceExcerpt: string;
}

export interface StoryAnalysis {
  structure: string;
  pacing: string;
  narrativeArc: string;
  keyMoments: string[];
  evidenceExcerpts: string[];
}

export async function analyzeHook(
  transcript: string,
  videoTitle: string | null
): Promise<HookAnalysis | null> {
  try {
    const result = await analyzeVideo({
      title: videoTitle,
      description: null,
      transcript,
      platform: "unknown",
      durationSeconds: null,
    });
    return {
      hookText: result.hookSummary,
      hookType: "other",
      hookStrength: result.hookStrength,
      rationale: result.evidence[0]?.claim ?? "Hook analyzed from transcript",
      evidenceExcerpt: result.evidence[0]?.excerpt ?? "",
    };
  } catch {
    return null;
  }
}

export async function analyzeStoryStructure(
  transcript: string,
  videoTitle: string | null
): Promise<StoryAnalysis | null> {
  try {
    const result = await analyzeVideo({
      title: videoTitle,
      description: null,
      transcript,
      platform: "unknown",
      durationSeconds: null,
    });
    return {
      structure: result.narrativeStructure,
      pacing: result.pacingObservations,
      narrativeArc: result.narrativeStructure,
      keyMoments: result.contentStrengths,
      evidenceExcerpts: result.evidence.map((e) => e.excerpt),
    };
  } catch {
    return null;
  }
}
