import { fetchStudiesPage, pause } from "./client.ts";
import { normalizeStudy, type Trial } from "./normalize.ts";
import { TRIAL_SEARCH_TERMS } from "./search.ts";

export async function ingestTrials({
  writeBatch,
  maxPages,
  fetchPage = fetchStudiesPage,
  sleep = pause,
  onProgress = () => {},
}: {
  writeBatch: (trials: Trial[]) => Promise<void>;
  maxPages?: number;
  fetchPage?: typeof fetchStudiesPage;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (progress: { pages: number; uniqueStudies: number; totalCount?: number }) => void;
}) {
  if (maxPages !== undefined && (!Number.isSafeInteger(maxPages) || maxPages < 1)) {
    throw new Error("maxPages must be a positive integer.");
  }
  let token: string | undefined;
  let pages = 0;
  const seenTokens = new Set<string>();
  const seenIds = new Set<string>();
  const ingestedAt = new Date().toISOString();

  do {
    const page = await fetchPage(token);
    // Validate the entire page before committing it. Fail loudly on malformed data.
    const batch = [...new Map(page.studies.map((study) => {
      const row = normalizeStudy(study, TRIAL_SEARCH_TERMS, ingestedAt);
      return [row.nct_id, row] as const;
    })).values()];
    if (batch.length) await writeBatch(batch);
    batch.forEach((row) => seenIds.add(row.nct_id));
    pages++;
    onProgress({ pages, uniqueStudies: seenIds.size, totalCount: page.totalCount });
    token = page.nextPageToken;
    if (token) {
      if (seenTokens.has(token)) throw new Error("ClinicalTrials.gov returned a repeated page token; import stopped.");
      seenTokens.add(token);
    }
    if (maxPages !== undefined && pages >= maxPages) break;
    if (token) await sleep(300);
  } while (token);

  return { pages, uniqueStudies: seenIds.size, complete: !token };
}
