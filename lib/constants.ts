/** Sentence-level AI threshold recommended in GPT_ZERO_FINDINGS.md §12. */
export const SENTENCE_AI_THRESHOLD = 0.65;

/** Below this → treat sentence as human-leaning for highlight bands. */
export const SENTENCE_HUMAN_MAX = 0.35;

/**
 * When false, live chunks are still scored but ElevenLabs does not roast or
 * praise out loud. Flip off if the voice feedback needs tuning again.
 */
export const VOICE_FEEDBACK = true;
