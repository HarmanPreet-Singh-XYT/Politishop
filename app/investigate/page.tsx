import { InvestigateArchive } from "@/components/investigate/InvestigateArchive";
import { listExcerpts } from "@/lib/excerpts";

export const dynamic = "force-dynamic";

export default async function InvestigatePage() {
  const results = await listExcerpts(1000);
  return <InvestigateArchive results={results} />;
}
