import "server-only";
import { createClient } from "@supabase/supabase-js";
import { trialSchema, type Trial } from "@/lib/clinical-trials/normalize";

export const TRIALS_PER_PAGE = 20;

type TrialPage =
  | { state: "ready"; trials: Trial[]; total: number }
  | { state: "unconfigured" | "error" };

export async function getTrials(page: number): Promise<TrialPage> {
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
    const { data, count, error } = await supabase
      .from("trials")
      .select("*", { count: "exact" })
      .order("source_updated_date", { ascending: false, nullsFirst: false })
      .order("nct_id", { ascending: true })
      .range(from, from + TRIALS_PER_PAGE - 1);
    if (error) {
      console.error(`Trial read failed (${error.code}). Check Supabase configuration and migration.`);
      return { state: "error" };
    }
    return { state: "ready", trials: trialSchema.array().parse(data), total: count ?? 0 };
  } catch {
    console.error("Trial read failed: connection, configuration, or stored-data validation error.");
    return { state: "error" };
  }
}
