import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeStudy, trialSchema } from "../lib/clinical-trials/normalize.ts";
import { formatCode } from "../lib/clinical-trials/format.ts";
import { fetchStudiesPage } from "../lib/clinical-trials/client.ts";
import { ingestTrials } from "../lib/clinical-trials/ingest.ts";
import { TRIAL_SEARCH_QUERY, TRIAL_SEARCH_TERMS } from "../lib/clinical-trials/search.ts";

function study(nctId = "NCT00000001") {
  return { protocolSection: { identificationModule: { nctId, briefTitle: " Example study " } } };
}

const timestamp = "2026-09-13T12:00:00.000Z";
const noSleep = async () => {};

test("normalises nested source fields without retaining personal contacts", () => {
  const result = normalizeStudy({ protocolSection: {
    ...study().protocolSection,
    statusModule: { overallStatus: "ACTIVE_NOT_RECRUITING", lastUpdatePostDateStruct: { date: "2026-08" } },
    designModule: { studyType: "INTERVENTIONAL", phases: ["PHASE1", "PHASE2", "PHASE2"] },
    sponsorCollaboratorsModule: { leadSponsor: { name: " University ", class: "OTHER" }, collaborators: [{ name: "Partner", class: "INDUSTRY" }] },
    armsInterventionsModule: { interventions: [{ name: "Treatment", type: "DRUG" }, { name: "Training", type: "BEHAVIORAL" }] },
    contactsLocationsModule: { locations: [{ facility: "Hospital", city: "London", country: "United Kingdom", status: "RECRUITING", geoPoint: { lat: 51.5, lon: 0 }, contacts: [{ name: "Private contact", email: "person@example.test" }] }] },
  } }, TRIAL_SEARCH_TERMS, timestamp);
  assert.equal(result.title, "Example study");
  assert.equal(result.status, "active_not_recruiting");
  assert.deepEqual(result.phases, ["phase1", "phase2"]);
  assert.equal(result.sponsor_name, "University");
  assert.equal(result.collaborators[0].type, "industry");
  assert.equal(result.interventions[1].type, "behavioral");
  assert.equal(result.locations[0].longitude, 0);
  assert.equal(result.locations[0].status, "recruiting");
  assert.equal(result.source_updated_date, "2026-08");
  assert.equal(result.source_url, "https://clinicaltrials.gov/study/NCT00000001");
  assert.deepEqual(result.search_terms, TRIAL_SEARCH_TERMS);
  assert.equal(JSON.stringify(result).includes("person@example.test"), false);
  assert.equal(result.ingested_at, timestamp);
});

test("missing optional fields remain missing, while NA and unknown codes survive", () => {
  const missing = normalizeStudy(study(), [], timestamp);
  assert.deepEqual(missing.phases, []);
  assert.equal(missing.status, null);
  assert.equal(missing.sponsor_name, null);
  assert.deepEqual(missing.locations, []);
  const explicit = normalizeStudy({ protocolSection: {
    ...study().protocolSection,
    designModule: { phases: ["NA"] },
    statusModule: { overallStatus: "FUTURE_STATUS" },
  } }, [], timestamp);
  assert.deepEqual(explicit.phases, ["na"]);
  assert.equal(formatCode(explicit.phases[0]), "Not applicable");
  assert.equal(explicit.status, "future_status");
  assert.equal(formatCode(null), "Not reported");
  assert.doesNotThrow(() => trialSchema.parse({ ...missing, ingested_at: "2026-09-13T12:00:00+00:00" }));
});

test("rejects malformed identifiers and required titles", () => {
  assert.throws(() => normalizeStudy(study("bad-id"), [], timestamp));
  assert.throws(() => normalizeStudy({ protocolSection: { identificationModule: { nctId: "NCT00000001" } } }, [], timestamp));
});

test("uses condition OR query and opaque pagination token, retrying HTTP 429", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("query.cond"), TRIAL_SEARCH_QUERY);
    assert.equal(url.searchParams.get("pageToken"), "opaque+/= token");
    assert.equal(url.searchParams.get("pageSize"), "100");
    calls++;
    return calls === 1
      ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
      : Response.json({ studies: [study()], nextPageToken: "next", totalCount: 2 });
  };
  const result = await fetchStudiesPage("opaque+/= token", { fetchImpl, sleep: async (ms) => { delays.push(ms); } });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2000]);
  assert.equal(result.nextPageToken, "next");
});

test("retries transient failures but fails immediately on HTTP 400 and malformed responses", async () => {
  let calls = 0;
  await assert.rejects(fetchStudiesPage(undefined, {
    fetchImpl: async () => { calls++; return new Response(null, { status: 503 }); }, sleep: noSleep,
  }), /HTTP 503/);
  assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(fetchStudiesPage(undefined, {
    fetchImpl: async () => { calls++; return new Response(null, { status: 400 }); }, sleep: noSleep,
  }), /HTTP 400/);
  assert.equal(calls, 1);
  await assert.rejects(fetchStudiesPage(undefined, {
    fetchImpl: async () => Response.json({}), sleep: noSleep,
  }));
});

test("follows every page, deduplicates batches, and reports unique study count", async () => {
  const tokens: (string | undefined)[] = [];
  const saved: string[][] = [];
  const result = await ingestTrials({
    fetchPage: async (token) => {
      tokens.push(token);
      return token
        ? { studies: [study(), study("NCT00000002")] }
        : { studies: [study(), study()], nextPageToken: "page2" };
    },
    writeBatch: async (rows) => { saved.push(rows.map((row) => row.nct_id)); }, sleep: noSleep,
  });
  assert.deepEqual(tokens, [undefined, "page2"]);
  assert.deepEqual(saved, [["NCT00000001"], ["NCT00000001", "NCT00000002"]]);
  assert.deepEqual(result, { pages: 2, uniqueStudies: 2, complete: true });
});

test("page limit is explicitly partial and empty final pages finish normally", async () => {
  const partial = await ingestTrials({ maxPages: 1,
    fetchPage: async () => ({ studies: [study()], nextPageToken: "more" }), writeBatch: noSleep, sleep: noSleep,
  });
  assert.equal(partial.complete, false);
  const empty = await ingestTrials({ fetchPage: async () => ({ studies: [] }),
    writeBatch: async () => assert.fail("should not write empty batches"), sleep: noSleep,
  });
  assert.deepEqual(empty, { pages: 1, uniqueStudies: 0, complete: true });
});

test("stops on write errors, invalid study data, repeated tokens, and invalid limits", async () => {
  let reads = 0;
  await assert.rejects(ingestTrials({
    fetchPage: async () => { reads++; return { studies: [study()], nextPageToken: "more" }; },
    writeBatch: async () => { throw new Error("Write failed"); }, sleep: noSleep,
  }), /Write failed/);
  assert.equal(reads, 1);
  await assert.rejects(ingestTrials({ fetchPage: async () => ({ studies: [study(), study("bad")] }),
    writeBatch: async () => assert.fail("invalid batch must not be saved"), sleep: noSleep,
  }));
  await assert.rejects(ingestTrials({ fetchPage: async () => ({ studies: [], nextPageToken: "same" }),
    writeBatch: noSleep, sleep: noSleep,
  }), /repeated page token/);
  await assert.rejects(ingestTrials({ maxPages: 0, writeBatch: noSleep }), /positive integer/);
});

test("retains unnamed interventions and treats blank optional strings as unreported", () => {
  const row = normalizeStudy({ protocolSection: {
    ...study().protocolSection,
    armsInterventionsModule: { interventions: [{ type: "DRUG" }] },
    sponsorCollaboratorsModule: { leadSponsor: { name: "  " } },
  } }, [], timestamp);
  assert.deepEqual(row.interventions, [{ name: null, type: "drug" }]);
  assert.equal(row.sponsor_name, null);
});
