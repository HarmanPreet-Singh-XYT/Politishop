import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 120;

const ELEVENLABS_ISOLATION_URL = "https://api.elevenlabs.io/v1/audio-isolation";

/**
 * Proxy an uploaded clip to ElevenLabs' audio isolation (voice isolator) and stream the
 * cleaned speech back. The API only accepts a file, so the browser uploads one.
 */
export async function POST(request: Request) {
  const incoming = await request.formData().catch(() => null);
  const file = incoming?.get("audio");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Attach an audio or video file to isolate." }, { status: 400 });
  }

  const form = new FormData();
  form.set("audio", file, file.name || "input");

  try {
    const response = await fetch(ELEVENLABS_ISOLATION_URL, {
      method: "POST",
      headers: { "xi-api-key": env.elevenLabsApiKey },
      body: form,
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      return Response.json(
        { error: `ElevenLabs isolation failed (${response.status}): ${detail.slice(0, 300)}` },
        { status: 502 },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Audio isolation failed." },
      { status: 502 },
    );
  }
}
