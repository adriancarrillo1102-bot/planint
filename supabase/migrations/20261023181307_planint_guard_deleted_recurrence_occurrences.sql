-- Old tabs cannot recreate a date explicitly excluded by another device.
create or replace function public.planint_guard_recurrence_exclusions() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.recurrence_master_id is not null and exists(
  select 1 from public.planint_activities m where m.id=new.recurrence_master_id
  and m.user_id=new.user_id and new.recurrence_date=any(m.recurrence_exclusions)
 ) then
  raise exception 'PLANINT_OCCURRENCE_EXCLUDED: this occurrence was removed; reload the current data' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.planint_guard_recurrence_exclusions() from public,anon,authenticated;
create trigger planint_activities_guard_exclusions before insert or update on public.planint_activities
for each row execute function public.planint_guard_recurrence_exclusions();
