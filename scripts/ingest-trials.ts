import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import { ingestTrials } from "../lib/clinical-trials/ingest.ts";
import { TRIAL_SEARCH_QUERY } from "../lib/clinical-trials/search.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "max-pages": { type: "string" },
    },
    strict: true,
  });
  const maxPages = values["max-pages"] === undefined ? undefined : Number(values["max-pages"]);
  const dryRun = values["dry-run"];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!dryRun && (!url || !key)) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local before importing. See README.md.");
  }
  const supabase = dryRun ? null : createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }) },
  });
  console.log(`${dryRun ? "DRY RUN (no database writes)" : "Importing"}: ${TRIAL_SEARCH_QUERY}`);
  let shownSample = false;
  const result = await ingestTrials({
    maxPages,
    writeBatch: async (trials) => {
      if (!supabase) {
        if (!shownSample) {
          const row = trials[0];
          console.log("Normalised sample:", JSON.stringify({
            nct_id: row.nct_id, title: row.title, status: row.status,
            phases: row.phases, sponsor_name: row.sponsor_name,
            interventions: row.interventions, location_count: row.locations.length,
          }, null, 2));
          shownSample = true;
        }
        return;
      }
      const { error } = await supabase.from("trials").upsert(trials, { onConflict: "nct_id" });
      if (error) throw new Error(`Supabase write failed (${error.code ?? "unknown"}). Check the migration, URL, and secret key.`);
    },
    onProgress: ({ pages, uniqueStudies, totalCount }) => {
      console.log(`Page ${pages}: ${uniqueStudies} unique studies ${dryRun ? "validated" : "stored"}${totalCount === undefined ? "" : `; source reports ${totalCount} matches`}.`);
    },
  });
  console.log(`${result.complete ? "Complete" : "PARTIAL: page limit reached; more studies remain"}. ${result.uniqueStudies} unique studies across ${result.pages} pages.`);
}

main().catch((error: unknown) => {
  // Never print credential-bearing request objects or response headers.
  console.error(error instanceof Error ? error.message : "Ingestion failed.");
  console.error("Import stopped. For database imports, earlier successful batches remain saved. Rerun to retry; dry runs never save data.");
  process.exitCode = 1;
});
