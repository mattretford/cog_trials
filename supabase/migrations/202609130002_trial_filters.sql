-- Apply after 202609130001_create_trials.sql. No data rewrite or re-import needed.
begin;

-- Invoker rights preserve the caller's existing trials SELECT policy.
create or replace function public.filter_trials(
  p_status text default null,
  p_phase text default null,
  p_study_type text default null,
  p_intervention_type text default null,
  p_sponsor text default null,
  p_countries text[] default '{}'
)
returns setof public.trials
language sql stable security invoker
set search_path = ''
as $$
  select t.* from public.trials t
  where (p_status is null or t.status = p_status)
    and (p_phase is null or p_phase = any(t.phases))
    and (p_study_type is null or t.study_type = p_study_type)
    and (p_intervention_type is null or exists (
      select 1 from jsonb_array_elements(t.interventions) i
      where i->>'type' = p_intervention_type
    ))
    -- Literal, case-insensitive substring: '%' and '_' are not wildcards.
    and (p_sponsor is null or strpos(lower(t.sponsor_name), lower(p_sponsor)) > 0)
    and (coalesce(cardinality(p_countries), 0) = 0 or exists (
      select 1 from jsonb_array_elements(t.locations) l
      where l->>'country' = any(p_countries)
    ));
$$;

-- Options come from the entire visible collection, independent of active filters.
-- Return one JSON object to avoid the API's default row limit truncating options.
create or replace function public.trial_filter_options()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'statuses', coalesce((select jsonb_agg(v order by v) from
      (select distinct status v from public.trials where status is not null) s), '[]'::jsonb),
    'phases', coalesce((select jsonb_agg(v order by v) from
      (select distinct unnest(phases) v from public.trials) s), '[]'::jsonb),
    'study_types', coalesce((select jsonb_agg(v order by v) from
      (select distinct study_type v from public.trials where study_type is not null) s), '[]'::jsonb),
    'intervention_types', coalesce((select jsonb_agg(v order by v) from
      (select distinct i->>'type' v from public.trials t,
        lateral jsonb_array_elements(t.interventions) i where i->>'type' is not null) s), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(v order by v) from
      (select distinct l->>'country' v from public.trials t,
        lateral jsonb_array_elements(t.locations) l
        where nullif(l->>'country', '') is not null) s), '[]'::jsonb)
  );
$$;

revoke all on function public.filter_trials(text, text, text, text, text, text[]) from public;
revoke all on function public.trial_filter_options() from public;
grant execute on function public.filter_trials(text, text, text, text, text, text[]) to anon, authenticated, service_role;
grant execute on function public.trial_filter_options() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
