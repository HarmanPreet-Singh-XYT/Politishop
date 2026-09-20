import { createHash } from "node:crypto";
import { jsonb, query } from "./db";
import type { AiReport } from "./gptzero";

/**
 * AI-o-meter results are scored on demand and, without this, forgotten — so there is nothing
 * to rank. One representative row per speech (the primary-speaker scope) feeds the leaderboard.
 */

export function reportId(transcriptText: string, speakerId: string | null): string {
  return createHash("sha256")
    .update(`ai:${speakerId ?? "all"}:${transcriptText}`)
    .digest("hex")
    .slice(0, 32);
}

interface Highlight {
  text: string;
  start: number;
  prob: number | null;
}

function pick(report: AiReport, direction: "max" | "min"): Highlight | null {
  const scored = report.sentences.filter((sentence) => sentence.generatedProb !== null);
  if (scored.length === 0) return null;
  const chosen = scored.reduce((a, b) =>
    direction === "max"
      ? (b.generatedProb ?? 0) > (a.generatedProb ?? 0)
        ? b
        : a
      : (b.generatedProb ?? 0) < (a.generatedProb ?? 0)
        ? b
        : a,
  );
  return { text: chosen.text.slice(0, 200), start: chosen.start, prob: chosen.generatedProb };
}

export async function saveAiReport(input: {
  transcriptText: string;
  speakerId: string | null;
  source: string;
  title: string;
  videoId: string | null;
  report: AiReport;
}): Promise<void> {
  const id = reportId(input.transcriptText, input.speakerId);
  const mostAi = pick(input.report, "max");
  const mostHuman = pick(input.report, "min");

  await query(
    `INSERT INTO ai_reports (
       id, speaker_id, source, title, video_id, scorable, ai_probability,
       flagged_count, sentence_count, word_count, most_ai, most_human
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       source         = EXCLUDED.source,
       title          = EXCLUDED.title,
       video_id       = EXCLUDED.video_id,
       scorable       = EXCLUDED.scorable,
       ai_probability = EXCLUDED.ai_probability,
       flagged_count  = EXCLUDED.flagged_count,
       sentence_count = EXCLUDED.sentence_count,
       word_count     = EXCLUDED.word_count,
       most_ai        = EXCLUDED.most_ai,
       most_human     = EXCLUDED.most_human,
       updated_at     = now()`,
    [
      id,
      input.speakerId,
      input.source,
      input.title,
      input.videoId,
      input.report.scorable,
      input.report.document?.completelyGeneratedProb ?? null,
      input.report.flaggedCount,
      input.report.sentences.length,
      input.report.wordCount,
      jsonb(mostAi),
      jsonb(mostHuman),
    ],
  );
}

export interface LeaderboardSource {
  source: string;
  speeches: number;
  avgAi: number;
  flagged: number;
  words: number;
  lastUpdated: string;
}

export interface LeaderboardSpeech {
  id: string;
  source: string;
  title: string;
  videoId: string | null;
  aiProbability: number | null;
  flaggedCount: number;
  wordCount: number;
  updatedAt: string;
}

type SourceRow = {
  source: string;
  speeches: number;
  avg_ai: number;
  flagged: number;
  words: number;
  last_updated: Date;
};

type SpeechRow = {
  id: string;
  source: string;
  title: string;
  video_id: string | null;
  ai_probability: number | null;
  flagged_count: number;
  word_count: number;
  updated_at: Date;
};

export async function listLeaderboard(): Promise<{
  sources: LeaderboardSource[];
  recent: LeaderboardSpeech[];
}> {
  // Dedupe to the newest row per speech, so re-scoring one clip does not double-count it.
  const { rows: sources } = await query<SourceRow>(
    `WITH latest AS (
       SELECT DISTINCT ON (coalesce(video_id, title)) *
         FROM ai_reports
        WHERE scorable = true AND ai_probability IS NOT NULL
        ORDER BY coalesce(video_id, title), updated_at DESC
     )
     SELECT source,
            count(*)::int             AS speeches,
            avg(ai_probability)::float8 AS avg_ai,
            sum(flagged_count)::int   AS flagged,
            sum(word_count)::int      AS words,
            max(updated_at)           AS last_updated
       FROM latest
      GROUP BY source
      ORDER BY avg_ai DESC`,
  );

  const { rows: recent } = await query<SpeechRow>(
    `WITH latest AS (
       SELECT DISTINCT ON (coalesce(video_id, title)) *
         FROM ai_reports
        WHERE scorable = true AND ai_probability IS NOT NULL
        ORDER BY coalesce(video_id, title), updated_at DESC
     )
     SELECT id, source, title, video_id, ai_probability, flagged_count, word_count, updated_at
       FROM latest
      ORDER BY ai_probability DESC, updated_at DESC
      LIMIT 25`,
  );

  return {
    sources: sources.map((row) => ({
      source: row.source,
      speeches: row.speeches,
      avgAi: row.avg_ai,
      flagged: row.flagged,
      words: row.words,
      lastUpdated: row.last_updated.toISOString(),
    })),
    recent: recent.map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      videoId: row.video_id,
      aiProbability: row.ai_probability,
      flaggedCount: row.flagged_count,
      wordCount: row.word_count,
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}
