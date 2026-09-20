import { createHash } from "node:crypto";
import { extractClaims, type ClaimReport } from "./claims";
import { jsonb, query } from "./db";
import type { ClaimVerification } from "./verification";

/**
 * Claims are expensive (a model call) and so is matching them (external lookups), so a
 * transcript's claim sheet is cached in Postgres. The key is a hash of the scoped text, so
 * the same speech seen again — from a project, the library, or a re-open — is free.
 */

export interface StoredClaimSet extends ClaimReport {
  id: string;
  /** claimId -> verification result, so matches survive a reload. */
  verifications: Record<string, ClaimVerification>;
  /** claimId -> a human's ruling on the automated result. */
  reviews: Record<string, ClaimReview>;
  cached: boolean;
}

export type ReviewVerdict = "confirmed" | "rejected" | "flagged";

export interface ClaimReview {
  verdict: ReviewVerdict;
  at: string;
}

type ClaimSetRow = {
  id: string;
  speaker_id: string | null;
  scorable: boolean;
  reason: string | null;
  word_count: number;
  checkable_count: number;
  claims: ClaimReport["claims"];
  verifications: Record<string, ClaimVerification>;
  reviews: Record<string, ClaimReview>;
};

/** Claim-set ids are truncated sha256 digests. */
export const CLAIM_SET_ID = /^[a-f0-9]{32}$/;

export function claimSetId(transcriptText: string, speakerId: string | null): string {
  return createHash("sha256")
    .update(`${speakerId ?? "all"}:${transcriptText}`)
    .digest("hex")
    .slice(0, 32);
}

async function getStored(id: string): Promise<StoredClaimSet | null> {
  const { rows } = await query<ClaimSetRow>(`SELECT * FROM claim_sets WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    scopedTo: row.speaker_id,
    scorable: row.scorable,
    reason: row.reason ?? undefined,
    wordCount: row.word_count,
    checkableCount: row.checkable_count,
    claims: row.claims ?? [],
    verifications: row.verifications ?? {},
    reviews: row.reviews ?? {},
    cached: true,
  };
}

export async function getOrExtractClaims(
  transcript: Parameters<typeof extractClaims>[0],
  speakerId: string | null,
  force = false,
): Promise<StoredClaimSet> {
  const id = claimSetId(transcript.text, speakerId);

  if (!force) {
    const existing = await getStored(id);
    if (existing) return existing;
  }

  const report = await extractClaims(transcript, speakerId);

  await query(
    `INSERT INTO claim_sets (
       id, speaker_id, scorable, reason, word_count, checkable_count, claims
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       speaker_id      = EXCLUDED.speaker_id,
       scorable        = EXCLUDED.scorable,
       reason          = EXCLUDED.reason,
       word_count      = EXCLUDED.word_count,
       checkable_count = EXCLUDED.checkable_count,
       claims          = EXCLUDED.claims,
       updated_at      = now()`,
    [
      id,
      speakerId,
      report.scorable,
      report.reason ?? null,
      report.wordCount,
      report.checkableCount,
      jsonb(report.claims),
    ],
  );

  return { ...report, id, verifications: {}, reviews: {}, cached: false };
}

/** Merge a batch of verification results into the stored sheet, keyed by claim id. */
export async function saveVerifications(
  id: string,
  results: ClaimVerification[],
): Promise<void> {
  if (results.length === 0) return;
  const patch = Object.fromEntries(results.map((result) => [result.id, result]));
  await query(
    `UPDATE claim_sets
        SET verifications = verifications || $2::jsonb,
            updated_at    = now()
      WHERE id = $1`,
    [id, jsonb(patch)],
  );
}

/**
 * Record (or clear) a human's ruling on one claim's automated result. Passing null clears it,
 * which is how a reviewer undoes a decision.
 */
export async function saveReview(
  id: string,
  claimId: string,
  verdict: ReviewVerdict | null,
): Promise<boolean> {
  if (verdict === null) {
    const { rowCount } = await query(
      `UPDATE claim_sets
          SET reviews = reviews - $2::text,
              updated_at = now()
        WHERE id = $1`,
      [id, claimId],
    );
    return (rowCount ?? 0) > 0;
  }

  const review: ClaimReview = { verdict, at: new Date().toISOString() };
  const { rowCount } = await query(
    `UPDATE claim_sets
        SET reviews = reviews || $2::jsonb,
            updated_at = now()
      WHERE id = $1`,
    [id, jsonb({ [claimId]: review })],
  );
  return (rowCount ?? 0) > 0;
}
