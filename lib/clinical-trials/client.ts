import { z } from "zod";
import { TRIAL_SEARCH_QUERY } from "./search.ts";

const pageSchema = z.object({
  studies: z.array(z.unknown()),
  nextPageToken: z.string().min(1).optional(),
  totalCount: z.number().int().nonnegative().optional(),
});

export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchStudiesPage(
  pageToken?: string,
  { fetchImpl = fetch, sleep = pause }: {
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
  } = {},
) {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.cond", TRIAL_SEARCH_QUERY);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("sort", "LastUpdatePostDate:desc");
  url.searchParams.set("countTotal", "true");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    } catch {
      if (attempt === 3) throw new Error("ClinicalTrials.gov could not be reached after 4 attempts.");
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return pageSchema.parse(await response.json());
    if ((response.status !== 429 && response.status < 500) || attempt === 3) {
      throw new Error(`ClinicalTrials.gov request failed (HTTP ${response.status}).`);
    }
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : retryAfter ? Date.parse(retryAfter) - Date.now() : 1000 * 2 ** attempt;
    await response.body?.cancel();
    await sleep(Math.min(30_000, Math.max(1000, Number.isFinite(delay) ? delay : 1000)));
  }
  throw new Error("ClinicalTrials.gov request failed.");
}
