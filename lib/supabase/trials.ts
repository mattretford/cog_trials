import "server-only";
import { z } from "zod";
import { trialFiltersToRpc, type TrialFilters, type TrialFilterOptions } from "@/lib/clinical-trials/filters";
import { createClient } from "@supabase/supabase-js";
import { trialSchema, type Trial } from "@/lib/clinical-trials/normalize";

export const TRIALS_PER_PAGE = 20;

const optionsSchema = z.object({
  statuses: z.array(z.string()), phases: z.array(z.string()),
  study_types: z.array(z.string()), intervention_types: z.array(z.string()),
  countries: z.array(z.string()),
});

type TrialPage =
  | { state: "ready"; trials: Trial[]; total: number; options: TrialFilterOptions }
  | { state: "unconfigured" | "error" };

export async function getTrials(page: number, filters: TrialFilters): Promise<TrialPage> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { state: "unconfigured" };

  try {
    // Reads use the public, RLS-restricted key. The web app never needs the secret key.
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init, cache: "no-store", signal: AbortSignal.timeout(15_000),
        }),
      },
    });
    const from = (page - 1) * TRIALS_PER_PAGE;
    const [listing, choices] = await Promise.all([
      supabase.rpc("filter_trials", trialFiltersToRpc(filters), { count: "exact" })
        .select("*")
        .order("source_updated_date", { ascending: false, nullsFirst: false })
        .order("nct_id", { ascending: true })
        .range(from, from + TRIALS_PER_PAGE - 1),
      supabase.rpc("trial_filter_options"),
    ]);
    const { data, count } = listing;
    const error = listing.error ?? choices.error;
    if (error) {
      console.error(`Trial read failed (${error.code}). Check Supabase configuration and migration.`);
      return { state: "error" };
    }
    return { state: "ready", trials: trialSchema.array().parse(data), total: count ?? 0, options: optionsSchema.parse(choices.data) };
  } catch {
    console.error("Trial read failed: connection, configuration, or stored-data validation error.");
    return { state: "error" };
  }
}
