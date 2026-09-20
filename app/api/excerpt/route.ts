import { randomUUID } from "node:crypto";
import {
  MAX_CLIP_JOBS,
  clipJobsInFlight,
  releaseClipJob,
  tryAcquireClipJob,
} from "@/lib/clip-jobs";
import { insertExcerpt } from "@/lib/excerpts";
import { scoreExcerpt } from "@/lib/gptzero";
import { parseCpacId, parseYoutubeId } from "@/lib/recording-id";
import { cleanupClip, extractCpacMinuteClip, extractMinuteClip } from "@/lib/sources";
import { transcribeFile } from "@/lib/stt-file";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Analyze a 60-second excerpt: cut the clip (yt-dlp/ffmpeg for YouTube, HLS for CPAC),
 * transcribe it with ElevenLabs, score the text with GPTZero, and archive the row.
 */
export async function POST(request: Request) {
  if (!tryAcquireClipJob()) {
    return Response.json(
      {
        error: `Already analyzing ${MAX_CLIP_JOBS} excerpts. Wait for one to finish.`,
        inFlight: clipJobsInFlight(),
      },
      { status: 429 },
    );
  }

  let audioPath: string | null = null;
  try {
    const body = (await request.json().catch(() => null)) as {
      url?: string;
      startSec?: number;
    } | null;
    const url = body?.url?.trim();
    const isYoutube = !!url && !!parseYoutubeId(url);
    const isCpac = !!url && !!parseCpacId(url);
    if (!isYoutube && !isCpac) {
      return Response.json(
        { error: "A valid YouTube or CPAC URL is required." },
        { status: 400 },
      );
    }

    const startSec = Math.max(0, Math.floor(Number(body?.startSec) || 0));
    const clip = isYoutube
      ? await extractMinuteClip(url!, startSec)
      : await extractCpacMinuteClip(url!, startSec);
    audioPath = clip.audioPath;

    const transcript = await transcribeFile(clip.audioPath);
    const detection = await scoreExcerpt(transcript);

    const row = await insertExcerpt({
      id: randomUUID(),
      url: url!,
      sourceType: "video",
      videoId: clip.videoId,
      title: clip.title,
      startSec: clip.startSec,
      durationSec: clip.durationSec,
      publishedAt: clip.publishedAt,
      sourceDurationSec: clip.sourceDurationSec,
      transcript,
      verdict: detection.verdict,
      probability: detection.probability,
      probs: detection.probs,
      confidence: detection.confidence,
      sentences: detection.sentences,
      words: detection.words,
    });

    return Response.json(row);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 },
    );
  } finally {
    if (audioPath) cleanupClip(audioPath);
    releaseClipJob();
  }
}

export async function GET() {
  return Response.json({ inFlight: clipJobsInFlight(), max: MAX_CLIP_JOBS });
}
