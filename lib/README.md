# Shared non-UI code

`clinical-trials/` contains query configuration, API access, runtime validation,
normalisation, display labels, and ingestion orchestration.

`supabase/trials.ts` is server-only and reads saved trials using the publishable
key. The owner-run command in `scripts/` handles database writes separately.
