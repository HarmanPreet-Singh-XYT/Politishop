import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

const ELEVENLABS_API = "https://api.elevenlabs.io";
const DUBBING_MODEL = "dubbing_v2";

interface ProjectResponse {
  project_id?: string;
  status?: string;
  language_ids?: string[];
}

interface LanguageResponse {
  language_id?: string;
  status?: string;
  outputs?: { lossless_audio?: string } | null;
  error?: string;
}

/**
 * Start an ElevenLabs dubbing project from a public media URL. ElevenLabs fetches and
 * transcribes the source asynchronously; the first language starts generating when it is ready.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sourceUrl?: string;
    targetLang?: string;
  } | null;

  const sourceUrl = body?.sourceUrl?.trim();
  const targetLang = body?.targetLang?.trim();

  if (!sourceUrl || !targetLang) {
    return Response.json(
      { error: "A source URL and a target language are both required." },
      { status: 400 },
    );
  }

  const form = new FormData();
  form.set("source_url", sourceUrl);
  form.set("target_language", targetLang);
  form.set("model_id", DUBBING_MODEL);

  try {
    const created = await fetch(`${ELEVENLABS_API}/v1/dubbing/project`, {
      method: "POST",
      headers: { "xi-api-key": env.elevenLabsApiKey },
      body: form,
    });

    if (!created.ok) {
      const detail = await created.text();
      return Response.json(
        { error: `ElevenLabs dubbing failed (${created.status}): ${detail.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const project = (await created.json()) as ProjectResponse;
    const projectId = project.project_id;
    if (!projectId) {
      return Response.json({ error: "ElevenLabs returned no dubbing project id." }, { status: 502 });
    }

    // The language is usually queued at creation; add it explicitly if it was not.
    let languageId = project.language_ids?.[0] ?? null;
    if (!languageId) {
      const language = await fetch(
        `${ELEVENLABS_API}/v1/dubbing/project/${projectId}/language`,
        {
          method: "POST",
          headers: {
            "xi-api-key": env.elevenLabsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target_language: targetLang }),
        },
      );
      if (language.ok) {
        languageId = ((await language.json()) as LanguageResponse).language_id ?? null;
      }
    }

    return Response.json({ projectId, languageId, status: project.status ?? "queued" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Dubbing failed." },
      { status: 502 },
    );
  }
}

/** Poll a dubbing project/language until the dubbed audio is ready. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  let languageId = params.get("languageId");
  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  const auth = { "xi-api-key": env.elevenLabsApiKey };

  try {
    const projectResponse = await fetch(
      `${ELEVENLABS_API}/v1/dubbing/project/${projectId}`,
      { headers: auth, cache: "no-store" },
    );
    if (!projectResponse.ok) {
      const detail = await projectResponse.text();
      return Response.json(
        { error: `Dubbing status failed (${projectResponse.status}): ${detail.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const project = (await projectResponse.json()) as ProjectResponse;
    if (project.status === "failed") {
      return Response.json({ status: "failed", error: "The dubbing project failed." });
    }
    if (project.status !== "ready") {
      return Response.json({ status: project.status ?? "preparing" });
    }

    if (!languageId) languageId = (await firstLanguageId(projectId, auth)) ?? null;
    if (!languageId) {
      return Response.json({ status: "preparing" });
    }

    const languageResponse = await fetch(
      `${ELEVENLABS_API}/v1/dubbing/project/${projectId}/language/${languageId}`,
      { headers: auth, cache: "no-store" },
    );
    if (!languageResponse.ok) {
      const detail = await languageResponse.text();
      return Response.json(
        { error: `Dubbing status failed (${languageResponse.status}): ${detail.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const language = (await languageResponse.json()) as LanguageResponse;
    const audioUrl = language.outputs?.lossless_audio;
    if (language.status === "completed" && audioUrl) {
      return Response.json({ status: "completed", audioUrl, languageId });
    }
    if (language.status === "failed") {
      return Response.json({ status: "failed", error: language.error ?? "Dubbing failed." });
    }
    return Response.json({ status: language.status ?? "processing", languageId });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Dubbing status failed." },
      { status: 502 },
    );
  }
}

/** Read the first queued language id from a project's language list. */
async function firstLanguageId(
  projectId: string,
  auth: Record<string, string>,
): Promise<string | null> {
  const response = await fetch(`${ELEVENLABS_API}/v1/dubbing/project/${projectId}/language`, {
    headers: auth,
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as
    | LanguageResponse[]
    | { languages?: LanguageResponse[] };
  const languages = Array.isArray(payload) ? payload : (payload.languages ?? []);
  return languages[0]?.language_id ?? null;
}
