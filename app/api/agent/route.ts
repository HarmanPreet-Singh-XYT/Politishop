import { runAgent } from "@/lib/agent";
import type { AgentEvent } from "@/lib/events";
import { isAllowedModel } from "@/lib/models";
import type { VideoProposal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface AgentRequestBody {
  action?: "message" | "confirm" | "reject";
  message?: string;
  videoUrl?: string;
  video?: VideoProposal;
  model?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function POST(request: Request) {
  let body: AgentRequestBody;
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Guard the shapes buildInput/runAgent depend on, so a malformed body is a
  // clean 400 rather than a crash inside the stream.
  if (body.action !== "confirm" && body.action !== "reject") {
    if (typeof body.message !== "string" || body.message.trim() === "") {
      return Response.json({ error: "A message is required." }, { status: 400 });
    }
  }
  if (body.action === "confirm" && typeof body.videoUrl !== "string") {
    return Response.json({ error: "A video URL is required to confirm." }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history.filter(
        (item): item is { role: "user" | "assistant"; content: string } =>
          Boolean(item) &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
    : undefined;

  const { message, forceTool, video } = buildInput(body);
  const model = isAllowedModel(body.model) ? body.model : undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runAgent({ message, history, forceTool, model, video }, emit);
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
        emit({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function buildInput(body: AgentRequestBody): {
  message: string;
  forceTool?: string;
  video?: VideoProposal;
} {
  if (body.action === "confirm" && typeof body.videoUrl === "string" && body.videoUrl) {
    return {
      message: `Proceed. Create a project from this exact video: ${body.videoUrl}`,
      forceTool: "create_project",
      video: body.video,
    };
  }
  if (body.action === "reject") {
    const note = typeof body.message === "string" && body.message.trim() ? ` ${body.message.trim()}` : "";
    const rejected = typeof body.videoUrl === "string" && body.videoUrl ? ` (${body.videoUrl})` : "";
    return { message: `Don't use that video${rejected} — find a different one.${note}` };
  }
  return { message: typeof body.message === "string" ? body.message.trim() : "" };
}
