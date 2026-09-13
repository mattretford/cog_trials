import { z } from "zod";

const text = z.string().trim().min(1);
const optionalText = z.string().trim().transform((value) => value || null).nullish();
const sponsor = z.object({ name: optionalText, class: optionalText });

// Validate the fields we consume, discarding unrelated source fields.
const sourceStudySchema = z.object({
  protocolSection: z.object({
    identificationModule: z.object({
      nctId: z.string().regex(/^NCT\d{8}$/),
      briefTitle: text,
      officialTitle: optionalText,
    }),
    statusModule: z.object({
      overallStatus: optionalText,
      lastUpdatePostDateStruct: z.object({ date: optionalText }).nullish(),
    }).nullish(),
    descriptionModule: z.object({ briefSummary: optionalText }).nullish(),
    conditionsModule: z.object({ conditions: z.array(text).nullish() }).nullish(),
    designModule: z.object({ studyType: optionalText, phases: z.array(text).nullish() }).nullish(),
    sponsorCollaboratorsModule: z.object({
      leadSponsor: sponsor.nullish(),
      collaborators: z.array(sponsor).nullish(),
    }).nullish(),
    armsInterventionsModule: z.object({
      interventions: z.array(z.object({ name: optionalText, type: optionalText })).nullish(),
    }).nullish(),
    contactsLocationsModule: z.object({
      locations: z.array(z.object({
        facility: optionalText,
        city: optionalText,
        state: optionalText,
        zip: optionalText,
        country: optionalText,
        status: optionalText,
        geoPoint: z.object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        }).nullish(),
      })).nullish(),
    }).nullish(),
  }),
});

export const trialSchema = z.object({
  nct_id: text,
  title: text,
  official_title: z.string().nullable(),
  summary: z.string().nullable(),
  conditions: z.array(z.string()),
  study_type: z.string().nullable(),
  status: z.string().nullable(),
  phases: z.array(z.string()),
  sponsor_name: z.string().nullable(),
  sponsor_type: z.string().nullable(),
  collaborators: z.array(z.object({ name: z.string().nullable(), type: z.string().nullable() })),
  interventions: z.array(z.object({ name: z.string().nullable(), type: z.string().nullable() })),
  locations: z.array(z.object({
    facility: z.string().nullable(), city: z.string().nullable(), region: z.string().nullable(),
    postal_code: z.string().nullable(), country: z.string().nullable(), status: z.string().nullable(),
    latitude: z.number().nullable(), longitude: z.number().nullable(),
  })),
  source_url: z.string().url(),
  source_updated_date: z.string().nullable(),
  search_terms: z.array(z.string()),
  ingested_at: z.string().datetime({ offset: true }),
});

export type Trial = z.infer<typeof trialSchema>;

// Keep machine-readable source codes, with one casing convention. Unknown future
// codes remain available instead of being incorrectly mapped to a known value.
function code(value: string | null | undefined): string | null {
  return value?.toLowerCase() ?? null;
}

function unique<T>(items: T[]): T[] {
  return [...new Map(items.map((item) => [JSON.stringify(item), item])).values()];
}

export function normalizeStudy(
  input: unknown,
  searchTerms: readonly string[],
  ingestedAt = new Date().toISOString(),
): Trial {
  const p = sourceStudySchema.parse(input).protocolSection;
  const id = p.identificationModule;
  const lead = p.sponsorCollaboratorsModule?.leadSponsor;

  return trialSchema.parse({
    nct_id: id.nctId,
    title: id.briefTitle,
    official_title: id.officialTitle ?? null,
    summary: p.descriptionModule?.briefSummary ?? null,
    conditions: unique(p.conditionsModule?.conditions ?? []),
    study_type: code(p.designModule?.studyType),
    status: code(p.statusModule?.overallStatus),
    phases: unique((p.designModule?.phases ?? []).map((phase) => phase.toLowerCase())),
    sponsor_name: lead?.name ?? null,
    sponsor_type: code(lead?.class),
    collaborators: unique((p.sponsorCollaboratorsModule?.collaborators ?? []).map((item) => ({
      name: item.name ?? null, type: code(item.class),
    }))),
    interventions: unique((p.armsInterventionsModule?.interventions ?? []).map((item) => ({
      name: item.name ?? null, type: code(item.type),
    }))),
    locations: unique((p.contactsLocationsModule?.locations ?? []).map((item) => ({
      facility: item.facility ?? null,
      city: item.city ?? null,
      region: item.state ?? null,
      postal_code: item.zip ?? null,
      country: item.country ?? null,
      status: code(item.status),
      latitude: item.geoPoint?.lat ?? null,
      longitude: item.geoPoint?.lon ?? null,
    }))),
    source_url: `https://clinicaltrials.gov/study/${id.nctId}`,
    // Retain source precision; do not invent a day for partial dates.
    source_updated_date: p.statusModule?.lastUpdatePostDateStruct?.date ?? null,
    search_terms: [...searchTerms],
    ingested_at: ingestedAt,
  });
}
