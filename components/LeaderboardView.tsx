"use client";

import { RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import type { LeaderboardSource, LeaderboardSpeech } from "@/lib/reports";

type Payload = { sources: LeaderboardSource[]; recent: LeaderboardSpeech[] };

function percent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

/** Same bands as the AI-o-meter, so the board reads consistently with the panels. */
function tone(probability: number | null) {
  if (probability === null) return { text: "text-muted-foreground", bar: "bg-muted-foreground/40" };
  if (probability >= 0.8) return { text: "text-red-300", bar: "bg-red-400" };
  if (probability >= 0.5) return { text: "text-amber-300", bar: "bg-amber-400" };
  return { text: "text-emerald-300", bar: "bg-emerald-400" };
}

export function LeaderboardView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load the leaderboard (${response.status}).`);
      setData((await response.json()) as Payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setData({ sources: [], recent: [] });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="scroll-quiet h-full overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">Leaderboard</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Average AI-likelihood per source, across every speech scored.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">
            {error}
          </p>
        ) : null}

        {data === null ? (
          <div className="flex justify-center py-16">
            <Loader variant="dots" />
          </div>
        ) : data.sources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Trophy className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Nothing scored yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Open a speech — in Projects, the Library, or a chat result — and its reading lands
              here, ranked.
            </p>
          </div>
        ) : (
          <>
            <ol className="flex flex-col gap-2">
              {data.sources.map((row, index) => {
                const score = tone(row.avgAi);
                return (
                  <li
                    key={row.source}
                    className="glass flex items-center gap-4 rounded-2xl border border-border/70 px-4 py-3"
                  >
                    <span className="w-6 shrink-0 text-center text-[13px] font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13.5px] font-medium">{row.source}</span>
                        <span className={cn("shrink-0 text-[15px] font-semibold tabular-nums", score.text)}>
                          {percent(row.avgAi)}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", score.bar)}
                          style={{ width: `${Math.round(row.avgAi * 100)}%` }}
                        />
                      </span>
                      <span className="mt-1.5 block text-[11px] text-muted-foreground">
                        {row.speeches} {row.speeches === 1 ? "speech" : "speeches"} ·{" "}
                        {row.flagged} sentences flagged · {row.words.toLocaleString()} words
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Most AI-like speeches
              </p>
              <ul className="flex flex-col gap-1">
                {data.recent.map((speech) => (
                  <SpeechRow key={speech.id} speech={speech} />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SpeechRow({ speech }: { speech: LeaderboardSpeech }) {
  const score = tone(speech.aiProbability);
  const label = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{speech.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {speech.source} · {speech.flaggedCount} flagged · {speech.wordCount.toLocaleString()} words
        </span>
      </span>
      <span className={cn("shrink-0 text-[13px] font-semibold tabular-nums", score.text)}>
        {percent(speech.aiProbability)}
      </span>
    </>
  );

  const className =
    "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/70 hover:bg-card/50";

  return (
    <li>
      {speech.videoId ? (
        <a
          className={className}
          href={`https://www.youtube.com/watch?v=${speech.videoId}`}
          target="_blank"
          rel="noreferrer"
        >
          {label}
        </a>
      ) : (
        <div className={className}>{label}</div>
      )}
    </li>
  );
}
