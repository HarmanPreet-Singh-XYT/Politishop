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

  const { message, forceTool, video } = buildInput(body);
  const model = isAllowedModel(body.model) ? body.model : undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runAgent({ message, history: body.history, forceTool, model, video }, emit);
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
  if (body.action === "confirm" && body.videoUrl) {
    return {
      message: `Proceed. Create a project from this exact video: ${body.videoUrl}`,
      forceTool: "create_project",
      video: body.video,
    };
  }
  if (body.action === "reject") {
    const note = body.message?.trim() ? ` ${body.message.trim()}` : "";
    const rejected = body.videoUrl ? ` (${body.videoUrl})` : "";
    return { message: `Don't use that video${rejected} — find a different one.${note}` };
  }
  return { message: body.message?.trim() ?? "" };
}
