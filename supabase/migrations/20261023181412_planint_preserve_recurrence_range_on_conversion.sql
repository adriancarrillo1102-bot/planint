alter table public.planint_activities add column if not exists recurrence_stopped_from date;
comment on column public.planint_activities.recurrence_stopped_from is 'Stop generating on/after this local date while retaining the original recurrence range and completed history.';
create or replace function public.planint_guard_recurrence_exclusions() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.recurrence_master_id is not distinct from old.recurrence_master_id
  and new.recurrence_date is not distinct from old.recurrence_date then return new; end if;
 end if;
 if new.recurrence_master_id is not null and exists(
  select 1 from public.planint_activities m where m.id=new.recurrence_master_id and m.user_id=new.user_id
  and (new.recurrence_date=any(m.recurrence_exclusions)
   or (m.recurrence_stopped_from is not null and new.recurrence_date>=m.recurrence_stopped_from))
 ) then
  raise exception 'PLANINT_OCCURRENCE_EXCLUDED: this occurrence was removed or the series stopped; reload the current data' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.planint_guard_recurrence_exclusions() from public,anon,authenticated;
