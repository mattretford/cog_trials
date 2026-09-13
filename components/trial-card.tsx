import type { Trial } from "@/lib/clinical-trials/normalize";
import { formatCode } from "@/lib/clinical-trials/format";

export function TrialCard({ trial }: { trial: Trial }) {
  const countries = [...new Set(trial.locations.flatMap((location) => location.country ? [location.country] : []))];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-mono text-slate-500">{trial.nct_id}</span>
        <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-900">
          {formatCode(trial.status)}
        </span>
        <span className="text-slate-600">{formatCode(trial.study_type)}</span>
      </div>
      <h2 className="mt-4 text-xl font-semibold leading-7">
        <a href={trial.source_url} className="text-teal-900 underline decoration-teal-200 underline-offset-4 hover:decoration-teal-800">
          {trial.title}
        </a>
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {trial.conditions.join(" · ") || "Conditions not reported"}
      </p>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Phase</dt>
          <dd className="mt-1 text-slate-600">{trial.phases.length ? trial.phases.map(formatCode).join(" / ") : "Not reported"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Lead sponsor</dt>
          <dd className="mt-1 text-slate-600">{trial.sponsor_name ?? "Not reported"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Interventions</dt>
          <dd className="mt-1 text-slate-600">
            {trial.interventions.length ? (
              <ul className="space-y-1">
                {trial.interventions.map((item, index) => (
                  <li key={index}>{item.name ?? "Name not reported"}{item.type ? ` (${formatCode(item.type)})` : ""}</li>
                ))}
              </ul>
            ) : "Not reported"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Locations</dt>
          <dd className="mt-1 text-slate-600">
            {trial.locations.length
              ? `${trial.locations.length} listed ${trial.locations.length === 1 ? "site" : "sites"}${countries.length ? ` · ${countries.join(", ")}` : ""}`
              : "Not reported"}
          </dd>
        </div>
      </dl>
      {!!trial.locations.length && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-medium text-teal-800">View listed locations</summary>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto rounded-md bg-slate-50 p-4 text-slate-600">
            {trial.locations.map((location, index) => (
              <li key={index}>
                {[location.facility, location.city, location.region, location.postal_code, location.country].filter(Boolean).join(", ") || "Location details not reported"}
                {location.status ? ` — ${formatCode(location.status)}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        Source: ClinicalTrials.gov · Source updated: {trial.source_updated_date ?? "Not reported"}
        {" · "}Imported: {trial.ingested_at.slice(0, 10)}
      </p>
    </article>
  );
}
