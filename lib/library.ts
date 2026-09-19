import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
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

type StoredRun = LibraryEntry;

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function outDir(): string {
  return path.resolve(process.cwd(), "out");
}

/** Persist a finished transcription so it appears under Existing Content. */
export async function saveTranscriptRun(input: {
  video: VideoSummary;
  stats: TranscriptStats;
  transcript: Transcript;
  primarySpeaker?: string | null;
}): Promise<{ id: string; file: string }> {
  const directory = outDir();
  await mkdir(directory, { recursive: true });

  const videoId = input.video.videoId;
  const id = videoId || `clip-${Date.now()}`;
  const file = path.join(directory, `${id}.json`);

  // Re-transcribing a video replaces its earlier run instead of piling up duplicates.
  if (videoId) await removeRunsForVideo(directory, videoId, `${id}.json`);

  const entry: LibraryEntry = {
    id,
    createdAt: new Date().toISOString(),
    video: input.video,
    stats: input.stats,
    transcript: input.transcript,
    primarySpeaker: input.primarySpeaker ?? null,
  };
  await writeFile(file, JSON.stringify(entry, null, 2));
  return { id, file };
}

async function removeRunsForVideo(
  directory: string,
  videoId: string,
  keep: string,
): Promise<void> {
  let files: string[];
  try {
    files = await readdir(directory);
  } catch {
    return;
  }

  await Promise.all(
    files
      .filter((name) => name.endsWith(".json") && name !== keep)
      .map(async (name) => {
        try {
          const raw = JSON.parse(await readFile(path.join(directory, name), "utf8")) as {
            video?: { videoId?: string };
          };
          if (raw?.video?.videoId === videoId) {
            await unlink(path.join(directory, name));
          }
        } catch {
          // unreadable or unrelated file — leave it alone
        }
      }),
  );
}

function toItem(raw: unknown, fallbackId: string): LibraryItem | null {
  const run = raw as Partial<StoredRun>;
  if (!run?.transcript || !run.video || !run.stats) return null;
  return {
    id: run.id ?? fallbackId,
    createdAt: run.createdAt ?? new Date(0).toISOString(),
    video: run.video,
    stats: run.stats,
  };
}

export async function listLibrary(): Promise<LibraryItem[]> {
  let files: string[];
  try {
    files = await readdir(outDir());
  } catch {
    return [];
  }

  const items = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          const raw = JSON.parse(await readFile(path.join(outDir(), file), "utf8"));
          return toItem(raw, file.replace(/\.json$/, ""));
        } catch {
          return null;
        }
      }),
  );

  const seen = new Set<string>();
  return items
    .filter((item): item is LibraryItem => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((item) => {
      const key = item.video.videoId || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function getLibraryEntry(id: string): Promise<LibraryEntry | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    const raw = JSON.parse(await readFile(path.join(outDir(), `${id}.json`), "utf8"));
    const entry = raw as Partial<LibraryEntry>;
    if (!entry?.transcript || !entry.video || !entry.stats) return null;
    return entry as LibraryEntry;
  } catch {
    return null;
  }
}
