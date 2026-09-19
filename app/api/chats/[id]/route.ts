import { getChat, saveChat } from "@/lib/history";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getChat(id);
  if (!session) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }
  return Response.json(session);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const summary = await saveChat({
      id,
      messages: (body.messages as never) ?? [],
      proposal: (body.proposal as never) ?? null,
      browserSessionId: (body.browserSessionId as string | null) ?? null,
      transcript: (body.transcript as never) ?? null,
      stats: (body.stats as never) ?? null,
      primarySpeaker: (body.primarySpeaker as string | null) ?? null,
    });
    return Response.json(summary);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save chat." },
      { status: 400 },
    );
  }
}
