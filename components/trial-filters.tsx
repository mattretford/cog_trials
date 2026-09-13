import { CountrySelect } from "@/components/country-select";
import { formatCode } from "@/lib/clinical-trials/format";
import type { TrialFilters as Filters, TrialFilterOptions } from "@/lib/clinical-trials/filters";

export function TrialFilters({ filters, options }: { filters: Filters; options: TrialFilterOptions }) {
  const selects = [
    { name: "status", label: "Recruitment status", selected: filters.status, options: options.statuses },
    { name: "phase", label: "Phase", selected: filters.phase, options: options.phases },
    { name: "study_type", label: "Study type", selected: filters.studyType, options: options.study_types },
    { name: "intervention_type", label: "Intervention type", selected: filters.interventionType, options: options.intervention_types },
  ];

  return (
    <form action="/trials" method="get" aria-label="Filter trials" className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Filter studies</h2>
      <div className="mt-4 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {selects.map(({ name, label, selected, options: choices }) => (
          <label key={name} className="block text-sm font-semibold">
            {label}
            <select name={name} defaultValue={selected} className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              <option value="">All</option>
              {[...new Set([...choices, ...(selected ? [selected] : [])])].map((value) => (
                <option key={value} value={value}>{formatCode(value)}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="block text-sm font-semibold">
          Lead sponsor
          <input type="search" name="sponsor" maxLength={200} defaultValue={filters.sponsor}
            placeholder="Search sponsor name…"
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <CountrySelect countries={options.countries} initialSelected={filters.countries} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" className="rounded-md bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900">Apply filters</button>
        {/* A full navigation also clears unsaved form edits when already on /trials. */}
        <a href="/trials" className="text-sm font-medium text-teal-800 underline">Clear all filters</a>
        <p className="text-xs text-slate-500">Results must match each active filter.</p>
      </div>
    </form>
  );
}
