import { env } from "@/lib/env";
import { scoreTranscript } from "@/lib/gptzero";
import type { Transcript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Score a transcript (optionally one speaker's words) with GPTZero. Called on demand from the
 * analytics view so it works for saved transcripts too, not just freshly captured ones.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    transcript?: Transcript;
    speakerId?: string | null;
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
    const report = await scoreTranscript(body.transcript, body.speakerId ?? null);
    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "GPTZero scoring failed." },
      { status: 502 },
    );
  }
}
