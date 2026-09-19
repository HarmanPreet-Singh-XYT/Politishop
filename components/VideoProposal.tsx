"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { VideoProposal as VideoProposalType } from "@/lib/types";

export function VideoProposal({
  video,
  onConfirm,
  onReject,
  disabled,
}: {
  video: VideoProposalType;
  onConfirm: () => void;
  onReject: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      data-testid="video-proposal"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-2xl backdrop-blur-xl"
    >
      {video.thumbnail ? (
        <img
          src={video.thumbnail}
          alt=""
          className="aspect-video w-full border-b border-border object-cover"
        />
      ) : null}

      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-[14px] font-medium leading-snug text-foreground">
          {video.title}
        </h3>
        {video.channel ? (
          <p className="text-xs text-muted-foreground">{video.channel}</p>
        ) : null}
        <p className="border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
          {video.reason}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <Button size="sm" onClick={onConfirm} disabled={disabled}>
            Create project
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject} disabled={disabled}>
            Find another
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
