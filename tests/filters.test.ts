import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { parseTrialFilters, parseTrialPage, trialsHref, trialFiltersToRpc, hasTrialFilters } from "../lib/clinical-trials/filters.ts";

test("filter URLs preserve countries and special characters across pagination", () => {
  const filters = parseTrialFilters({
    status: "recruiting", phase: "phase2", study_type: "interventional",
    intervention_type: "drug", sponsor: " Smith & Co + 100% ",
    country: ["United Kingdom", "Côte d'Ivoire", "United Kingdom", ""], page: "7",
  });
  const url = new URL(trialsHref(filters, 2), "https://example.test");
  assert.deepEqual(url.searchParams.getAll("country"), ["Côte d'Ivoire", "United Kingdom"]);
  assert.equal(url.searchParams.get("sponsor"), "Smith & Co + 100%");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(new URL(trialsHref(filters), url).searchParams.has("page"), false);
  const params: Record<string, string | string[]> = Object.fromEntries(url.searchParams);
  params.country = url.searchParams.getAll("country");
  assert.deepEqual(parseTrialFilters(params), filters);
  assert.equal(hasTrialFilters(filters), true);
  assert.equal(trialFiltersToRpc(filters).p_study_type, "interventional");
});

test("empty or malformed filters default safely without turning text into query syntax", () => {
  assert.equal(trialsHref(parseTrialFilters({})), "/trials");
  assert.equal(hasTrialFilters(parseTrialFilters({})), false);
  assert.deepEqual(trialFiltersToRpc(parseTrialFilters({})), {
    p_status: null, p_phase: null, p_study_type: null, p_intervention_type: null, p_sponsor: null, p_countries: [],
  });
  const result = parseTrialFilters({ status: ["recruiting", "completed"], phase: "x),status.eq.completed", country: "France" });
  assert.equal(result.status, "");
  assert.equal(result.phase, "");
  assert.deepEqual(result.countries, ["France"]);
  for (const page of ["0", "-1", "1.2", "Infinity", "1e2", "10001", ["1", "2"]]) {
    assert.equal(parseTrialPage({ page }), 1);
  }
  assert.equal(parseTrialPage({ page: "3" }), 3);
});

test("database migration filters all rows, combines criteria, and respects public permissions", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609130001_create_trials.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609130002_trial_filters.sql", import.meta.url), "utf8"));
  const fixtures = [
    { id: "NCT00000001", status: "recruiting", phases: ["phase1", "phase2"], type: "interventional", sponsor: "University Alpha", interventions: [{ type: "drug" }], locations: [{ country: "United Kingdom" }, { country: "France" }, { country: "France" }] },
    { id: "NCT00000002", status: "completed", phases: ["na"], type: "observational", sponsor: "100% Research", interventions: [{ type: "behavioral" }], locations: [{ country: "France" }] },
    { id: "NCT00000003", status: null, phases: [], type: null, sponsor: null, interventions: [], locations: [] },
    { id: "NCT00000004", status: "recruiting", phases: ["phase3"], type: "interventional", sponsor: "University Beta", interventions: [{ type: "drug" }], locations: [{ country: "Côte d'Ivoire" }, { country: null }] },
  ];
  for (const f of fixtures) {
    await db.query(`insert into public.trials
      (nct_id,title,status,phases,study_type,sponsor_name,interventions,locations,source_url,search_terms,ingested_at)
      values ($1,'Test',$2,$3,$4,$5,$6,$7,'https://clinicaltrials.gov', '{}', now())`,
    [f.id, f.status, f.phases, f.type, f.sponsor, JSON.stringify(f.interventions), JSON.stringify(f.locations)]);
  }
  await db.exec("set role anon");
  const ids = async (args: unknown[] = [null, null, null, null, null, []]) => {
    const result = await db.query<{ nct_id: string }>("select nct_id from public.filter_trials($1,$2,$3,$4,$5,$6) order by nct_id", args);
    return result.rows.map((row) => row.nct_id);
  };
  assert.equal((await ids()).length, 4);
  // Any country, with no duplicate trial when multiple sites/countries match.
  assert.deepEqual(await ids([null, null, null, null, null, ["United Kingdom", "France"]]), ["NCT00000001", "NCT00000002"]);
  assert.deepEqual(await ids(["recruiting", "phase2", "interventional", "drug", "ALPHA", ["France"]]), ["NCT00000001"]);
  assert.deepEqual(await ids(["completed", "phase2", null, null, null, []]), []);
  assert.deepEqual(await ids([null, "na", null, null, null, []]), ["NCT00000002"]);
  assert.deepEqual(await ids([null, null, null, "behavioral", null, []]), ["NCT00000002"]);
  assert.deepEqual(await ids([null, null, null, null, "%", []]), ["NCT00000002"]);
  assert.deepEqual(await ids([null, null, null, null, "' OR true --", []]), []);
  assert.deepEqual(await ids([null, null, null, null, null, ["Côte d'Ivoire"]]), ["NCT00000004"]);
  assert.deepEqual(await ids([null, null, null, null, null, ["Atlantis"]]), []);
  const page = await db.query<{ nct_id: string }>("select nct_id from public.filter_trials(p_status => 'recruiting') order by nct_id limit 1 offset 1");
  assert.equal(page.rows[0].nct_id, "NCT00000004");
  const counts = await db.query<{ total: number }>("select count(*)::int total from public.filter_trials(p_status => 'recruiting')");
  assert.equal(counts.rows[0].total, 2);
  const options = await db.query<{ options: { countries: string[]; phases: string[] } }>("select public.trial_filter_options() options");
  assert.deepEqual(options.rows[0].options.countries, ["Côte d'Ivoire", "France", "United Kingdom"]);
  assert.deepEqual(options.rows[0].options.phases, ["na", "phase1", "phase2", "phase3"]);
  await assert.rejects(db.exec("delete from public.trials"), /permission denied/);
  // Removing the read policy must also remove data exposed through both functions.
  await db.exec('reset role; drop policy "Public can read trial listings" on public.trials; set role anon;');
  assert.deepEqual(await ids(), []);
  const hidden = await db.query<{ options: { countries: string[] } }>("select public.trial_filter_options() options");
  assert.deepEqual(hidden.rows[0].options.countries, []);
});
