"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AiMeter } from "@/components/AiMeter";
import { AudioEventsStrip } from "@/components/AudioEventsStrip";
import { EntityPanel } from "@/components/EntityPanel";
import { SpeakerPicker } from "@/components/SpeakerPicker";
import { TranscriptView } from "@/components/TranscriptView";
import type { AiReport } from "@/lib/gptzero";
import {
  audioEvents,
  filterTranscriptBySpeaker,
  speakerSummaries,
  transcriptStats,
  type Transcript,
  type TranscriptStats,
  type VideoSummary,
} from "@/lib/types";

function formatDuration(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = Math.round(total % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AnalyticsPanel({
  video,
  transcript,
  stats,
  sessionId,
  primarySpeaker,
  primarySpeakerReason,
}: {
  video: VideoSummary | null;
  transcript: Transcript;
  stats: TranscriptStats;
  sessionId: string | null;
  primarySpeaker?: string | null;
  primarySpeakerReason?: string | null;
}) {
  const speakers = speakerSummaries(transcript);
  // Seed from the auto-pick so we score one scope on mount instead of re-scoring immediately.
  const [selected, setSelected] = useState<string | null>(() => primarySpeaker ?? null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, AiReport>());
  const inflight = useRef(new Map<string, Promise<AiReport>>());

  // Follow the auto-picked speaker whenever a new transcript arrives.
  useEffect(() => {
    setSelected(primarySpeaker ?? null);
  }, [primarySpeaker, transcript]);

  // Score the current scope with GPTZero, caching per speaker so toggling is free.
  useEffect(() => {
    const key = `${transcript.text.length}:${selected ?? "all"}`;
    const cached = cache.current.get(key);
    if (cached) {
      setReport(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);

    // Reuse an identical request already in flight (React re-runs effects in dev).
    let pending = inflight.current.get(key);
    if (!pending) {
      pending = (async () => {
        const response = await fetch("/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, speakerId: selected }),
        });
        const data = (await response.json()) as AiReport & { error?: string };
        if (!response.ok) throw new Error(data.error ?? `Scoring failed (${response.status}).`);
        cache.current.set(key, data);
        return data;
      })();
      inflight.current.set(key, pending);
      void pending.catch(() => {}).finally(() => inflight.current.delete(key));
    }

    pending
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transcript, selected]);

  const shown = filterTranscriptBySpeaker(transcript, selected);
  const shownStats = selected ? transcriptStats(shown) : stats;
  const wordsPerMinute = Math.round(
    shownStats.words / Math.max(shownStats.duration / 60, 0.01),
  );
  const selectedIndex = speakers.findIndex((speaker) => speaker.id === selected);
  const scopeLabel = selected ? `Speaker ${selectedIndex + 1}` : "All speakers";

  const events = audioEvents(transcript);
  const confidence =
    typeof transcript.language_probability === "number"
      ? `${Math.round(transcript.language_probability * 100)}%`
      : "–";

  const figures: Array<[string, string]> = [
    ["Words", shownStats.words.toLocaleString()],
    ["Duration", formatDuration(shownStats.duration)],
    ["Language", shownStats.language.toUpperCase()],
    ["Confidence", confidence],
    ["WPM", wordsPerMinute.toLocaleString()],
  ];

  return (
    <div data-testid="analytics-panel" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Transcript
          </p>
          <h2 className="mt-1 truncate text-[17px] font-semibold leading-tight tracking-tight">
            {video?.title ?? "Untitled video"}
          </h2>
          {video?.channel ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{video.channel}</p>
          ) : null}
        </div>
        {sessionId ? (
          <a
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={`https://www.browserbase.com/sessions/${sessionId}`}
            target="_blank"
            rel="noreferrer"
          >
            Browser session ↗
          </a>
        ) : null}
      </div>

      {video?.videoId ? (
        <motion.div
          layout
          className="mx-auto aspect-video max-h-[46vh] w-full max-w-[680px] overflow-hidden rounded-2xl border border-border bg-black"
        >
          <iframe
            className="size-full"
            src={`https://www.youtube.com/embed/${video.videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </motion.div>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/60 sm:grid-cols-5">
        {figures.map(([label, value]) => (
          <div key={label} className="bg-card/70 px-4 py-3 backdrop-blur-xl">
            <dd className="text-[19px] font-semibold tabular-nums tracking-tight">{value}</dd>
            <dt className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
          </div>
        ))}
      </dl>

      <AudioEventsStrip events={events} />

      <SpeakerPicker
        speakers={speakers}
        selected={selected}
        primary={primarySpeaker}
        reason={primarySpeakerReason}
        onSelect={setSelected}
      />

      <AiMeter report={report} loading={loading} error={error} scopedLabel={scopeLabel} />

      <EntityPanel transcript={transcript} entities={transcript.entities} />

      <div className="glass flex max-h-[52vh] min-h-[220px] flex-col overflow-hidden rounded-2xl border border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {selected ? "Speaker transcript" : "Full transcript"}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {shownStats.words.toLocaleString()} words
          </span>
        </div>
        <TranscriptView transcript={shown} scores={report?.sentences} />
      </div>

      <div className="glass rounded-2xl border border-border/70 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Coming next
        </p>
        <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
          <li>
            <span className="text-foreground">Claim check</span>: unsupported and hallucinated claims
          </li>
          <li>
            <span className="text-foreground">Archive</span>: Elastic search across past speeches
          </li>
        </ul>
      </div>
    </div>
  );
}
