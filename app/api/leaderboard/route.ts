import { isBoardDimension, listLeaderboard } from "@/lib/reports";

export const runtime = "nodejs";

/** Ranked groups for one dimension, plus the trend over time and the most AI-like speeches. */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("dimension");
  const dimension = isBoardDimension(requested) ? requested : "source";

  try {
    return Response.json(await listLeaderboard(dimension));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to read the leaderboard." },
      { status: 500 },
    );
  }
}
