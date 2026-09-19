import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Transcript, TranscriptStats, VideoSummary } from "./types";

export interface ProjectItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: "ready";
  video: VideoSummary;
  stats: TranscriptStats;
}

export interface ProjectEntry extends ProjectItem {
  transcript: Transcript;
}

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function projectsDir(): string {
  return path.resolve(process.cwd(), "out", "projects");
}

export async function createProject(input: {
  name?: string;
  video: VideoSummary;
  stats: TranscriptStats;
  transcript: Transcript;
}): Promise<ProjectEntry> {
  const now = new Date().toISOString();
  const id = `${input.video.videoId || "clip"}-${Date.now()}`;
  const entry: ProjectEntry = {
    id,
    name: input.name?.trim() || input.video.title || "Untitled project",
    createdAt: now,
    updatedAt: now,
    status: "ready",
    video: input.video,
    stats: input.stats,
    transcript: input.transcript,
  };

  const directory = projectsDir();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.json`), JSON.stringify(entry, null, 2));
  return entry;
}

function toItem(raw: unknown, fallbackId: string): ProjectItem | null {
  const entry = raw as Partial<ProjectEntry>;
  if (!entry?.video || !entry.stats) return null;
  const createdAt = entry.createdAt ?? new Date(0).toISOString();
  return {
    id: entry.id ?? fallbackId,
    name: entry.name ?? entry.video.title ?? "Untitled project",
    createdAt,
    updatedAt: entry.updatedAt ?? createdAt,
    status: entry.status ?? "ready",
    video: entry.video,
    stats: entry.stats,
  };
}

export async function listProjects(): Promise<ProjectItem[]> {
  let files: string[];
  try {
    files = await readdir(projectsDir());
  } catch {
    return [];
  }

  const items = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          const raw = JSON.parse(await readFile(path.join(projectsDir(), file), "utf8"));
          return toItem(raw, file.replace(/\.json$/, ""));
        } catch {
          return null;
        }
      }),
  );

  return items
    .filter((item): item is ProjectItem => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<ProjectEntry | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    const raw = JSON.parse(await readFile(path.join(projectsDir(), `${id}.json`), "utf8"));
    const entry = raw as Partial<ProjectEntry>;
    if (!entry?.transcript || !entry.video || !entry.stats) return null;
    return entry as ProjectEntry;
  } catch {
    return null;
  }
}

export async function renameProject(id: string, name: string): Promise<ProjectEntry | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name cannot be empty.");
  const entry = await getProject(id);
  if (!entry) return null;

  const updated: ProjectEntry = {
    ...entry,
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(projectsDir(), `${id}.json`), JSON.stringify(updated, null, 2));
  return updated;
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!ID_PATTERN.test(id)) return false;
  try {
    await unlink(path.join(projectsDir(), `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
