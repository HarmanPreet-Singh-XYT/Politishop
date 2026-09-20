import { listExcerpts } from "@/lib/excerpts";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ results: await listExcerpts(50) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to read the excerpt archive." },
      { status: 500 },
    );
  }
}
