alter table public.planint_activities add column completion_history jsonb not null default '[]'::jsonb check (jsonb_typeof(completion_history)='array');
comment on column public.planint_activities.completion_history is 'Execution corrections and reopen events, including the previous execution and schedule. Protected by existing owner RLS.';
