/* One persistence boundary. Converts the existing Core model to the existing relational schema. */
(function (root) {
  'use strict';
  const TABLES = ['origins','milestones','deliverables','management_categories','activities',
    'checklist_items','schedule_history','important_dates','habits','habit_tracking','reminders',
    'availability_profiles','availability_days','week_baselines','week_baseline_items','import_logs']
    .map(n => 'planint_' + n);
  const clone = x => JSON.parse(JSON.stringify(x));
  const stable = x => JSON.stringify(x, function(k,v) {
    return v && !Array.isArray(v) && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v;
  });
  const nil = v => v === '' || v == null ? null : v;
  const comparable = r => r && Object.fromEntries(Object.entries(r).map(([k,v])=>[k,
    v && /_at$/.test(k) && !isNaN(Date.parse(v)) ? new Date(v).toISOString() :
    v && /(_time|actual_start|actual_end)$/.test(k) ? String(v).slice(0,5) : v]));
  const naturalKey = (table,r) => {
    switch (table) {
      case 'planint_milestones': case 'planint_management_categories': return stable([r.origin_id,r.client_key]);
      case 'planint_deliverables': return stable([r.milestone_id,r.client_key]);
      case 'planint_checklist_items': case 'planint_schedule_history': return stable([r.activity_id,r.client_id]);
      case 'planint_habit_tracking': return stable([r.habit_id,r.tracking_date]);
      case 'planint_availability_profiles': return r.scope;
      case 'planint_availability_days': return stable([r.profile_id,r.day_of_week]);
      case 'planint_week_baseline_items': return stable([r.baseline_id,r.activity_id,r.schedule_history_id]);
      case 'planint_import_logs': return stable(r.payload);
      default: return String(r.client_id);
    }
  };
  class Repository {
    constructor(uuid = () => crypto.randomUUID()) { this.uuid=uuid; this.ids=new Map(); this.accept({}); }
    accept(db) { this.db=clone(db); }
    normalize(s,userId) {
      const out=Object.fromEntries(TABLES.map(t=>[t,[]]));
      const maps=Object.fromEntries(TABLES.map(t=>[t,new Map((this.db[t]||[]).map(r=>[naturalKey(t,r),r]))]));
      const add=(name,fields)=>{
        const table='planint_'+name, key=naturalKey(table,fields), old=maps[table].get(key);
        const cacheKey=table+':'+key;
        if(!old&&!this.ids.has(cacheKey))this.ids.set(cacheKey,this.uuid());
        const row={...(old||{}),...fields,id:old?.id||this.ids.get(cacheKey),user_id:userId};
        out[table].push(row);return row.id;
      };
      const origins=new Map(),milestones=new Map(),deliverables=new Map(),categories=new Map(),activities=new Map(),schedules=new Map();
      const key=(...v)=>stable(v.map(String));
      for(const o of s.projects) origins.set(String(o.id),add('origins',{
        client_id:o.id,name:o.name,kind:o.type,scope:o.scope,description:o.desc||'',
        progress:nil(o.progress),archived:!!o.archived,source_created_at:nil(o.createdAt)}));
      for(const [oid,st] of Object.entries(s.projectStructures)) for(const m of st.milestones||[]) {
        const mid=add('milestones',{origin_id:origins.get(oid),client_key:String(m.id),name:m.name,
          description:m.desc||'',owner:m.owner||'',due_date:nil(m.dueDate),status:m.status||'pending',
          completed_at:nil(m.completedAt),source_created_at:nil(m.createdAt)});
        milestones.set(key(oid,m.id),mid);
        for(const d of m.deliverables||[])deliverables.set(key(oid,m.id,d.id),add('deliverables',{
          milestone_id:mid,client_key:String(d.id),name:d.name,description:d.desc||'',owner:d.owner||'',
          due_date:nil(d.dueDate),status:d.status||'pending',acceptance:d.acceptance||'',evidence:d.evidence||'',
          completed_at:nil(d.completedAt),source_created_at:nil(d.createdAt)}));
      }
      for(const [oid,st] of Object.entries(s.managementStructures))for(const c of st.categories||[])categories.set(key(oid,c.id),add('management_categories',{
        origin_id:origins.get(oid),client_key:String(c.id),name:c.name,description:c.desc||'',archived:!!c.archived,source_created_at:nil(c.createdAt)}));
      // Allocate identities before resolving recurrence and related-activity references.
      const ordered=[...s.tasks].sort((a,b)=>Number(!!b.isRecurringMaster)-Number(!!a.isRecurringMaster));
      for(const t of ordered)activities.set(String(t.id),add('activities',{
        client_id:t.id,name:t.name,scope:t.scope,origin_id:origins.get(String(t.originId)),
        milestone_id:milestones.get(key(t.originId,t.milestoneId))||null,
        deliverable_id:deliverables.get(key(t.originId,t.milestoneId,t.deliverableId))||null,
        management_category_id:categories.get(key(t.originId,t.managementCategoryId))||null,
        status:t.status,priority:t.priority||'Media',urgency:t.urgency||'Normal',estimated_duration_raw:t.time||'—',
        nature:t.nature||'unique',intake:t.intake||'planned',tentative_date:nil(t.tentativeDate),description:t.description||'',notes:t.notes||'',
        responsibility_role:t.responsibilityRole||'executor',checklist_enabled:!!t.checklistEnabled,
        closing_comments:t.closingComments||'',actual_minutes:Number(t.actualMinutes||0),actual_start:nil(t.actualStart),actual_end:nil(t.actualEnd),
        completed_date:nil(t.completedDate),completed_at:nil(t.completedAt),is_recurring_master:!!t.isRecurringMaster,
        recurrence_master_id:null,recurrence_date:nil(t.recurrenceDate),recurrence_freq:nil(t.recurrence?.freq),
        recurrence_days:t.recurrence?.days||null,recurrence_time:nil(t.recurrence?.time),recurrence_start:nil(t.recurrence?.start),recurrence_end:nil(t.recurrence?.end),
        origin_history:t.originHistory||[],postpone_history:t.postponeHistory||[],source_created_at:nil(t.createdAt)}));
      for(const t of ordered){
        out.planint_activities.find(r=>r.id===activities.get(String(t.id))).recurrence_master_id=activities.get(String(t.recurrenceMasterId))||null;
        (t.checklist||[]).forEach((i,n)=>add('checklist_items',{activity_id:activities.get(String(t.id)),client_id:i.id,
          item_text:i.text||'',done:!!i.done,completed_at:nil(i.completedAt),sort_order:n}));
        for(const h of t.scheduleHistory||[])schedules.set(key(t.id,h.id),add('schedule_history',{
          activity_id:activities.get(String(t.id)),client_id:h.id,scheduled_date:h.date,start_time:h.start||'00:00',duration_raw:h.duration||'—',
          planned_at:nil(h.plannedAt),result:h.result,generated_by_rule:!!h.generatedByRule,unplanned:!!h.unplanned,missed_at:nil(h.missedAt),
          completed_at:nil(h.completedAt),completed_date:nil(h.completedDate),rescheduled_at:nil(h.rescheduledAt),change_reason:h.changeReason||'',
          related_activity_id:activities.get(String(h.relatedTaskId))||null}));
      }
      for(const d of s.importantDates)add('important_dates',{client_id:d.id,name:d.name,scope:d.scope,event_date:d.date,event_type:d.type||'',notes:d.notes||''});
      for(const h of s.habits){
        const id=add('habits',{client_id:h.id,name:h.name,scope:h.scope,target_days:h.targetDays||[],active:h.active!==false,
          source_created_at:nil(h.createdAt),source_updated_at:nil(h.updatedAt)});
        const tracking={...Object.fromEntries(Object.keys(h.checks||{}).filter(d=>h.checks[d]).map(d=>[d,'done'])),...h.tracking};
        for(const [date,status] of Object.entries(tracking))if(status)add('habit_tracking',{habit_id:id,tracking_date:date,status,checked:status==='done'});
      }
      for(const r of s.reminders)add('reminders',{client_id:r.id,title:r.title,reminder_date:r.date,reminder_time:r.time||'00:00',scope:r.scope,note:r.note||'',
        active:r.active!==false,source_created_at:nil(r.createdAt),source_updated_at:nil(r.updatedAt)});
      for(const [scope,p] of [['work',s.workSchedule],['personal',s.personalSchedule]])if(p){
        const id=add('availability_profiles',{scope,version:p.version||1,break_minutes:Number(p.breakMinutes||0)});
        for(const d of p.days||[])add('availability_days',{profile_id:id,day_of_week:d.day,day_name:d.name,active:!!d.active,start_time:d.start||'00:00',end_time:d.end||'00:00'});
      }
      for(const b of Object.values(s.weekBaselines)){
        const bid=add('week_baselines',{client_id:b.id,week_start:b.start,week_end:b.end,confirmed_at:b.confirmedAt});
        for(const i of b.items||[])add('week_baseline_items',{baseline_id:bid,activity_id:activities.get(String(i.taskId)),schedule_history_id:schedules.get(key(i.taskId,i.scheduleId))||null,
          scheduled_date:i.date,start_time:i.start||'00:00',duration_raw:i.duration||'—',origin_id:origins.get(String(i.originId)),captured_name:i.name||'',captured_at:i.capturedAt});
      }
      for(const log of s.importLogs)add('import_logs',{payload:log});
      return out;
    }
    diff(rows) {
      const changes=[];
      for(const table of TABLES){
        const old=new Map((this.db[table]||[]).map(r=>[r.id,r])), next=new Map(rows[table].map(r=>[r.id,r]));
        const upserts=rows[table].filter(r=>stable(comparable(r))!==stable(comparable(old.get(r.id)))).map(row=>({row,expected:old.get(row.id)||null}));
        const deletes=[...old.values()].filter(r=>!next.has(r.id)).map(expected=>({id:expected.id,expected}));
        if(upserts.length||deletes.length)changes.push({table,upserts,deletes});
      }
      return changes;
    }
    committed(result) {
      for(const c of result){
        const rows=new Map((this.db[c.table]||[]).map(r=>[r.id,r]));
        for(const id of c.deleted)rows.delete(id);
        for(const r of c.rows)rows.set(r.id,r);
        this.db[c.table]=[...rows.values()];
      }
    }
  }
  const api={Repository,TABLES,stable};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PlanINTRepository=api;
})(typeof window==='object'?window:globalThis);
