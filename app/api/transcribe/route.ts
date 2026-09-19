import { saveTranscriptRun } from "@/lib/library";
import { pickPrimarySpeaker } from "@/lib/speakers";
import { transcribeYoutube, type TranscribeOptions } from "@/lib/transcribe";
import { transcriptStats } from "@/lib/types";
import { fetchOEmbed, parseVideoId, videoSummaryFromOEmbed } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Direct path: the user pastes a link, so we skip discovery entirely. The only AI here is
 * picking which diarized speaker the clip is about; transcription itself is ElevenLabs.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    url?: string;
    options?: TranscribeOptions;
  } | null;
  const videoId = parseVideoId(body?.url ?? "");

  if (!videoId) {
    return Response.json(
      { error: "That is not a YouTube link or video id." },
      { status: 400 },
    );
  }

  try {
    const meta = await fetchOEmbed(videoId);
    const video = videoSummaryFromOEmbed(videoId, meta);
    const transcript = await transcribeYoutube(video.url, body?.options ?? {});
    const stats = transcriptStats(transcript);
    const primary = await pickPrimarySpeaker(transcript, video.title);
    await saveTranscriptRun({
      video,
      stats,
      transcript,
      primarySpeaker: primary.speakerId,
    });
    return Response.json({
      video,
      stats,
      transcript,
      primarySpeaker: primary.speakerId,
      primarySpeakerReason: primary.reason,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not transcribe that link.",
      },
      { status: 500 },
    );
  }
}
