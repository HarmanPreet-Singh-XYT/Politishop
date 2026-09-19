import OpenAI from "openai";
import { env } from "./env";
import { runTool, toolDefinitions, type ToolState } from "./tools";
import type { AgentEvent } from "./events";
import type { VideoProposal } from "./types";

export interface AgentHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentInput {
  message: string;
  history?: AgentHistoryMessage[];
  forceTool?: string;
  model?: string;
  video?: VideoProposal;
}

const MAX_TURNS = 6;

const SYSTEM_PROMPT = `You are the orchestration agent for a political-speech ingestion pipeline. Your job: turn whatever the user gives you into a transcribed speech.

You have tools:
- resolve_input(input): classify raw input as a YouTube link or a search description.
- find_video(query, url?, recency?): find the single best YouTube video. Pass "url" when the user gave a link; otherwise pass a short topic "query" (never the user's sentence) and set "recency" to "latest" or "relevant".
- create_project(url, name?): transcribe an approved video, save the transcript, and open it as a new project. Only call this AFTER the user approves the video.

Rules:
- If the user gives a link (youtube.com/watch, youtu.be, /shorts, /embed, or a bare video id), call find_video with that url. You do not need a query when you pass a url.
- If the user describes what they want, call resolve_input, then find_video.
- Write find_video's "query" like a short YouTube search a person would type for the topic — NEVER the user's sentence. Extract the subject, plus any named event, venue or year. Drop filler and, crucially, drop recency/relative words ("latest", "last", "most recent", "recent", "newest", "today", "this week") — they match nothing useful on YouTube and bury the real results. Instead express recency through the "recency" argument.
  - "bring the last trump speech" → query "Trump speech", recency "latest".
  - "the latest news on the ceasefire" → query "ceasefire", recency "latest".
  - "Trump's speech at the 2024 RNC" → query "Trump RNC 2024 speech", recency "relevant" (the event names the target).
  - "an Obama speech" → query "Obama speech", recency "relevant".
- Set "recency" to "latest" when the user wants the newest / most recent / "last" one, and "relevant" when they named a specific event or just a topic. When unsure, use "relevant". Keep the query to roughly 2-6 words: subject + optional event/venue/year.
- After find_video, briefly say what you found and ask whether to create a project from it or look for a different one. Do NOT create the project yet.
- While a video is awaiting a decision, do not search again unless the user rejects it or asks for a different one.
- If the user rejects the video or asks for another, call find_video again with a refined query and never propose the same video twice.
- When the user approves, call create_project for the approved URL. Then tell the user the project was created and is now open.
- Never call create_project before the user approves a video.
- If the user sends a greeting or something unrelated to finding a speech, reply briefly and invite them to paste a link or describe a speech. Do not call any tool.
- Keep replies to 1-3 short sentences. Never invent video details — use only what the tools return.`;

export async function runAgent(
  input: RunAgentInput,
  emit: (event: AgentEvent) => void,
): Promise<void> {
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(input.history ?? []).map<OpenAI.Chat.Completions.ChatCompletionMessageParam>(
      (message) => ({ role: message.role, content: message.content }),
    ),
    { role: "user", content: input.message },
  ];
  const state: ToolState = {};
  if (input.video) state.proposal = { video: input.video };
  let forceTool = input.forceTool;
  let replied = false;
  const model = input.model ?? env.openaiModel;

  emit({ type: "meta", model });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: toolDefinitions,
      tool_choice: forceTool ? { type: "function", function: { name: forceTool } } : "auto",
    });

    const message = completion.choices[0]?.message;
    if (!message) break;
    messages.push(message);

    const toolCalls = (message.tool_calls ?? []).filter((call) => call.type === "function");
    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await runTool(call.function.name, args, state, emit);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : String(error) };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      forceTool = undefined;
      continue;
    }

    const text = message.content?.trim();
    if (text) {
      replied = true;
      emit({ type: "reply", text });
    }
    break;
  }

  if (!replied) {
    emit({
      type: "reply",
      text: "I wasn't able to finish that — could you rephrase what you're looking for?",
    });
  }

  emit({ type: "done" });
}
