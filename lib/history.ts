import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ChatMessage,
  Transcript,
  TranscriptStats,
  VideoProposal,
} from "./types";

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatSession extends ChatSummary {
  createdAt: string;
  messages: ChatMessage[];
  proposal: VideoProposal | null;
  browserSessionId: string | null;
  transcript: Transcript | null;
  stats: TranscriptStats | null;
  /** Diarized speaker the clip is mainly about, if one was picked. */
  primarySpeaker?: string | null;
}

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function chatsDir(): string {
  return path.resolve(process.cwd(), "out", "chats");
}

function titleFrom(messages: ChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user" && message.text.trim());
  const title = firstUser?.text.trim() || "New conversation";
  return title.length > 70 ? `${title.slice(0, 70)}…` : title;
}

export async function listChats(): Promise<ChatSummary[]> {
  let files: string[];
  try {
    files = await readdir(chatsDir());
  } catch {
    return [];
  }

  const summaries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          const session = JSON.parse(
            await readFile(path.join(chatsDir(), file), "utf8"),
          ) as ChatSession;
          return {
            id: session.id,
            title: session.title,
            updatedAt: session.updatedAt,
            messageCount: session.messages?.length ?? 0,
          };
        } catch {
          return null;
        }
      }),
  );

  return summaries
    .filter((summary): summary is ChatSummary => summary !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChat(id: string): Promise<ChatSession | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    return JSON.parse(
      await readFile(path.join(chatsDir(), `${id}.json`), "utf8"),
    ) as ChatSession;
  } catch {
    return null;
  }
}

export async function saveChat(input: {
  id: string;
  messages: ChatMessage[];
  proposal: VideoProposal | null;
  browserSessionId: string | null;
  transcript: Transcript | null;
  stats: TranscriptStats | null;
  primarySpeaker?: string | null;
}): Promise<ChatSummary> {
  if (!ID_PATTERN.test(input.id)) throw new Error("Invalid chat id.");

  const existing = await getChat(input.id);
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: input.id,
    title: titleFrom(input.messages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messageCount: input.messages.length,
    messages: input.messages,
    proposal: input.proposal,
    browserSessionId: input.browserSessionId,
    transcript: input.transcript,
    stats: input.stats,
    primarySpeaker: input.primarySpeaker ?? null,
  };

  const directory = chatsDir();
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${input.id}.json`),
    JSON.stringify(session, null, 2),
  );

  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    messageCount: session.messageCount,
  };
}
