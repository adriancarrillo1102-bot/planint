begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.planint_user_state limit 1),true);
set local role authenticated;
do $qa$
declare patch jsonb; result jsonb; saved jsonb; activity jsonb; blocked boolean; now_saved jsonb; origin_before jsonb;
begin
patch:=replace($fixture$[{"table":"planint_origins","upserts":[{"row":{"client_id":9000000000001,"name":"QA temporal","kind":"other","scope":"personal","description":"","progress":null,"archived":false,"source_created_at":null,"id":"8df71810-a38c-463e-8ad6-52a337d760d2","user_id":"00000000-0000-4000-8000-999999999999"},"expected":null}],"deletes":[]},{"table":"planint_activities","upserts":[{"row":{"client_id":9000000000002,"name":"QA sincronización","scope":"personal","origin_id":"8df71810-a38c-463e-8ad6-52a337d760d2","milestone_id":null,"deliverable_id":null,"management_category_id":null,"status":"pending","priority":"Media","urgency":"Normal","estimated_duration_raw":"—","nature":"unique","intake":"planned","tentative_date":null,"description":"","notes":"","responsibility_role":"executor","checklist_enabled":false,"closing_comments":"","actual_minutes":0,"actual_start":null,"actual_end":null,"completed_date":null,"completed_at":null,"is_recurring_master":false,"recurrence_master_id":null,"recurrence_date":null,"recurrence_freq":null,"recurrence_days":null,"recurrence_time":null,"recurrence_start":null,"recurrence_end":null,"origin_history":[],"postpone_history":[],"source_created_at":null,"id":"bed5e956-d377-497c-b408-2539f9f54479","user_id":"00000000-0000-4000-8000-999999999999"},"expected":null}],"deletes":[]},{"table":"planint_checklist_items","upserts":[{"row":{"activity_id":"bed5e956-d377-497c-b408-2539f9f54479","client_id":9000000000003,"item_text":"Paso","done":false,"completed_at":null,"sort_order":0,"id":"bb7e562c-9337-4eff-90e0-0bc9da5a70bf","user_id":"00000000-0000-4000-8000-999999999999"},"expected":null}],"deletes":[]}]$fixture$,'00000000-0000-4000-8000-999999999999',auth.uid()::text)::jsonb;
result:=public.planint_commit_changes(patch);
perform public.planint_commit_changes(patch); -- Lost-response retry.
if (select count(*) from public.planint_activities where client_id=9000000000002)<>1 then raise exception 'Duplicate retry'; end if;
select to_jsonb(t) into saved from public.planint_activities t where client_id=9000000000002;
activity:=saved||jsonb_build_object('name','QA editada');
result:=public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_activities','upserts',jsonb_build_array(jsonb_build_object('row',activity,'expected',saved)),'deletes','[]'::jsonb)));
blocked:=false;
begin
 perform public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_activities','upserts',jsonb_build_array(jsonb_build_object('row',activity||'{"name":"Edición desactualizada"}'::jsonb,'expected',saved)),'deletes','[]'::jsonb)));
exception when serialization_failure then blocked:=true;
end;
if not blocked then raise exception 'Stale edit not rejected'; end if;
select to_jsonb(t) into origin_before from public.planint_origins t where client_id=9000000000001;
blocked:=false;
begin
 perform public.planint_commit_changes(jsonb_build_array(
 jsonb_build_object('table','planint_origins','upserts',jsonb_build_array(jsonb_build_object('row',origin_before||'{"name":"No debe persistir"}'::jsonb,'expected',origin_before)),'deletes','[]'::jsonb),
 jsonb_build_object('table','planint_checklist_items','upserts',jsonb_build_array(jsonb_build_object('row',jsonb_build_object('id',gen_random_uuid(),'user_id',auth.uid(),'client_id',9000000000099,'activity_id',gen_random_uuid(),'item_text','FK inválida'),'expected',null)),'deletes','[]'::jsonb)));
exception when foreign_key_violation then blocked:=true;
end;
if not blocked or not exists(select 1 from public.planint_origins where client_id=9000000000001 and name='QA temporal') then raise exception 'Atomic rollback failed'; end if;
blocked:=false;
begin
 perform public.planint_commit_changes(jsonb_build_array(jsonb_build_object('table','planint_activities','upserts',jsonb_build_array(jsonb_build_object('row',activity||'{"user_id":"00000000-0000-4000-8000-999999999999"}'::jsonb,'expected',saved)),'deletes','[]'::jsonb)));
exception when insufficient_privilege then blocked:=true;
end;
if not blocked then raise exception 'Owner mismatch allowed'; end if;
end
$qa$;
select 'PASS: create/edit, idempotent retry, stale conflict, ownership, atomic rollback; no test data retained' as validation;
rollback;
