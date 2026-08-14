import "server-only";
import { createClient } from "@/lib/supabase/server";
import { answerResearchQuestion } from "@/lib/ai/groq";

export interface RetrievedEvidence {
  videoId: string;
  videoTitle: string | null;
  excerpt: string;
  relevance: number;
}

type ResearchVideo = {
  id: string;
  title: string | null;
  description: string | null;
  platform: string;
  creator_name: string | null;
  canonical_url: string;
  views: number | null;
  likes: number | null;
  comments_count: number | null;
  duration_seconds: number | null;
};

type ResearchTranscript = { video_id: string; transcript_text: string | null; created_at: string };
type ResearchAnalysis = {
  video_id: string;
  hook_summary: string | null;
  content_theme: string | null;
  target_audience: string | null;
  narrative_structure: string | null;
  call_to_action: string | null;
  pacing_observations: string | null;
  content_strengths: string[] | null;
  content_weaknesses: string[] | null;
  created_at: string;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "and", "are", "best", "can", "could", "does", "for", "from",
  "has", "have", "how", "into", "its", "least", "more", "most", "much", "of", "show", "the",
  "their", "them", "there", "these", "this", "those", "video", "videos", "was", "what", "when",
  "which", "who", "with", "would", "your",
]);

async function loadWorkspaceResearchVideos(workspaceId: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("videos")
    .select("id, title, description, platform, creator_name, canonical_url, views, likes, comments_count, duration_seconds")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw new Error(`Could not load workspace videos: ${error.message}`);
  const videos = (rows ?? []) as unknown as ResearchVideo[];
  if (!videos.length) return { videos, transcripts: new Map<string, ResearchTranscript>(), analyses: new Map<string, ResearchAnalysis>() };

  const videoIds = videos.map((video) => video.id);
  const [transcriptResult, analysisResult] = await Promise.all([
    supabase.from("transcripts").select("video_id, transcript_text, created_at").in("video_id", videoIds)
      .order("created_at", { ascending: false }).limit(1000),
    supabase.from("video_analyses").select("video_id, hook_summary, content_theme, target_audience, narrative_structure, call_to_action, pacing_observations, content_strengths, content_weaknesses, created_at")
      .in("video_id", videoIds).order("created_at", { ascending: false }).limit(1000),
  ]);

  if (transcriptResult.error) throw new Error(`Could not load workspace transcripts: ${transcriptResult.error.message}`);
  if (analysisResult.error) throw new Error(`Could not load saved video analyses: ${analysisResult.error.message}`);

  const transcripts = new Map<string, ResearchTranscript>();
  for (const transcript of (transcriptResult.data ?? []) as unknown as ResearchTranscript[]) {
    if (!transcripts.has(transcript.video_id)) transcripts.set(transcript.video_id, transcript);
  }
  const analyses = new Map<string, ResearchAnalysis>();
  for (const analysis of (analysisResult.data ?? []) as unknown as ResearchAnalysis[]) {
    if (!analyses.has(analysis.video_id)) analyses.set(analysis.video_id, analysis);
  }

  return { videos, transcripts, analyses };
}

function videoEvidenceText(
  video: ResearchVideo,
  transcript: ResearchTranscript | undefined,
  analysis: ResearchAnalysis | undefined
) {
  const metricLines = [
    video.views !== null ? `Views: ${video.views}` : null,
    video.likes !== null ? `Likes: ${video.likes}` : null,
    video.comments_count !== null ? `Comments: ${video.comments_count}` : null,
    video.duration_seconds !== null ? `Duration: ${video.duration_seconds} seconds` : null,
  ].filter(Boolean);
  const analysisLines = analysis ? [
    analysis.hook_summary ? `Hook: ${analysis.hook_summary}` : null,
    analysis.content_theme ? `Theme: ${analysis.content_theme}` : null,
    analysis.target_audience ? `Audience: ${analysis.target_audience}` : null,
    analysis.narrative_structure ? `Structure: ${analysis.narrative_structure}` : null,
    analysis.call_to_action ? `Call to action: ${analysis.call_to_action}` : null,
    analysis.pacing_observations ? `Pacing: ${analysis.pacing_observations}` : null,
    ...(analysis.content_strengths ?? []).map((point) => `Strength: ${point}`),
    ...(analysis.content_weaknesses ?? []).map((point) => `Opportunity: ${point}`),
  ].filter(Boolean) : [];

  return [
    video.title ? `Title: ${video.title}` : null,
    video.creator_name ? `Creator: ${video.creator_name}` : null,
    `Platform: ${video.platform.replaceAll("_", " ")}`,
    video.description ? `Description: ${video.description.slice(0, 500)}` : null,
    ...metricLines,
    transcript?.transcript_text ? `Transcript: ${transcript.transcript_text}` : null,
    ...analysisLines,
  ].filter(Boolean).join("\n");
}

function queryTerms(query: string) {
  return [...new Set(query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term)))].slice(0, 12);
}

function scoreRelevance(text: string, terms: string[]) {
  if (!terms.length) return 0.25;
  const lower = text.toLowerCase();
  let matches = 0;
  for (const term of terms) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    matches += (lower.match(re) ?? []).length;
  }
  return Math.min(1, matches / Math.max(1, terms.length * 1.5));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeExcerpt(text: string, terms: string[]) {
  if (!text) return "No transcript, metadata, or analysis has been saved for this video yet.";
  const lower = text.toLowerCase();
  const index = terms.map((term) => lower.indexOf(term)).find((position) => position >= 0) ?? 0;
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, start + 420);
  return `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export async function retrieveWorkspaceEvidence(
  workspaceId: string,
  query: string,
  limit = 8
): Promise<RetrievedEvidence[]> {
  const { videos, transcripts, analyses } = await loadWorkspaceResearchVideos(workspaceId);
  const terms = queryTerms(query);
  return videos.map((video) => {
    const text = videoEvidenceText(video, transcripts.get(video.id), analyses.get(video.id));
    return {
      videoId: video.id,
      videoTitle: video.title,
      excerpt: makeExcerpt(text, terms),
      relevance: scoreRelevance(text, terms),
    };
  }).sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

function metricQuestion(question: string): "views" | "likes" | "comments_count" | null {
  const normalized = question.toLowerCase();
  if (/\b(likes?|hearts?)\b/.test(normalized)) return "likes";
  if (/\b(views?|view count)\b/.test(normalized)) return "views";
  if (/\b(comments?|replies)\b/.test(normalized)) return "comments_count";
  return null;
}

function isRankingQuestion(question: string) {
  return /\b(most|highest|top|best|greatest|maximum|least|lowest|fewest|minimum)\b/i.test(question);
}

function metricLabel(metric: "views" | "likes" | "comments_count") {
  return metric === "comments_count" ? "comments" : metric;
}

function metricRankingAnswer(
  question: string,
  videos: ResearchVideo[],
  transcripts: Map<string, ResearchTranscript>,
  analyses: Map<string, ResearchAnalysis>
) {
  const metric = metricQuestion(question);
  if (!metric || !isRankingQuestion(question)) return null;

  const descending = !/\b(least|lowest|fewest|minimum)\b/i.test(question);
  const ranked = videos.filter((video) => video[metric] !== null && Number.isFinite(video[metric]))
    .sort((left, right) => descending ? (right[metric] ?? 0) - (left[metric] ?? 0) : (left[metric] ?? 0) - (right[metric] ?? 0));
  if (!ranked.length) {
    return {
      answer: `I cannot rank ${metricLabel(metric)} yet because none of the videos in this workspace have a saved ${metricLabel(metric)} count. Refresh the video data and ask again.`,
      hasSufficientEvidence: false,
      citations: [],
    };
  }

  const top = ranked.slice(0, 3);
  const leader = top[0];
  const count = leader[metric] ?? 0;
  const title = leader.title ?? "Untitled video";
  const list = top.map((video, index) => `${index + 1}. ${video.title ?? "Untitled video"} — ${new Intl.NumberFormat("en-US").format(video[metric] ?? 0)} ${metricLabel(metric)}`).join("\n");
  const evidence = top.map((video) => ({
    videoId: video.id,
    excerpt: `${video.title ?? "Untitled video"} — ${new Intl.NumberFormat("en-US").format(video[metric] ?? 0)} ${metricLabel(metric)}. ${videoEvidenceText(video, transcripts.get(video.id), analyses.get(video.id)).split("\n").slice(1, 4).join("; ")}`,
    relevance: 1,
  }));

  return {
    answer: `${title} has the ${descending ? "most" : "fewest"} ${metricLabel(metric)} in this workspace (${new Intl.NumberFormat("en-US").format(count)}).\n\n${top.length > 1 ? `Top ${top.length}:\n${list}` : `It is the only video with a saved ${metricLabel(metric)} count.`}`,
    hasSufficientEvidence: true,
    citations: evidence,
  };
}

export async function generateGroundedAnswer(
  workspaceId: string,
  question: string
): Promise<{
  answer: string;
  hasSufficientEvidence: boolean;
  citations: Array<{ videoId: string; excerpt: string; relevance: number }>;
}> {
  const { videos, transcripts, analyses } = await loadWorkspaceResearchVideos(workspaceId);
  if (!videos.length) {
    return {
      answer: "There are no videos in this workspace yet. Import videos first, then ask a question about their metadata, transcripts, or analysis.",
      hasSufficientEvidence: false,
      citations: [],
    };
  }

  const directAnswer = metricRankingAnswer(question, videos, transcripts, analyses);
  if (directAnswer) return directAnswer;

  const terms = queryTerms(question);
  const evidence = videos.map((video) => {
    const text = videoEvidenceText(video, transcripts.get(video.id), analyses.get(video.id));
    return {
      videoId: video.id,
      videoTitle: video.title,
      excerpt: makeExcerpt(text, terms),
      relevance: scoreRelevance(text, terms),
    };
  }).sort((a, b) => b.relevance - a.relevance).slice(0, 8);

  try {
    const result = await answerResearchQuestion(question, evidence);
    const validCitations = (result.citations ?? []).filter((citation) => evidence.some((item) => item.videoId === citation.videoId));
    return { answer: result.answer, hasSufficientEvidence: result.hasSufficientEvidence, citations: validCitations };
  } catch (error) {
    console.error("[research] AI answer failed; returning retrieved workspace evidence:", error);
    const citations = evidence.slice(0, 4).map(({ videoId, excerpt, relevance }) => ({ videoId, excerpt, relevance }));
    return {
      answer: `I couldn't generate an AI summary right now, but these are the most relevant saved records in your workspace:\n\n${citations.map((citation, index) => `${index + 1}. ${evidence.find((item) => item.videoId === citation.videoId)?.videoTitle ?? "Untitled video"}: ${citation.excerpt}`).join("\n\n")}\n\nCheck the Groq API key and free-tier limits to restore generated answers.`,
      hasSufficientEvidence: citations.length > 0,
      citations,
    };
  }
}
