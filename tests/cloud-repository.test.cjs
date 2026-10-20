const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Repository,TABLES}=require('../src/data/cloud-repository.js');
const schema=JSON.parse(fs.readFileSync(require.resolve('../schema-inspection.json'),'utf8')).tables;
let counter=0; const uuid=()=>`00000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`;
const user='00000000-0000-4000-8000-999999999999';
function fixture(){return {
 projects:[{id:1,name:'Proyecto',type:'project',scope:'personal'},{id:2,name:'Gestión',type:'management',scope:'work'}],
 projectStructures:{1:{milestones:[{id:'m1',name:'Hito',deliverables:[{id:'d1',name:'Entregable'}]}]}},
 managementStructures:{2:{categories:[{id:'c1',name:'Categoría'}]}},
 tasks:[{id:10,name:'Actividad',scope:'personal',originId:1,milestoneId:'m1',deliverableId:'d1',status:'scheduled',
   checklistEnabled:true,checklist:[{id:11,text:'Paso',done:true}],scheduleHistory:[{id:12,date:'2026-10-21',start:'10:00',duration:'1 h',result:'active'}]},
   {id:20,name:'Maestro',scope:'work',originId:2,managementCategoryId:'c1',status:'recurring',isRecurringMaster:true,recurrence:{freq:'weekly',days:[1],time:'08:00',start:'2026-10-20'}},
   {id:21,name:'Instancia',scope:'work',originId:2,status:'pending',recurrenceMasterId:20,recurrenceDate:'2026-10-21'}],
 importantDates:[{id:30,name:'Fecha',scope:'personal',date:'2026-10-21'}],
 habits:[{id:40,name:'Hábito',scope:'personal',targetDays:[1,3],active:false,tracking:{'2026-10-20':'done','2026-10-21':'skipped'}}],
 reminders:[{id:50,title:'Recordatorio',scope:'work',date:'2026-10-21',time:'09:00'}],
 workSchedule:{version:1,breakMinutes:0,days:[{day:0,name:'Lunes',active:true,start:'08:00',end:'17:00'}]},personalSchedule:null,
 weekBaselines:{'2026-10-19':{id:60,start:'2026-10-19',end:'2026-10-25',confirmedAt:'2026-10-20T10:00:00Z',items:[{taskId:10,scheduleId:12,originId:1,date:'2026-10-21',start:'10:00',name:'Actividad',capturedAt:'2026-10-20T10:00:00Z'}]}},
 importLogs:[{name:'importación',count:3}]
}}
test('Maps all entities to real columns, with owned and valid parent references',()=>{
 const repo=new Repository(uuid), rows=repo.normalize(fixture(),user);
 assert.deepEqual(Object.keys(rows),TABLES);
 for(const [table,items]of Object.entries(rows))for(const r of items){
   assert.equal(r.user_id,user);assert.ok(r.id);
   const cols=schema.find(t=>t.name==='public.'+table).columns;
   for(const k of Object.keys(r))assert.ok(cols.some(c=>c.name===k),`${table}.${k}`);
   for(const c of cols.filter(c=>!c.options.includes('nullable')&&!c.default_value))assert.notEqual(r[c.name],undefined,`${table}.${c.name} required`);
 }
 const task=rows.planint_activities.find(t=>t.client_id===10);
 assert.equal(rows.planint_checklist_items[0].activity_id,task.id);
 assert.equal(rows.planint_week_baseline_items[0].schedule_history_id,rows.planint_schedule_history[0].id);
 assert.equal(rows.planint_activities.find(t=>t.client_id===21).recurrence_master_id,rows.planint_activities.find(t=>t.client_id===20).id);
});
test('New identity is stable across retries; only changed records are patched',()=>{
 const repo=new Repository(uuid), s=fixture(), rows=repo.normalize(s,user);
 assert.deepEqual(repo.normalize(s,user),rows);
 repo.accept(rows);assert.equal(repo.diff(repo.normalize(s,user)).length,0);
 s.tasks[0].name='Editada';const changes=repo.diff(repo.normalize(s,user));
 assert.equal(changes.length,1);assert.equal(changes[0].table,'planint_activities');assert.equal(changes[0].upserts.length,1);
 assert.equal(changes[0].upserts[0].expected.name,'Actividad');
});
test('Removing a checklist item deletes only that known item',()=>{
 const repo=new Repository(uuid),s=fixture();repo.accept(repo.normalize(s,user));s.tasks[0].checklist=[];
 const changes=repo.diff(repo.normalize(s,user));assert.equal(changes.length,1);assert.equal(changes[0].deletes.length,1);assert.equal(changes[0].upserts.length,0);
});
test('Committed server timestamps and times do not generate repeated writes',()=>{
 const repo=new Repository(uuid),s=fixture();s.tasks[0].createdAt='2026-10-20T10:00:00Z';
 const db=repo.normalize(s,user);db.planint_activities.find(t=>t.client_id===10).source_created_at='2026-10-20T10:00:00+00:00';
 db.planint_schedule_history[0].start_time='10:00:00';repo.accept(db);
 assert.equal(repo.diff(repo.normalize(s,user)).length,0);
});
test('Existing UI hydration round-trips relations, recurrence, tracking, and schedule',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const fn=html.slice(html.indexOf('function buildSnapshot(db){'),html.indexOf('function cacheSnapshot(s){'));
 const context={byId:rows=>new Map(rows.map(r=>[String(r.id),r])),sourceIso:r=>r.source_created_at||r.created_at||'2026-10-20T10:00:00Z',timeHM:v=>v?String(v).slice(0,5):'',isoOrNull:v=>v||null};
 vm.createContext(context);vm.runInContext(fn,context);
 const repo=new Repository(uuid),rows=repo.normalize(fixture(),user),s=context.buildSnapshot(rows);
 assert.equal(s.tasks.find(t=>t.id===10).checklist[0].text,'Paso');
 assert.equal(s.tasks.find(t=>t.id===10).deliverableId,'d1');
 assert.equal(s.tasks.find(t=>t.id===21).recurrenceMasterId,20);
 assert.equal(s.habits[0].active,false);assert.equal(s.habits[0].tracking['2026-10-21'],'skipped');
 assert.equal(s.weekBaselines['2026-10-19'].items[0].taskId,10);
});
test('Every inline script parses without executing the app',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
});
