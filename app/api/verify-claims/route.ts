import { CLAIM_TYPES, type ClaimType } from "@/lib/claims";
import { saveVerifications } from "@/lib/claims-store";
import { env } from "@/lib/env";
import { verifyClaims } from "@/lib/verification";

export const runtime = "nodejs";
export const maxDuration = 60;

function isClaimType(value: unknown): value is ClaimType {
  return typeof value === "string" && (CLAIM_TYPES as readonly string[]).includes(value);
}

/**
 * Match already-extracted claims against existing human fact-checks, and look up official
 * figures for economic statistics. Only checkable claims should be sent; the caller decides
 * which ones those are. Pass `claimSetId` to persist the matches so they survive a reload.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    claims?: unknown;
    claimSetId?: unknown;
  } | null;

  const claims = Array.isArray(body?.claims)
    ? body.claims
        .filter(
          (claim): claim is { id: string; text: string; type?: unknown } =>
            Boolean(claim) &&
            typeof (claim as { id?: unknown }).id === "string" &&
            typeof (claim as { text?: unknown }).text === "string",
        )
        .map((claim) => ({
          id: claim.id,
          text: claim.text,
          // An unrecognised type never triggers the economic lookup.
          type: isClaimType(claim.type) ? claim.type : ("value" as ClaimType),
        }))
    : [];

  if (claims.length === 0) {
    return Response.json({ error: "No claims supplied." }, { status: 400 });
  }

  if (!env.hasFactCheck()) {
    return Response.json(
      { error: "GOOGLE_FACTCHECK_API_KEY is not set, so claims cannot be matched yet." },
      { status: 503 },
    );
  }

  try {
    const report = await verifyClaims(claims);
    if (typeof body?.claimSetId === "string") {
      await saveVerifications(body.claimSetId, report.results);
    }
    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Claim matching failed." },
      { status: 502 },
    );
  }
}
