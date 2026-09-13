import type { Metadata } from "next";
import Link from "next/link";
import { TrialFilters } from "@/components/trial-filters";
import { parseTrialFilters, parseTrialPage, trialsHref, hasTrialFilters, type SearchParams } from "@/lib/clinical-trials/filters";
import { TrialCard } from "@/components/trial-card";
import { TRIAL_SEARCH_TERMS } from "@/lib/clinical-trials/search";
import { getTrials, TRIALS_PER_PAGE } from "@/lib/supabase/trials";

export const metadata: Metadata = { title: "Trials" };

export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parseTrialPage(params);
  const filters = parseTrialFilters(params);
  const filtered = hasTrialFilters(filters);
  const result = await getTrials(page, filters);

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight">Clinical trials</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
        Dementia and cognitive disorder studies from ClinicalTrials.gov.
      </p>
      <section aria-labelledby="search-scope" className="mt-8 rounded-xl border border-teal-100 bg-teal-50/50 p-6">
        <h2 id="search-scope" className="font-semibold">Our search terms</h2>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Condition search terms">
          {TRIAL_SEARCH_TERMS.map((term) => (
            <li key={term} className="rounded-full border border-teal-200 bg-white px-3 py-1 text-sm text-teal-900">{term}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Imports search the registry&apos;s condition field for any of these terms,
          including its related-term matches. All study types, recruitment statuses,
          and countries are included. Results may include broadly related studies.
        </p>
      </section>
      {result.state === "ready" && (
        <TrialFilters key={trialsHref(filters, page)} filters={filters} options={result.options} />
      )}
      {result.state !== "ready" ? (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-8" aria-labelledby="collection-status">
          <h2 id="collection-status" className="text-xl font-semibold">
            {result.state === "unconfigured" ? "The collection is being prepared" : "Trial listings are temporarily unavailable"}
          </h2>
          <p className="mt-3 text-slate-600">
            {result.state === "unconfigured"
              ? "Studies will appear here once the first import is ready."
              : "We couldn’t load the saved studies. Please try again shortly."}
          </p>
          {result.state === "error" && <Link href={trialsHref(filters, page)} className="mt-4 inline-block font-medium text-teal-800 underline">Try again</Link>}
        </section>
      ) : (
        <section className="mt-8" aria-label="Saved trial listings">
          <p className="mb-5 text-sm text-slate-600">
            {result.total.toLocaleString("en-GB")} {filtered ? "matching" : "saved"} studies · Latest source updates first
          </p>
          {result.trials.length ? (
            <div className="space-y-5">
              {result.trials.map((trial) => <TrialCard key={trial.nct_id} trial={trial} />)}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
              {page !== 1 ? "There are no studies on this page." : filtered ? "No studies match these filters. Try removing a filter or selecting other countries." : "No studies have been imported yet."}
            </p>
          )}
          <nav aria-label="Trial pages" className="mt-8 flex items-center justify-between gap-4 text-sm">
            {page > 1 ? <Link className="font-medium text-teal-800 underline" href={trialsHref(filters, page - 1)}>Previous</Link> : <span />}
            <span>Page {page} of {Math.max(1, Math.ceil(result.total / TRIALS_PER_PAGE))}</span>
            {page * TRIALS_PER_PAGE < result.total
              ? <Link className="font-medium text-teal-800 underline" href={trialsHref(filters, page + 1)}>Next</Link>
              : page > 1 && !result.trials.length
                ? <Link className="font-medium text-teal-800 underline" href={trialsHref(filters)}>First page</Link>
                : <span />}
          </nav>
        </section>
      )}
    </div>
  );
}
