-- Proposed migration; SECURITY INVOKER preserves the existing ownership RLS.
-- A patch contains only records changed by this client, never a replacement dataset.
create or replace function public.planint_commit_changes(changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  allowed text[] := array['planint_origins','planint_milestones','planint_deliverables',
    'planint_management_categories','planint_activities','planint_checklist_items','planint_schedule_history',
    'planint_important_dates','planint_habits','planint_habit_tracking','planint_reminders',
    'planint_availability_profiles','planint_availability_days','planint_week_baselines','planint_week_baseline_items','planint_import_logs'];
  item jsonb; op jsonb; row_data jsonb; current_row jsonb; desired jsonb; col_list text; value_list text; assignments text;
  t text; col text; result jsonb := '[]'; saved jsonb; ids jsonb; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>16 then
    raise exception 'Invalid patch' using errcode='22023';
  end if;
  -- Serialize patches for one account. Other accounts remain independent.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  for item in select value from jsonb_array_elements(changes) loop
    if not (item->>'table'=any(allowed)) or item->>'table' is null then raise exception 'Table not allowed'; end if;
  end loop;
  -- Insert parents before children, regardless of caller ordering.
  foreach t in array allowed loop
    for item in select value from jsonb_array_elements(changes) where value->>'table'=t loop
      for op in select value from jsonb_array_elements(coalesce(item->'upserts','[]')) loop
        row_data:=op->'row';
        if (row_data->>'user_id')::uuid is distinct from uid or row_data->>'id' is null then
          raise exception 'Owner mismatch' using errcode='42501';
        end if;
        execute format('select to_jsonb(r) from public.%I r where id=$1::uuid and user_id=$2 for update',t)
          into current_row using row_data->>'id',uid;
        -- A response may be lost after commit. An identical retry is a no-op.
        execute format('select jsonb_object_agg(k,typed->k) from jsonb_object_keys($1) as x(k), lateral (select to_jsonb(jsonb_populate_record(null::public.%I,$1)) as typed) y where k not in (''created_at'',''updated_at'')',t)
          into desired using row_data;
        if current_row is not null and current_row @> desired then continue; end if;
        if current_row is distinct from nullif(op->'expected','null'::jsonb) then
          raise exception 'PLANINT_CONFLICT: % was changed on another device',t using errcode='40001';
        end if;
        col_list:=''; value_list:=''; assignments:='';
        for col in select key from jsonb_object_keys(row_data) as key order by key loop
          if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name=col) then
            raise exception 'Unknown column';
          end if;
          col_list:=col_list||format('%I,',col);
          value_list:=value_list||format('(jsonb_populate_record(null::public.%I,$1)).%I,',t,col);
          if col not in ('id','user_id','created_at','updated_at') then
            assignments:=assignments||format('%I=(jsonb_populate_record(null::public.%I,$1)).%I,',col,t,col);
          end if;
        end loop;
        if current_row is null then
          execute format('insert into public.%I (%s) select %s',t,rtrim(col_list,','),rtrim(value_list,',')) using row_data;
        else
          execute format('update public.%I set %s updated_at=clock_timestamp() where id=$2::uuid and user_id=$3',t,assignments)
            using row_data,row_data->>'id',uid;
        end if;
      end loop;
    end loop;
  end loop;
  -- Children are removed first. Recurring instances precede their master.
  for t in select name from unnest(allowed) with ordinality as x(name,position) order by position desc loop
    for item in select value from jsonb_array_elements(changes) where value->>'table'=t loop
      for op in select value from jsonb_array_elements(coalesce(item->'deletes','[]'))
        order by coalesce((value->'expected'->>'is_recurring_master')::boolean,false) loop
        execute format('select to_jsonb(r) from public.%I r where id=$1::uuid and user_id=$2 for update',t)
          into current_row using op->>'id',uid;
        if current_row is null then continue; end if;
        if current_row is distinct from op->'expected' then
          raise exception 'PLANINT_CONFLICT: % was changed on another device',t using errcode='40001';
        end if;
        execute format('delete from public.%I where id=$1::uuid and user_id=$2',t) using op->>'id',uid;
      end loop;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(changes) loop
    t:=item->>'table';
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where user_id=$1 and id in (select (value->''row''->>''id'')::uuid from jsonb_array_elements($2))',t)
      into saved using uid,coalesce(item->'upserts','[]');
    select coalesce(jsonb_agg(value->>'id'),'[]'::jsonb) into ids from jsonb_array_elements(coalesce(item->'deletes','[]'));
    result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',saved,'deleted',ids));
  end loop;
  return result;
end;
$$;
revoke all on function public.planint_commit_changes(jsonb) from public, anon;
grant execute on function public.planint_commit_changes(jsonb) to authenticated;


