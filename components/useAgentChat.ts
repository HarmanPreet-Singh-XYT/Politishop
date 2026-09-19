"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/events";
import type { ChatSession } from "@/lib/history";
import type { ProjectEntry } from "@/lib/projects";
import type { TranscribeOptions } from "@/lib/transcribe";
import type {
  ChatMessage,
  Transcript,
  TranscriptStats,
  VideoProposal,
  VideoSummary,
} from "@/lib/types";
import { parseVideoId } from "@/lib/youtube";
import type { ComposerMode } from "@/components/ToolMenu";

export type Status = "idle" | "thinking" | "awaiting" | "transcribing" | "ready" | "error";

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

export function useAgentChat() {
  const [chatId, setChatId] = useState<string>(() => newId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [model, setModel] = useState<string | null>(null);
  const [mode, setMode] = useState<ComposerMode>("agent");
  const [proposal, setProposal] = useState<VideoProposal | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [stats, setStats] = useState<TranscriptStats | null>(null);
  const [primarySpeaker, setPrimarySpeaker] = useState<string | null>(null);
  const [primarySpeakerReason, setPrimarySpeakerReason] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "split">("chat");
  const [saveCount, setSaveCount] = useState(0);
  const [createdProject, setCreatedProject] = useState<ProjectEntry | null>(null);
  // Options for the direct-link transcription path, edited from the Audio tools tab.
  const [transcribeOptions, setTranscribeOptions] = useState<TranscribeOptions>({
    detectEntities: true,
    noVerbatim: false,
  });
  const assistantIdRef = useRef<string | null>(null);

  const busy = status === "thinking" || status === "transcribing";

  // Persist the conversation whenever a turn settles, so it shows up in History.
  useEffect(() => {
    if (messages.length === 0 || busy) return;
    let cancelled = false;
    void fetch(`/api/chats/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        proposal,
        browserSessionId: sessionId,
        transcript,
        stats,
        primarySpeaker,
      }),
    })
      .then((response) => {
        if (response.ok && !cancelled) setSaveCount((count) => count + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId, messages, proposal, sessionId, transcript, stats, primarySpeaker, busy]);

  function updateAssistant(update: (message: ChatMessage) => ChatMessage) {
    const id = assistantIdRef.current;
    if (!id) return;
    setMessages((prev) => prev.map((message) => (message.id === id ? update(message) : message)));
  }

  function handleEvent(event: AgentEvent) {
    switch (event.type) {
      case "meta":
        setModel(event.model);
        break;
      case "step":
        updateAssistant((message) => ({ ...message, steps: [...message.steps, event.label] }));
        break;
      case "reply":
        updateAssistant((message) => ({ ...message, text: event.text }));
        break;
      case "proposal":
        setProposal(event.video);
        if (event.sessionId) setSessionId(event.sessionId);
        setStatus("awaiting");
        break;
      case "transcript":
        setTranscript(event.transcript);
        setStats(event.stats);
        setPrimarySpeaker(event.primarySpeaker ?? null);
        setPrimarySpeakerReason(event.primarySpeakerReason ?? null);
        setStatus("ready");
        setView("split");
        break;
      case "project":
        setCreatedProject(event.project);
        setStatus("ready");
        break;
      case "error":
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "error", text: event.message, steps: [], at: Date.now() },
        ]);
        setStatus("error");
        break;
      case "done":
        setStatus((current) => (current === "thinking" ? "idle" : current));
        break;
    }
  }

  async function stream(body: Record<string, unknown>) {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Agent request failed (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        handleEvent(JSON.parse(dataLine.slice(5).trim()) as AgentEvent);
      }
    }
  }

  function fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "error", text: message, steps: [], at: Date.now() },
    ]);
    setStatus("error");
  }

  function beginTurn(role: ChatMessage["role"], text: string) {
    const assistantId = newId();
    assistantIdRef.current = assistantId;
    setMessages((prev) => [
      ...prev,
      ...(text ? [{ id: newId(), role, text, steps: [], at: Date.now() } as ChatMessage] : []),
      { id: assistantId, role: "assistant", text: "", steps: [], at: Date.now() },
    ]);
  }

  function historyPayload() {
    return messages
      .filter((message) => message.role !== "error" && message.text)
      .map((message) => ({
        role: message.role === "user" ? ("user" as const) : ("assistant" as const),
        content: message.text,
      }));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const history = historyPayload();
    beginTurn("user", trimmed);
    setStatus("thinking");
    try {
      await stream({ action: "message", message: trimmed, history });
    } catch (error) {
      fail(error);
    }
  }

  async function createProject() {
    if (!proposal || busy) return;
    const video = proposal;
    const history = historyPayload();
    beginTurn("user", "Create a project from this video.");
    setStatus("transcribing");
    try {
      await stream({ action: "confirm", videoUrl: video.url, video, history });
    } catch (error) {
      fail(error);
    }
  }

  async function reject(feedback?: string) {
    if (busy) return;
    const rejectedUrl = proposal?.url;
    const history = historyPayload();
    setProposal(null);
    beginTurn("user", feedback?.trim() ? `Not this one — ${feedback.trim()}` : "Find a different video.");
    setStatus("thinking");
    try {
      await stream({ action: "reject", message: feedback, videoUrl: rejectedUrl, history });
    } catch (error) {
      fail(error);
    }
  }

  /** Direct path: transcribe a pasted link without involving the agent. */
  async function transcribeDirect(url: string) {
    if (busy) return;
    const trimmed = url.trim();
    if (!parseVideoId(trimmed)) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "error",
          text: "Direct mode needs a YouTube link. Paste one, or switch the tool to “Find with AI”.",
          steps: [],
          at: Date.now(),
        },
      ]);
      setStatus("error");
      return;
    }

    beginTurn("user", `Transcribe this link directly: ${trimmed}`);
    setStatus("transcribing");
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, options: transcribeOptions }),
      });
      const data = (await response.json()) as {
        video?: VideoSummary;
        stats?: TranscriptStats;
        transcript?: Transcript;
        primarySpeaker?: string | null;
        primarySpeakerReason?: string;
        error?: string;
      };
      if (!response.ok || !data.video || !data.stats || !data.transcript) {
        throw new Error(data.error ?? `Transcription failed (${response.status}).`);
      }

      updateAssistant((message) => ({
        ...message,
        text: "Transcript ready. It was saved to Saved transcripts.",
        steps: ["Read the link, no search needed", "Transcribed the audio with ElevenLabs"],
      }));
      setProposal({
        ...data.video,
        reason: "You pasted this link, so it was transcribed as-is.",
        candidates: [],
      });
      setTranscript(data.transcript);
      setStats(data.stats);
      setPrimarySpeaker(data.primarySpeaker ?? null);
      setPrimarySpeakerReason(data.primarySpeakerReason ?? null);
      setStatus("ready");
      setView("split");
    } catch (error) {
      fail(error);
    }
  }

  /** Replace local state with a stored conversation. */
  function restore(session: ChatSession) {
    assistantIdRef.current = null;
    setCreatedProject(null);
    setChatId(session.id);
    setMessages(session.messages ?? []);
    setProposal(session.proposal ?? null);
    setSessionId(session.browserSessionId ?? null);
    setTranscript(session.transcript ?? null);
    setStats(session.stats ?? null);
    setPrimarySpeaker(session.primarySpeaker ?? null);
    setView(session.transcript ? "split" : "chat");
    setStatus("idle");
    setModel(null);
  }

  /** Start a fresh conversation. */
  function startNew() {
    assistantIdRef.current = null;
    setCreatedProject(null);
    setChatId(newId());
    setMessages([]);
    setProposal(null);
    setSessionId(null);
    setTranscript(null);
    setStats(null);
    setPrimarySpeaker(null);
    setPrimarySpeakerReason(null);
    setView("chat");
    setStatus("idle");
    setModel(null);
  }

  return {
    chatId,
    saveCount,
    messages,
    status,
    busy,
    model,
    mode,
    setMode,
    proposal,
    sessionId,
    transcript,
    stats,
    primarySpeaker,
    primarySpeakerReason,
    view,
    createdProject,
    transcribeOptions,
    setTranscribeOptions,
    send,
    createProject,
    reject,
    transcribeDirect,
    restore,
    startNew,
  };
}
