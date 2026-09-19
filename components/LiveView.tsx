"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LiveCallout } from "@/components/LiveCallout";
import { LiveCapturePanel } from "@/components/LiveCapturePanel";
import { LiveTranscriptPanel } from "@/components/LiveTranscriptPanel";
import { DEFAULT_PREFS, type LivePrefs } from "@/components/LiveSettingsDialog";
import type { PersonaState } from "@/components/ai-elements/persona";
import { useDetector } from "@/lib/useDetector";
import { useCamera, useDevices } from "@/lib/useDevices";
import { DEFAULT_VOICE_ID } from "@/lib/voices";
import { cn } from "@/lib/utils";

type MobilePane = "capture" | "analysis";

/** Keep the subtitle to the last few words so it reads as one caption, not a paragraph. */
function tailWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length <= count) return words.join(" ");
  return `… ${words.slice(-count).join(" ")}`;
}

export function LiveView() {
  const [videoOn, setVideoOn] = useState(false);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  // Phones have no room for both panes at once, so one fills the screen and
  // the switch swaps them. Desktop ignores this and shows both side by side.
  const [pane, setPane] = useState<MobilePane>("capture");
  const [prefs, setPrefs] = useState<LivePrefs>(DEFAULT_PREFS);
  const devices = useDevices();
  const detector = useDetector(voiceId, prefs.voice);
  const camera = useCamera(videoOn, devices.cameraId);

  // The camera rides with the session: it comes up on the same click that
  // starts recording and goes down when recording stops. Both getUserMedia
  // calls happen inside this click so they are gesture-backed.
  const toggle = async () => {
    if (detector.running) {
      setVideoOn(false);
      await detector.stop();
      return;
    }
    setVideoOn(true);
    await Promise.allSettled([
      camera.open(),
      detector.start(devices.micId || undefined),
    ]);
    // Labels only become readable after permission is granted once.
    void devices.refresh();
  };

  const toggleCamera = () => {
    if (videoOn) {
      setVideoOn(false);
      return;
    }
    setVideoOn(true);
    // Gesture-backed open, so a browser that refuses effect-driven camera
    // access still lets the user turn it on by hand.
    void camera.open();
  };

  // Subtitle text: the words not yet scored, or the tail of the last scored
  // chunk so the caption stays on screen between checks (like live captions).
  const live = `${detector.pendingText} ${detector.partial}`.trim();
  const lastDetection = detector.detections[detector.detections.length - 1];
  const caption = live
    ? tailWords(live, 28)
    : lastDetection
      ? tailWords(lastDetection.text, 28)
      : "";

  // Map the session onto the orb: red while the roast voice talks, amber while
  // GPTZero scores, teal while listening, dim on error.
  const personaState: PersonaState = !detector.running
    ? "idle"
    : detector.speaking
      ? "speaking"
      : detector.scoring || detector.status === "connecting"
        ? "thinking"
        : detector.status === "error"
          ? "asleep"
          : "listening";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-center border-b border-border/60 px-3 py-2 md:hidden">
        <PaneSwitch value={pane} onChange={setPane} />
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-1 md:grid-cols-[minmax(380px,42%)_1fr]">
        <section
          className={cn(
            "min-h-0 min-w-0",
            pane !== "capture" && "hidden md:block",
            "border-border/60 md:border-r",
          )}
        >
          <LiveCapturePanel
            running={detector.running}
            speaking={detector.speaking}
            level={detector.level}
            videoOn={videoOn}
            onCameraToggle={toggleCamera}
            camera={camera}
            mics={devices.mics}
            cameras={devices.cameras}
            micId={devices.micId}
            cameraId={devices.cameraId}
            onMicChange={devices.setMicId}
            onCameraChange={devices.setCameraId}
            voiceId={voiceId}
            onVoiceChange={setVoiceId}
            onToggle={toggle}
            onPreviewVoice={() => void detector.previewVoice()}
            caption={prefs.captions ? caption : ""}
            prefs={prefs}
            onPrefsChange={setPrefs}
            personaState={personaState}
          />
        </section>

        <section
          className={cn("min-h-0 min-w-0", pane !== "analysis" && "hidden md:block")}
        >
          <LiveTranscriptPanel
            detections={detector.detections}
            pendingText={detector.pendingText}
            partial={detector.partial}
            pendingWords={detector.pendingWords}
            scoring={detector.scoring}
            running={detector.running}
            speaking={detector.speaking}
            status={detector.status}
            wordsSent={detector.wordsSent}
          />
        </section>
      </div>

      <LiveCallout callout={detector.callout} speaking={detector.speaking} />

      <AnimatePresence>
        {detector.error && (
          <motion.p
            role="alert"
            className="glass-strong fixed inset-x-4 top-16 z-50 mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-[13px] text-warning"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
          >
            {detector.error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaneSwitch({
  value,
  onChange,
}: {
  value: MobilePane;
  onChange: (pane: MobilePane) => void;
}) {
  const options: Array<{ id: MobilePane; label: string }> = [
    { id: "capture", label: "Camera" },
    { id: "analysis", label: "Analysis" },
  ];

  return (
    <div className="inline-flex rounded-full border border-border/70 bg-card/50 p-0.5">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
