const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../src/data/project-gantt.js'),C=require('../src/data/calendar-records.js');
const origin={id:10,name:'Proyecto real',type:'project',scope:'work'},structure={milestones:[{id:'h1',name:'Diseño',dueDate:'2026-11-06',status:'pending',deliverables:[{id:'e1',name:'Entregable'}]},{id:'h2',name:'Entrega',dueDate:'2026-11-20',status:'pending',deliverables:[]}]};
const parse=s=>{let h=String(s).match(/([\d.]+)\s*h/),m=String(s).match(/([\d.]+)\s*min/);return h?Number(h[1])*60:m?Number(m[1]):0};
const base={originId:10,scope:'work',nature:'unique',intake:'planned',time:'2h',checklist:[{id:1,text:'Conservar',done:true}]};
function build(tasks,extra={}){return G.build({origin,structure,tasks,records:C.records,execution:C.execution,state:C.state,parseDuration:parse,today:'2026-10-30',...extra})}
test('Real project membership and milestone/deliverable links determine groups without mutating any source data',()=>{
 const tasks=[{...base,id:1,name:'Directa',milestoneId:'h1',status:'pending'},{...base,id:2,name:'Desde entregable',deliverableId:'e1',status:'pending'},{...base,id:3,name:'Sin hito',milestoneId:'old-missing',status:'pending'},{...base,id:4,name:'Otro proyecto',originId:20,status:'pending'}],before=JSON.stringify({tasks,structure});
 const m=build(tasks);assert.equal(m.activities,3);assert.equal(m.groups[0].tasks.length,2);assert.equal(m.groups.at(-1).key,'unassigned');assert.equal(m.undated,3);assert.equal(JSON.stringify({tasks,structure}),before);
});
test('Current reprogramming has one bar and orange status; obsolete missed dates do not extend the chart',()=>{
 const m=build([{...base,id:1,name:'Reprogramada',milestoneId:'h1',status:'scheduled',scheduleHistory:[{id:1,date:'2020-01-01',result:'missed',plannedAt:'2020-01-01T00:00:00Z'},{id:2,date:'2026-11-03',start:'10:00',result:'active',duration:'2h',plannedAt:'2026-10-30T00:00:00Z'}]}]);
 const t=m.groups[0].tasks[0];assert.equal(t.start,'2026-11-03');assert.equal(t.state,'rescheduled');assert.equal(t.kind,'scheduled');assert.equal(m.groups[0].tasks.length,1);assert.equal(m.range.start,'2026-11-02');assert.equal(m.groups[0].milestone.dueDate,'2026-11-06');
});
test('Completed activities use actual execution dates and hours, not the old planned date',()=>{
 const m=build([{...base,id:1,name:'Realizada',milestoneId:'h1',status:'done',completedDate:'2026-11-03',actualStart:'12:00',actualEnd:'13:00',actualMinutes:60,scheduleHistory:[{id:1,date:'2026-10-29',start:'09:00',duration:'2h',result:'completed_late'}]}]);
 const t=m.groups[0].tasks[0];assert.equal(t.start,'2026-11-03');assert.equal(t.time,'12:00');assert.equal(t.duration,60);assert.equal(t.state,'done');assert.equal(m.groups[0].progress,100);
});
test('Tentative dates are commitment markers, not schedules, and completely undated activities remain undated',()=>{
 const m=build([{...base,id:1,name:'Compromiso',milestoneId:'h1',status:'pending',tentativeDate:'2026-11-05'},{...base,id:2,name:'Sin fecha',milestoneId:'h1',status:'pending'}]);
 const commitment=m.groups[0].tasks.find(x=>x.id===1),undated=m.groups[0].tasks.find(x=>x.id===2);assert.equal(commitment.kind,'commitment');assert.equal(commitment.duration,0);assert.equal(undated.start,null);assert.equal(undated.end,null);assert.equal(m.undated,1);
});
test('Recurring masters stay separate while real dated instances are preserved',()=>{
 const m=build([{...base,id:1,name:'Regla',isRecurringMaster:true,status:'recurring',recurrence:{freq:'weekly'}},{...base,id:2,name:'Instancia',milestoneId:'h1',recurrenceMasterId:1,status:'scheduled',scheduleHistory:[{id:1,date:'2026-11-04',start:'10:00',result:'active',duration:'1h'}]}]);assert.equal(m.masters.length,1);assert.equal(m.activities,1);assert.equal(m.groups[0].tasks[0].id,2);
});
test('Night executions and date arithmetic survive DST without changing stored milestone deadlines',()=>{const m=build([{...base,id:1,name:'Nocturna',milestoneId:'h1',status:'scheduled',scheduleHistory:[{id:1,date:'2026-10-31',start:'23:00',duration:'2h',result:'active'}]}]);assert.equal(m.groups[0].tasks[0].end,'2026-11-01');assert.equal(m.groups[0].milestone.dueDate,'2026-11-06');assert.equal(G.validDate('2026-02-30'),false)});
test('Empty projects have no invented tasks or spans; month/week axes stay bounded for long projects',()=>{const empty=build([],{structure:{milestones:[]}});assert.equal(empty.groups.length,0);assert.equal(empty.hasDates,false);assert.equal(empty.range.days,7);const range={start:'2000-01-01',end:'2030-12-31',days:G.day('2030-12-31')-G.day('2000-01-01')+1};assert.ok(G.ticks(range,'weeks').length<=20);assert.ok(G.ticks(range,'months').length<=20);const p=G.position({start:'2026-10-26',end:'2026-11-01',days:7},'2026-10-30');assert.equal(p.left,4/7*100);assert.equal(p.width,100/7)});
