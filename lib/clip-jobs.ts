import { MAX_CLIP_JOBS } from "./constants";

export { MAX_CLIP_JOBS };

let inFlight = 0;

export function clipJobsInFlight(): number {
  return inFlight;
}

export function tryAcquireClipJob(): boolean {
  if (inFlight >= MAX_CLIP_JOBS) return false;
  inFlight += 1;
  return true;
}

export function releaseClipJob() {
  inFlight = Math.max(0, inFlight - 1);
}
