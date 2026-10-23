-- Additive only. Existing records, ownership policies and transactional RPC are preserved.
alter table public.planint_activities add column if not exists recurrence_exclusions date[] not null default '{}'::date[];
alter table public.planint_availability_profiles add column if not exists time_blocks jsonb not null default '[]'::jsonb;
alter table public.planint_availability_profiles add constraint planint_time_blocks_array check (jsonb_typeof(time_blocks)='array' and jsonb_array_length(time_blocks)<=1000);
comment on column public.planint_activities.recurrence_exclusions is 'Calendar-local occurrence dates explicitly removed by the owner; preserved across regeneration.';
comment on column public.planint_availability_profiles.time_blocks is 'Owned availability exceptions, separate from activities. Existing profile RLS and transactional patch apply.';
