-- Integration test: synthetic rows and a temporary profile edit; everything rolls back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.planint_origins limit 1),true);
set local role authenticated;
do $qa$
declare
 actor uuid:=auth.uid(); oid uuid:=gen_random_uuid(); master_id uuid:=gen_random_uuid(); child_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid();
 schedule_id uuid:=gen_random_uuid(); related_id uuid:=gen_random_uuid(); check_id uuid:=gen_random_uuid(); baseline_id uuid:=gen_random_uuid(); item_id uuid:=gen_random_uuid();
 master_row jsonb; child_row jsonb; related_row jsonb; profile_row jsonb; block jsonb; patch jsonb; result jsonb; denied boolean;
begin
 if actor is null then raise exception 'QA requires an existing account'; end if;
 insert into public.planint_origins(id,user_id,client_id,name,kind,scope) values(oid,actor,9000000080001,'QA temporal de bloqueos','other','work');
 insert into public.planint_activities(id,user_id,client_id,name,scope,origin_id,status,nature,is_recurring_master,recurrence_freq,recurrence_days,recurrence_time,recurrence_start)
 values(master_id,actor,9000000080002,'QA serie','work',oid,'recurring','recurrent',true,'daily',array[0,1,2,3,4,5,6]::smallint[],'13:00',current_date);
 insert into public.planint_activities(id,user_id,client_id,name,scope,origin_id,status,nature,recurrence_master_id,recurrence_date)
 values(child_id,actor,9000000080003,'QA ocurrencia','work',oid,'scheduled','recurrent',master_id,current_date);
 insert into public.planint_activities(id,user_id,client_id,name,scope,origin_id,status) values(other_id,actor,9000000080004,'QA ajena','work',oid,'scheduled');
 insert into public.planint_schedule_history(id,user_id,activity_id,client_id,scheduled_date,start_time,result) values(schedule_id,actor,child_id,9000000080010,current_date,'13:00','active');
 insert into public.planint_schedule_history(id,user_id,activity_id,client_id,scheduled_date,start_time,result,related_activity_id) values(related_id,actor,other_id,9000000080011,current_date,'15:00','active',child_id);
 insert into public.planint_checklist_items(id,user_id,activity_id,client_id,item_text) values(check_id,actor,child_id,9000000080012,'QA paso');
 insert into public.planint_week_baselines(id,user_id,client_id,week_start,week_end,confirmed_at) values(baseline_id,actor,9000000080013,current_date,current_date+6,now());
 insert into public.planint_week_baseline_items(id,user_id,baseline_id,activity_id,schedule_history_id,scheduled_date,start_time,origin_id,captured_name,captured_at)
 values(item_id,actor,baseline_id,child_id,schedule_id,current_date,'13:00',oid,'QA capturada',now());
 select to_jsonb(t) into master_row from public.planint_activities t where id=master_id;
 select to_jsonb(t) into child_row from public.planint_activities t where id=child_id;
 select to_jsonb(t) into related_row from public.planint_schedule_history t where id=related_id;
 patch:=jsonb_build_array(
  jsonb_build_object('table','planint_activities','upserts',jsonb_build_array(jsonb_build_object('row',master_row||jsonb_build_object('recurrence_exclusions',jsonb_build_array(current_date::text)),'expected',master_row)),'deletes',jsonb_build_array(jsonb_build_object('id',child_id,'expected',child_row))),
  jsonb_build_object('table','planint_schedule_history','upserts',jsonb_build_array(jsonb_build_object('row',related_row||jsonb_build_object('related_activity_id',null),'expected',related_row)),'deletes',(select jsonb_agg(jsonb_build_object('id',t.id,'expected',to_jsonb(t))) from public.planint_schedule_history t where id=schedule_id)),
  jsonb_build_object('table','planint_checklist_items','upserts','[]'::jsonb,'deletes',(select jsonb_agg(jsonb_build_object('id',t.id,'expected',to_jsonb(t))) from public.planint_checklist_items t where id=check_id)),
  jsonb_build_object('table','planint_week_baseline_items','upserts','[]'::jsonb,'deletes',(select jsonb_agg(jsonb_build_object('id',t.id,'expected',to_jsonb(t))) from public.planint_week_baseline_items t where id=item_id)));
 result:=public.planint_commit_changes(patch);
 perform public.planint_commit_changes(patch); -- Lost-response retry must be harmless.
 if exists(select 1 from public.planint_activities where id=child_id) or exists(select 1 from public.planint_checklist_items where id=check_id) or exists(select 1 from public.planint_week_baseline_items where id=item_id) then raise exception 'Incomplete deletion'; end if;
 if not exists(select 1 from public.planint_activities where id=master_id and current_date=any(recurrence_exclusions)) then raise exception 'Exception not persisted'; end if;
 if not exists(select 1 from public.planint_schedule_history where id=related_id and related_activity_id is null) then raise exception 'Related activity reference not cleared'; end if;
 denied:=false;
 begin
  insert into public.planint_activities(user_id,client_id,name,scope,origin_id,status,nature,recurrence_master_id,recurrence_date)
  values(actor,9000000080099,'QA pestaña antigua','work',oid,'scheduled','recurrent',master_id,current_date);
 exception when check_violation then denied:=true;
 end;
 if not denied then raise exception 'An old client recreated an excluded occurrence'; end if;
 -- Conversion may retire a series before its first occurrence, preserving the master.
 update public.planint_activities set recurrence_stopped_from=current_date where id=master_id;
 denied:=false;
 begin
  insert into public.planint_activities(user_id,client_id,name,scope,origin_id,status,nature,recurrence_master_id,recurrence_date)
  values(actor,9000000080098,'QA recreada después de convertir','work',oid,'scheduled','recurrent',master_id,current_date+1);
 exception when check_violation then denied:=true;
 end;
 if not denied then raise exception 'An old client recreated an occurrence after conversion'; end if;
 -- Delete master only after its children; the unrelated activity stays.
 select to_jsonb(t) into master_row from public.planint_activities t where id=master_id;
 perform public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_activities','upserts','[]'::jsonb,'deletes',jsonb_build_array(jsonb_build_object('id',master_id,'expected',master_row)))));
 if not exists(select 1 from public.planint_activities where id=other_id) then raise exception 'Unrelated activity removed'; end if;
 select to_jsonb(t) into profile_row from public.planint_availability_profiles t where user_id=actor and scope='work';
 if profile_row is null then raise exception 'QA requires an existing work availability profile'; end if;
 block:=jsonb_build_object('id','qa-rollback-only','title','QA comida','startDate',current_date::text,'endDate','','allDay',false,'startTime','13:00','endTime','14:00','freq','weekly','days',jsonb_build_array(0,1,2,3,4),'replacesBreak',true,'excludedDates','[]'::jsonb);
 perform public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_availability_profiles','upserts',jsonb_build_array(jsonb_build_object('row',profile_row||jsonb_build_object('time_blocks',(profile_row->'time_blocks')||jsonb_build_array(block)),'expected',profile_row)),'deletes','[]'::jsonb)));
 if not exists(select 1 from public.planint_availability_profiles where id=(profile_row->>'id')::uuid and time_blocks @> jsonb_build_array(block)) then raise exception 'Block not saved'; end if;
 denied:=false;
 begin
  perform public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_availability_profiles','upserts',jsonb_build_array(jsonb_build_object('row',profile_row||'{"break_minutes":239}'::jsonb,'expected',profile_row)),'deletes','[]'::jsonb)));
 exception when serialization_failure then denied:=true;
 end;
 if not denied then raise exception 'Stale profile overwrite accepted'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.planint_availability_profiles where id=(profile_row->>'id')::uuid) then raise exception 'RLS read leak'; end if;
 denied:=false;
 begin
  perform public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_availability_profiles','upserts',jsonb_build_array(jsonb_build_object('row',profile_row,'expected',profile_row)),'deletes','[]'::jsonb)));
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Cross-account write accepted'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
end $qa$;
rollback;
select 'PASS: transactional deletion, exceptions, blocks, idempotency, stale conflicts and account isolation; all QA changes rolled back' as result;
