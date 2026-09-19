"use client";

import { Radio } from "lucide-react";

const STEPS: Array<[string, string]> = [
  ["Record", "Capture the speech as it happens."],
  ["Transcribe live", "Stream audio to speech-to-text while it plays."],
  ["Check live", "Score each passage for AI-written text and unsupported claims."],
  ["Alert", "Raise a flag the moment something suspicious appears."],
];

export function LiveView() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground">
          <Radio className="size-5" />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold tracking-tight">Live capture</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          A dedicated place to record a speech in progress and check it in real time. Not wired up
          yet. It reuses the same pipeline as Existing Content, just fed by a live stream instead of
          a YouTube link.
        </p>

        <ol className="mt-6 flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border text-left">
          {STEPS.map(([title, detail], index) => (
            <li key={title} className="flex items-start gap-3 bg-card px-4 py-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] font-medium tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span>
                <span className="block text-xs font-medium text-foreground">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
