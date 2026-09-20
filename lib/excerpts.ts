import { jsonb, query } from "./db";
import type { ClassProbs, ExcerptSentence, Verdict } from "./types";

export type ExcerptSourceType = "video" | "doc";

export interface ExcerptScore {
  id: string;
  url: string;
  sourceType: ExcerptSourceType;
  videoId: string;
  title: string;
  startSec: number;
  durationSec: number;
  /** When the source was aired or uploaded, in ms. Null when not published. */
  publishedAt: number | null;
  /** Full length of the source recording in seconds. Null when unknown. */
  sourceDurationSec: number | null;
  transcript: string;
  verdict: Verdict;
  probability: number;
  probs: ClassProbs;
  confidence: "high" | "medium" | "low";
  sentences: ExcerptSentence[];
  words: number;
  createdAt: string;
}

type ExcerptRow = {
  id: string;
  url: string;
  source_type: string;
  video_id: string;
  title: string | null;
  start_sec: number;
  duration_sec: number;
  published_at: string | number | null;
  source_duration_sec: number | null;
  transcript: string;
  verdict: string;
  probability: number;
  probs: ClassProbs | null;
  confidence: string;
  sentences: ExcerptSentence[] | null;
  words: number;
  created_at: Date;
};

function toEntry(row: ExcerptRow): ExcerptScore {
  return {
    id: row.id,
    url: row.url,
    sourceType: row.source_type === "doc" ? "doc" : "video",
    videoId: row.video_id,
    title: row.title ?? row.video_id,
    startSec: row.start_sec,
    durationSec: row.duration_sec,
    publishedAt: row.published_at === null ? null : Number(row.published_at),
    sourceDurationSec: row.source_duration_sec,
    transcript: row.transcript,
    verdict: row.verdict === "ai" || row.verdict === "mixed" ? row.verdict : "human",
    probability: row.probability,
    probs: row.probs ?? { ai: 0, human: 0, mixed: 0 },
    confidence: row.confidence === "high" || row.confidence === "low" ? row.confidence : "medium",
    sentences: row.sentences ?? [],
    words: row.words,
    createdAt: row.created_at.toISOString(),
  };
}

/** Persist a scored excerpt so it appears in the archive. */
export async function insertExcerpt(
  input: Omit<ExcerptScore, "createdAt">,
): Promise<ExcerptScore> {
  const { rows } = await query<{ created_at: Date }>(
    `INSERT INTO excerpts (
       id, url, source_type, video_id, title, start_sec, duration_sec,
       published_at, source_duration_sec, transcript, verdict, probability,
       probs, confidence, sentences, words
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING created_at`,
    [
      input.id,
      input.url,
      input.sourceType,
      input.videoId,
      input.title,
      input.startSec,
      input.durationSec,
      input.publishedAt,
      input.sourceDurationSec,
      input.transcript,
      input.verdict,
      input.probability,
      jsonb(input.probs),
      input.confidence,
      jsonb(input.sentences),
      input.words,
    ],
  );

  return { ...input, createdAt: rows[0].created_at.toISOString() };
}

export async function listExcerpts(limit = 50): Promise<ExcerptScore[]> {
  const { rows } = await query<ExcerptRow>(
    `SELECT * FROM excerpts ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toEntry);
}
