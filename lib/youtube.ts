import type { VideoSummary } from "./types";

export function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Accept a full YouTube URL or a bare 11-character video id. */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const paramId = url.searchParams.get("v");
    if (paramId) return paramId;
    return url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1] ?? null;
  } catch {
    return trimmed.match(/^[\w-]{11}$/)?.[0] ?? null;
  }
}

/** Public oEmbed lookup, so a pasted link gets real title/channel/thumbnail without a browser. */
export async function fetchOEmbed(videoId: string): Promise<{
  title: string;
  channel: string;
  thumbnail: string;
}> {
  const fallback = {
    title: `YouTube video ${videoId}`,
    channel: "",
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };

  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      canonicalWatchUrl(videoId),
    )}&format=json`;
    const response = await fetch(endpoint);
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      title: string;
      author_name: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title,
      channel: data.author_name,
      thumbnail: data.thumbnail_url ?? fallback.thumbnail,
    };
  } catch {
    return fallback;
  }
}

export function videoSummaryFromOEmbed(
  videoId: string,
  meta: { title: string; channel: string; thumbnail: string },
): VideoSummary {
  return {
    title: meta.title,
    channel: meta.channel,
    url: canonicalWatchUrl(videoId),
    videoId,
    thumbnail: meta.thumbnail,
  };
}

/** Best-effort video length from the public watch page, used to catch truncated transcripts. */
export async function fetchYoutubeDurationSeconds(videoId: string): Promise<number | null> {
  try {
    const response = await fetch(canonicalWatchUrl(videoId), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const seconds = Number(html.match(/"lengthSeconds":"(\d+)"/)?.[1]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}
