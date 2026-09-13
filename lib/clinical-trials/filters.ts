export type SearchParams = Record<string, string | string[] | undefined>;
export type TrialFilters = {
  status: string;
  phase: string;
  studyType: string;
  interventionType: string;
  sponsor: string;
  countries: string[];
};

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function sourceCode(value: string | string[] | undefined): string {
  const candidate = single(value);
  return /^[a-z][a-z0-9_]{0,79}$/.test(candidate) ? candidate : "";
}

export function parseTrialFilters(params: SearchParams): TrialFilters {
  const countries = typeof params.country === "string" ? [params.country] : params.country ?? [];
  return {
    status: sourceCode(params.status),
    phase: sourceCode(params.phase),
    studyType: sourceCode(params.study_type),
    interventionType: sourceCode(params.intervention_type),
    sponsor: single(params.sponsor).slice(0, 200),
    countries: [...new Set(countries.map((value) => value.trim()).filter(
      (value) => value.length > 0 && value.length <= 120,
    ))].slice(0, 250).sort(),
  };
}

export function parseTrialPage(params: SearchParams): number {
  const value = single(params.page);
  const page = /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
}

export function trialFiltersToRpc(filters: TrialFilters) {
  return {
    p_status: filters.status || null,
    p_phase: filters.phase || null,
    p_study_type: filters.studyType || null,
    p_intervention_type: filters.interventionType || null,
    p_sponsor: filters.sponsor || null,
    p_countries: filters.countries,
  };
}

export function trialsHref(filters: TrialFilters, page = 1): string {
  const params = new URLSearchParams();
  const values = {
    status: filters.status, phase: filters.phase, study_type: filters.studyType,
    intervention_type: filters.interventionType, sponsor: filters.sponsor,
  };
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  for (const country of filters.countries) params.append("country", country);
  if (page > 1) params.set("page", String(page));
  return `/trials${params.size ? `?${params}` : ""}`;
}

export function hasTrialFilters(filters: TrialFilters): boolean {
  return Boolean(filters.status || filters.phase || filters.studyType ||
    filters.interventionType || filters.sponsor || filters.countries.length);
}

export type TrialFilterOptions = {
  statuses: string[];
  phases: string[];
  study_types: string[];
  intervention_types: string[];
  countries: string[];
};
