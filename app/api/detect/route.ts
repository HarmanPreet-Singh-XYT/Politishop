import { env } from "@/lib/env";
import { scoreTranscript } from "@/lib/gptzero";
import { saveAiReport } from "@/lib/reports";
import type { Transcript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Score a transcript (optionally one speaker's words) with GPTZero. Called on demand from the
 * analytics view so it works for saved transcripts too. The result is also recorded, which is
 * what gives the leaderboard something to rank.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    transcript?: Transcript;
    speakerId?: string | null;
    source?: string;
    title?: string;
    videoId?: string | null;
    /** True when this scope is the speech's primary speaker — the row worth keeping. */
    primary?: boolean;
  } | null;

  if (!body?.transcript?.words?.length) {
    return Response.json({ error: "No transcript supplied." }, { status: 400 });
  }

  if (!env.hasGptzero()) {
    return Response.json(
      { error: "GPTZERO_API_KEY is not set, so nothing can be scored yet." },
      { status: 503 },
    );
  }

  try {
    const speakerId = body.speakerId ?? null;
    const report = await scoreTranscript(body.transcript, speakerId);

    if (body.primary === true) {
      try {
        await saveAiReport({
          transcriptText: body.transcript.text,
          speakerId,
          source: body.source?.trim() || body.title?.trim() || "Unknown source",
          title: body.title?.trim() || "Untitled speech",
          videoId: body.videoId ?? null,
          report,
        });
      } catch {
        // A missed leaderboard row is not worth failing the reading over.
      }
    }

    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "GPTZero scoring failed." },
      { status: 502 },
    );
  }
}
