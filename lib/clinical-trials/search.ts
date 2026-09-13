// Shared by the ingestion command and UI. OR includes studies matching any term.
export const TRIAL_SEARCH_TERMS = [
  "dementia",
  "Alzheimer disease",
  "mild cognitive impairment",
  "Lewy body dementia",
  "frontotemporal dementia",
  "vascular dementia",
  "Parkinson disease dementia",
] as const;

export const TRIAL_SEARCH_QUERY = TRIAL_SEARCH_TERMS.map(
  (term) => `"${term}"`,
).join(" OR ");
