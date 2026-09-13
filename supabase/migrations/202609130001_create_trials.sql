-- Run once in the Supabase SQL Editor for your Cog Trials project.
begin;

create table public.trials (
  nct_id text primary key check (nct_id ~ '^NCT[0-9]{8}$'),
  title text not null,
  official_title text,
  summary text,
  conditions text[] not null default '{}',
  study_type text,
  status text,
  phases text[] not null default '{}',
  sponsor_name text,
  sponsor_type text,
  collaborators jsonb not null default '[]'::jsonb check (jsonb_typeof(collaborators) = 'array'),
  interventions jsonb not null default '[]'::jsonb check (jsonb_typeof(interventions) = 'array'),
  locations jsonb not null default '[]'::jsonb check (jsonb_typeof(locations) = 'array'),
  source_url text not null,
  source_updated_date text,
  search_terms text[] not null,
  ingested_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index trials_source_updated_date_idx on public.trials (source_updated_date desc, nct_id);

alter table public.trials enable row level security;
-- Public registry information is readable; only the owner-run importer writes.
revoke all on table public.trials from anon, authenticated;
grant select on table public.trials to anon, authenticated;
grant select, insert, update on table public.trials to service_role;
create policy "Public can read trial listings"
  on public.trials for select to anon, authenticated using (true);

commit;
