"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProjectRecord } from "@/lib/projects";
import { ScoreTable } from "./ScoreTable";

const EXAMPLES = ["starmer", "trump", "speech"] as const;

export function InvestigateArchive({ results }: { results: ProjectRecord[] }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const total = results.length;
    const scored = results.filter((r) => r.aiProbability !== null);
    const ai = scored.filter((r) => (r.aiProbability ?? 0) >= 0.5).length;
    const words = results.reduce((n, r) => n + r.stats.words, 0);
    return { total, scored: scored.length, ai, words };
  }, [results]);

  const applySearch = (next = draft) => {
    setQuery(next);
    document.getElementById("records")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main>
      <header className="relative isolate min-h-[560px] overflow-hidden text-white sm:min-h-[600px]">
        <Image
          src="/investigate/hero.jpg"
          alt="Lowell Lecture Hall, a stone building with tall arched windows"
          fill
          priority
          className="investigate-hero-photo object-cover object-[center_38%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,7,.9)_0%,rgba(8,9,7,.7)_48%,rgba(8,9,7,.3)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
        <div className="investigate-grain absolute inset-0" />

        <Link
          href="/"
          className="absolute left-5 top-4 z-20 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/75 transition-colors hover:text-white sm:left-8 sm:top-6"
        >
          ← Back to app
        </Link>

        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-6xl flex-col px-5 sm:min-h-[600px] sm:px-8">
          <div className="flex flex-1 flex-col justify-center py-10 sm:py-12">
            <p className="investigate-stamp text-[11px] text-white/65">Detection archive</p>
            <h1 className="investigate-title mt-4 max-w-[8ch] text-6xl">Speech Trail</h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/75 sm:text-[18px]">
              When AI-written text is read aloud, it can be hard to spot by ear. Every speech you
              analyze is filed here — the AI reading, the source, and the sentence-level evidence —
              so one search shows the full result.
            </p>

            <form
              className="mt-8 w-full max-w-3xl"
              onSubmit={(event) => {
                event.preventDefault();
                applySearch();
              }}
            >
              <div className="grid gap-px bg-white/25 p-px shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:grid-cols-[1fr_auto]">
                <label>
                  <span className="sr-only">Search documents</span>
                  <input
                    name="q"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Search transcripts, titles, or channels"
                    className="investigate-field h-14 w-full px-4 text-[15px]"
                  />
                </label>
                <button
                  type="submit"
                  className="flex h-14 items-center justify-center gap-2 bg-[var(--blood)] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--blood-press)] active:bg-[var(--blood-press)]"
                >
                  <SearchIcon />
                  Search
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-white/55">
                Try{" "}
                {EXAMPLES.map((ex, i) => (
                  <span key={ex}>
                    {i > 0 && ", "}
                    <button
                      type="button"
                      className="border-b border-white/30 text-white/75 hover:border-white hover:text-white"
                      onClick={() => {
                        setDraft(ex);
                        applySearch(ex);
                      }}
                    >
                      {ex}
                    </button>
                  </span>
                ))}
              </p>
            </form>

            <dl className="mt-8 flex w-full max-w-xl flex-wrap gap-x-10 gap-y-4 border-t border-white/25 pt-5">
              <Stat label="Speeches" value={stats.total} />
              <Stat label="Scored" value={stats.scored} />
              <Stat label="Read as AI" value={stats.ai} />
              <Stat label="Words" value={stats.words} />
            </dl>
          </div>

          <p className="absolute bottom-4 right-5 text-[10px] text-white/35 sm:right-8">
            Lowell Lecture Hall, Harvard · Daderot
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div id="records" className="scroll-mt-8">
          <h2 className="investigate-punch text-[clamp(2.2rem,5vw,3.4rem)]">The records</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--muted-ink)]">
            Select a record to inspect its transcript and AI reading.
          </p>
          <div className="mt-8">
            <ScoreTable data={results} query={query} />
          </div>
        </div>

        <div className="grid gap-4 py-14">
          <div>
            <h2 className="investigate-punch mt-3 text-4xl">About the project</h2>
          </div>
          <div>
            <div className="space-y-4 text-[16px] leading-7 text-[var(--muted-ink)]">
              <p>
                Every row is a speech you analyzed — the audio was pulled, transcribed, and the
                words sent to GPTZero. The reading, source, and transcript are filed here.
              </p>
              <p>
                Live microphone detection is never stored. The archive only keeps the source,
                transcript, and analysis.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="investigate-stamp text-[10px] text-white/55">{label}</dt>
      <dd className="mt-1 text-[30px] font-medium tracking-[-0.035em] tabular-nums text-white">
        {value}
      </dd>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 fill-none stroke-current"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" />
    </svg>
  );
}
