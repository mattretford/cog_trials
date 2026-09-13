# Cog Trials

A Next.js, TypeScript, Tailwind CSS, and Supabase app collecting publicly available
ClinicalTrials.gov studies related to dementia and cognitive disorders.

## Run locally

Use Node.js 24 or newer (the ingestion script and tests use native TypeScript support).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The site runs without credentials and shows a collection
setup state until Supabase is configured. No authentication is needed to read trials.

## Set up Supabase — one time

1. Create a new project named **Cog Trials** in your Supabase dashboard. Choose a
   region near you and save the database password securely. Supabase creates the
   Postgres database as part of the project; no separate database creation is needed.
2. In that project's **SQL Editor**, paste and run
   [`supabase/migrations/202609130001_create_trials.sql`](supabase/migrations/202609130001_create_trials.sql)
   once. It creates the `trials` table, index, permissions, and row-level security.
3. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

4. In `.env.local`, set `SUPABASE_URL` to the project URL from the **Connect** dialog.
   Find the keys under **Settings → API Keys**:
   - `SUPABASE_PUBLISHABLE_KEY`: the `sb_publishable_...` key for reading public trials.
   - `SUPABASE_SECRET_KEY`: an `sb_secret_...` key for the owner-run importer.

   Do not commit `.env.local`, paste the secret into chat, or prefix it with
   `NEXT_PUBLIC_`. The database password is not used by this app. The secret key is
   only read by `scripts/ingest-trials.ts`; the website uses the publishable key.
5. Run the import, then restart `npm run dev` to load the environment variables.

## Import studies

Preview a single API page without needing Supabase or saving anything:

```bash
npm run ingest:trials -- --dry-run --max-pages 1
```

Import all matching pages into Supabase:

```bash
npm run ingest:trials
```

For an initial small **partial** database import, use:

```bash
npm run ingest:trials -- --max-pages 1
```

The importer uses ClinicalTrials.gov API v2, a condition-field OR query, 100 studies
per page, latest source-update ordering, and `nextPageToken` pagination. It spaces page
requests and retries network failures, rate limits (429), and server failures up to
four attempts, with request timeouts. `--max-pages` explicitly reports a partial
import if more pages remain. A full import may take several minutes.

Search terms live in `lib/clinical-trials/search.ts` and are displayed on `/trials`.
The initial scope includes dementia, Alzheimer disease, mild cognitive impairment,
Lewy body dementia, frontotemporal dementia, vascular dementia, and Parkinson
disease dementia. The registry can include related-term matches. All countries,
statuses, and study types (including observational studies) are included; this is
an initial discovery query, not a clinically validated exhaustive search strategy.

Each batch is validated and upserted by `nct_id`: existing rows are refreshed,
including changed statuses and removed locations, rather than duplicated. Batches
commit independently. If a later page fails, earlier pages remain saved, the command
exits nonzero, and rerunning safely starts the full search again. No public HTTP
endpoint or website button can trigger imports. Run one importer at a time.

Imports are manual for now. Rows are not deleted when a study stops matching the
query. Changing search terms affects future imports; existing records keep their
last import's search terms until refreshed. `search_terms` records the complete
query scope, not which individual term matched. The UI shows the current configured
scope, source update dates, and each row's import date, rather than claiming a
complete collection-wide refresh. Scheduling, resumable jobs, and pruning can be
added later if needed.

## Normalised data

One database row represents one ClinicalTrials.gov NCT ID.

| Field | Representation |
| --- | --- |
| Phase | Array of source codes in lowercase, retaining combined phases; `na` means not applicable, an empty array means unreported |
| Status / study type | Lowercase source code; null if absent; future codes are retained |
| Interventions | JSONB array of names and normalised type codes |
| Sponsor | Lead sponsor name/type, plus a JSONB array of collaborators |
| Locations | JSONB array of facility, city, region, postal code, country, status, and coordinates |
| Provenance | Source link, source update date at its original precision, search terms, import timestamp |

Names retain their original spelling (with surrounding whitespace removed).
Exact duplicate array entries are removed. Contact names, phone numbers, and email
addresses are not stored. API data is runtime-validated with Zod: TypeScript alone
cannot verify an external response. A malformed required field stops ingestion
rather than silently losing a study.

JSONB is Postgres's structured JSON type. It keeps repeated fields together without
introducing several join tables at this stage. These can become separate tables
later if filtering and analytics require it. SQL migrations are versioned in Git.
RLS permits public reads; public roles have no insert/update/delete grants or policies.

## Application structure

```text
app/
  layout.tsx                  Shared application shell
  page.tsx                    Home page
  trials/page.tsx             Reads saved studies, shows search scope and pagination
  trials/loading.tsx          Loading state
components/
  site-header.tsx             Navigation (Client Component for current-route state)
  trial-card.tsx              Trial presentation (Server Component)
lib/
  clinical-trials/search.ts   Shared query configuration
  clinical-trials/client.ts   ClinicalTrials.gov HTTP client and retries
  clinical-trials/normalize.ts Runtime validation and normalisation
  clinical-trials/ingest.ts   Paginated import orchestration
  clinical-trials/format.ts   Human-readable source-code labels
  supabase/trials.ts          Server-only, read-only database access
scripts/ingest-trials.ts      Owner-run CLI; only place reading the secret key
supabase/migrations/         Database schema and permissions
tests/                      Offline ingestion tests
```

App Router maps `page.tsx` files to URLs. The root layout wraps both routes through
its `children` prop. The trials page is an async Server Component: database access
runs on the server and the browser receives rendered UI. Awaited `searchParams`
select the requested page; reads are uncached so new imports appear on reload.
`@/` imports point to the project root. Native Node scripts use explicit `.ts`
imports, enabled by TypeScript's `allowImportingTsExtensions` setting.

## Checks

```bash
npm run test
npm run lint
npm run build
```

In environments that restrict Turbopack's local worker ports, validate with
`npm run build -- --webpack`. `npm start` serves the resulting production build.
Tests use simulated API responses to cover normalisation, missing data, multi-phase
studies, pagination, duplicate IDs, retries, and partial/failing imports. A dry run
verifies the live API but does **not** test database permissions or persistence.

After configuring the real project, run a one-page import twice and confirm the
row count stays the same in Supabase's Table Editor. Open `/trials` to confirm
public reads work, source links and locations render, and pagination works after
a full import. Database integration cannot be verified until the project exists.

## Sources

- [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase upsert](https://supabase.com/docs/reference/javascript/upsert)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
