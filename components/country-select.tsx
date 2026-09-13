"use client";

import { useState } from "react";

export function CountrySelect({ countries, initialSelected }: {
  countries: string[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [search, setSearch] = useState("");
  // Include selections from a saved URL even if an option has since disappeared.
  const options = [...new Set([...countries, ...initialSelected])].sort((a, b) => a.localeCompare(b, "en"));
  const visible = options.filter((country) => country.toLocaleLowerCase("en").includes(search.trim().toLocaleLowerCase("en")));

  function toggle(country: string) {
    setSelected((current) => current.includes(country)
      ? current.filter((value) => value !== country)
      : [...current, country]);
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">Countries</legend>
      {/* Hidden inputs retain selections when the option search hides a checkbox. */}
      {selected.map((country) => <input key={country} type="hidden" name="country" value={country} />)}
      <details className="mt-2 rounded-md border border-slate-300 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm">
          {selected.length ? `${selected.length} ${selected.length === 1 ? "country" : "countries"} selected` : "All countries"}
        </summary>
        <div className="border-t border-slate-200 p-3">
          <label htmlFor="country-search" className="sr-only">Search countries</label>
          <input
            id="country-search" type="search" value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
            placeholder="Search countries…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p role="status" className="mt-2 text-xs text-slate-500">
            {visible.length} {visible.length === 1 ? "country" : "countries"} found
          </p>
          <div className="mt-2 max-h-56 overflow-y-auto" aria-label="Country choices">
            {visible.map((country) => (
              <label key={country} className="flex cursor-pointer items-center gap-3 rounded px-1 py-2 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(country)}
                  onChange={() => toggle(country)} className="h-4 w-4 shrink-0 accent-teal-800" />
                {country}
              </label>
            ))}
            {!visible.length && <p className="py-2 text-sm text-slate-600">No countries match your search.</p>}
          </div>
        </div>
      </details>
      {!!selected.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((country) => (
            <button key={country} type="button" onClick={() => toggle(country)}
              aria-label={`Remove ${country}`}
              className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-900 hover:bg-teal-100">
              {country} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" onClick={() => setSelected([])} className="px-2 py-1 text-xs text-teal-800 underline">Clear countries</button>
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-500">Matches any selected country where a study lists a site.</p>
    </fieldset>
  );
}
