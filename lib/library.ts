import { jsonb, query } from "./db";
import type { Transcript, TranscriptStats, VideoSummary } from "./types";

export interface LibraryItem {
  id: string;
  createdAt: string;
  video: VideoSummary;
  stats: TranscriptStats;
}

export interface LibraryEntry extends LibraryItem {
  transcript: Transcript;
  /** Diarized speaker the clip is mainly about, if one was picked. */
  primarySpeaker?: string | null;
}

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

type LibraryRow = {
  id: string;
  video_id: string | null;
  created_at: Date;
  video: VideoSummary;
  stats: TranscriptStats;
  transcript: Transcript;
  primary_speaker: string | null;
};

/** Persist a finished transcription so it appears under Existing Content. */
export async function saveTranscriptRun(input: {
  video: VideoSummary;
  stats: TranscriptStats;
  transcript: Transcript;
  primarySpeaker?: string | null;
}): Promise<{ id: string }> {
  const videoId = input.video.videoId;
  const id = videoId || `clip-${Date.now()}`;

  // Re-transcribing a video replaces its earlier run instead of piling up duplicates.
  if (videoId) {
    await query(`DELETE FROM library_runs WHERE video_id = $1 AND id <> $2`, [videoId, id]);
  }

  await query(
    `INSERT INTO library_runs (id, video_id, video, stats, transcript, primary_speaker)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       video_id        = EXCLUDED.video_id,
       created_at      = now(),
       video           = EXCLUDED.video,
       stats           = EXCLUDED.stats,
       transcript      = EXCLUDED.transcript,
       primary_speaker = EXCLUDED.primary_speaker`,
    [
      id,
      videoId || null,
      jsonb(input.video),
      jsonb(input.stats),
      jsonb(input.transcript),
      input.primarySpeaker ?? null,
    ],
  );

  return { id };
}

export async function listLibrary(): Promise<LibraryItem[]> {
  const { rows } = await query<Pick<LibraryRow, "id" | "created_at" | "video" | "stats">>(
    `SELECT id, created_at, video, stats
       FROM library_runs
      ORDER BY created_at DESC`,
  );

  const seen = new Set<string>();
  return rows
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      video: row.video,
      stats: row.stats,
    }))
    .filter((item) => {
      const key = item.video.videoId || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function getLibraryEntry(id: string): Promise<LibraryEntry | null> {
  if (!ID_PATTERN.test(id)) return null;

  const { rows } = await query<LibraryRow>(`SELECT * FROM library_runs WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    video: row.video,
    stats: row.stats,
    transcript: row.transcript,
    primarySpeaker: row.primary_speaker,
  };
}
