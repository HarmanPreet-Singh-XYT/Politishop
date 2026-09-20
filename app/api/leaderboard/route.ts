import { listLeaderboard } from "@/lib/reports";

export const runtime = "nodejs";

/** Ranked sources and the most AI-like speeches seen so far. */
export async function GET() {
  try {
    return Response.json(await listLeaderboard());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to read the leaderboard." },
      { status: 500 },
    );
  }
}
