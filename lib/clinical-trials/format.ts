const labels: Record<string, string> = {
  na: "Not applicable",
  early_phase1: "Early phase 1",
  phase1: "Phase 1",
  phase2: "Phase 2",
  phase3: "Phase 3",
  phase4: "Phase 4",
  active_not_recruiting: "Active, not recruiting",
  not_yet_recruiting: "Not yet recruiting",
  enrolling_by_invitation: "Enrolling by invitation",
};

export function formatCode(value: string | null): string {
  if (!value) return "Not reported";
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
