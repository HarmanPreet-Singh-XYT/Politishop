"use client";

import { ArrowUp, Check, Copy, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Loader } from "@/components/ui/loader";
import { Message } from "@/components/ui/message";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { ToolMenu, type ComposerMode } from "@/components/ToolMenu";
import { cn } from "@/lib/utils";
import type { ChatMessage, VideoProposal as VideoProposalType } from "@/lib/types";
import { VideoProposal } from "@/components/VideoProposal";
import type { Status } from "./useAgentChat";

const SUGGESTIONS = [
  "donald trump heroic shot act",
  "I want the moment Trump was shot at the rally",
];

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready",
  thinking: "Working…",
  awaiting: "Waiting for your call",
  transcribing: "Transcribing audio…",
  ready: "Transcript ready",
  error: "Needs attention",
};

interface ChatPanelProps {
  messages: ChatMessage[];
  status: Status;
  busy: boolean;
  model: string | null;
  proposal: VideoProposalType | null;
  onSend: (text: string) => void;
  onConfirm: () => void;
  onReject: () => void;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  onTranscribeDirect: (url: string) => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const { messages, status, proposal, onSend } = props;
  const [input, setInput] = useState("");
  const awaiting = status === "awaiting" && proposal !== null;

  function submit() {
    const value = input.trim();
    if (!value || props.busy) return;
    setInput("");
    if (props.mode === "direct") {
      props.onTranscribeDirect(value);
      return;
    }
    onSend(value);
  }

  const composer = (
    <Composer
      status={status}
      busy={props.busy}
      mode={props.mode}
      input={input}
      onInputChange={setInput}
      onSubmit={submit}
      onModeChange={props.onModeChange}
      autoFocus={messages.length === 0}
    />
  );

  if (messages.length === 0 && !awaiting) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 pb-10 sm:px-5 sm:pb-14">
        <div className="w-full max-w-2xl">
          <h1 className="text-center text-[24px] font-semibold leading-tight tracking-tight sm:text-[30px]">
            What do you want to check?
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-center text-[13.5px] leading-relaxed text-muted-foreground">
            Paste a YouTube link, or describe a speech and the agent finds the best match.
          </p>

          <div className="mt-7">{composer}</div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <PromptSuggestion
                key={suggestion}
                size="sm"
                className="h-8 rounded-full border-border/70 px-3 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onSend(suggestion)}
              >
                {suggestion}
              </PromptSuggestion>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatContainerRoot className="scroll-quiet min-h-0 flex-1">
        <ChatContainerContent className="mx-auto w-full max-w-2xl gap-7 px-4 py-6 sm:px-5 sm:py-8">
          {messages.map((message) => (
            <MessageRow key={message.id} message={message} busy={props.busy} model={props.model} />
          ))}

          {awaiting ? (
            <Message className="flex-row">
              <div
                className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
                aria-hidden="true"
              >
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <VideoProposal
                  video={proposal}
                  onConfirm={props.onConfirm}
                  onReject={props.onReject}
                  disabled={props.busy}
                />
              </div>
            </Message>
          ) : null}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="px-4 pb-4 pt-1 sm:px-5">{composer}</div>
    </div>
  );
}

function Composer({
  status,
  busy,
  mode,
  input,
  onInputChange,
  onSubmit,
  onModeChange,
  autoFocus,
}: {
  status: Status;
  busy: boolean;
  mode: ComposerMode;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onModeChange: (mode: ComposerMode) => void;
  autoFocus?: boolean;
}) {
  const placeholder =
    mode === "direct"
      ? busy
        ? "Working…"
        : "Paste a YouTube link to transcribe it directly"
      : busy
        ? "Working…"
        : "Paste a link, or describe the speech you want";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PromptInput
        value={input}
        onValueChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={busy}
        className="rounded-[26px] border-border/70 bg-card/85 p-3 shadow-2xl backdrop-blur-xl transition-colors focus-within:border-ring/60"
      >
        <PromptInputTextarea
          autoFocus={autoFocus}
          placeholder={placeholder}
          disabled={busy}
          className="min-h-[62px] px-2 text-[14.5px] leading-relaxed dark:bg-transparent"
        />
        <PromptInputActions className="justify-between px-0.5 pt-1">
          <ToolMenu value={mode} onChange={onModeChange} disabled={busy} />

          <Button
            size="icon"
            className="size-9 rounded-full"
            onClick={onSubmit}
            disabled={busy || input.trim().length === 0}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </PromptInputActions>
      </PromptInput>

      <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-muted-foreground">
        <span>Enter sends · Shift+Enter adds a line</span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "error" ? "bg-destructive" : busy ? "bg-warning" : "bg-success",
            )}
          />
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  busy,
  model,
}: {
  message: ChatMessage;
  busy: boolean;
  model: string | null;
}) {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Message className={cn("flex-row", isUser && "flex-row-reverse")}>
        <div
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            isUser
              ? "border border-border/70 bg-background/70 text-muted-foreground backdrop-blur"
              : "bg-primary text-primary-foreground",
          )}
          aria-hidden="true"
        >
          {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
        </div>

        <div className={cn("flex min-w-0 flex-col", isUser ? "items-end" : "items-start")}>
          <div
            className={cn(
              "max-w-[68ch] break-words rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
              isUser && "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
              isAssistant && "border border-border/60 bg-card/70 text-card-foreground backdrop-blur-xl",
              isError && "border border-destructive/40 bg-destructive/10 text-foreground backdrop-blur",
            )}
          >
            {message.text ? (
              <span className="whitespace-pre-wrap">{linkify(message.text)}</span>
            ) : null}

            {message.steps.length > 0 ? (
              <div
                className={cn(
                  "flex flex-col gap-1.5",
                  message.text && "mt-2.5 border-t border-border/60 pt-2.5",
                )}
              >
                {message.steps.map((step, index) => {
                  const done = !busy || index < message.steps.length - 1;
                  return (
                    <div
                      key={`${index}-${step}`}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      {done ? (
                        <Check className="size-3 shrink-0 text-success" />
                      ) : (
                        <Loader variant="pulse-dot" size="sm" />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {isAssistant && !message.text && message.steps.length === 0 && busy ? (
              <Loader variant="dots" size="sm" />
            ) : null}
          </div>

          {isAssistant && (message.text || message.steps.length > 0) ? (
            <AssistantMeta message={message} model={model} />
          ) : null}
        </div>
      </Message>
    </motion.div>
  );
}

function AssistantMeta({ message, model }: { message: ChatMessage; model: string | null }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  async function copy() {
    if (!message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
      {message.at ? <time className="tabular-nums">{formatTime(message.at)}</time> : null}

      {model ? (
        <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
          <Sparkles className="size-2.5" />
          {model}
        </span>
      ) : null}

      <div className="ml-1 flex items-center gap-0.5">
        {message.text ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-md text-muted-foreground hover:text-foreground"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy message"}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-6 rounded-md hover:text-foreground",
            vote === "up" ? "text-foreground" : "text-muted-foreground",
          )}
          onClick={() => setVote((current) => (current === "up" ? null : "up"))}
          aria-pressed={vote === "up"}
          aria-label="Good response"
        >
          <ThumbsUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-6 rounded-md hover:text-foreground",
            vote === "down" ? "text-foreground" : "text-muted-foreground",
          )}
          onClick={() => setVote((current) => (current === "down" ? null : "down"))}
          aria-pressed={vote === "down"}
          aria-label="Bad response"
        >
          <ThumbsDown className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Turn bare URLs in a message into links so a source can be opened directly. */
function linkify(text: string) {
  return text.split(URL_PATTERN).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all underline underline-offset-2 hover:opacity-80"
      >
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}
