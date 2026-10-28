const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/data/calendar-records.js');
const parse=s=>{const h=String(s).match(/([\d.]+)\s*h/),m=String(s).match(/(\d+)\s*min/);return h?Number(h[1])*60:m?Number(m[1]):0};
const old={id:1,date:'2026-10-26',start:'09:00',duration:'2h',result:'missed',plannedAt:'2026-10-25T10:00:00Z',missedAt:'2026-10-27T10:00:00Z'};
const fresh={id:2,date:'2026-10-28',start:'10:00',duration:'2h',result:'active',plannedAt:'2026-10-28T10:00:00Z'};
test('A missed plan reprogrammed on another date occupies only the new slot, including existing cloud records',()=>{
 const t={id:10,status:'scheduled',scheduleHistory:[old,fresh]},before=JSON.stringify(t);
 assert.deepEqual(A.records(t,parse),[fresh]);assert.equal(JSON.stringify(t),before);
 assert.deepEqual(A.records({...t,scheduleHistory:[fresh,old]},parse),[fresh]);
});
test('One unreprogrammed missed activity remains visible in red, masters never occupy slots',()=>{assert.equal(A.records({status:'missed',scheduleHistory:[old]},parse)[0].result,'missed');assert.deepEqual(A.records({isRecurringMaster:true,scheduleHistory:[fresh]},parse),[])});
test('Saving a reprogramming retires active and missed records, preserving dates and previous misses',()=>{
 const t={scheduleHistory:[{...old},{...fresh}]};A.retirePrevious(t,'2026-10-28T20:00:00Z','Otra actividad',30);
 assert.ok(t.scheduleHistory.every(x=>x.result==='rescheduled'));assert.equal(t.scheduleHistory[0].missedAt,old.missedAt);assert.equal(t.scheduleHistory[0].date,old.date);assert.equal(t.scheduleHistory[0].relatedTaskId,30);
});
test('Bank closure without a plan becomes one completed slot at real hours and actual duration',()=>{
 const t={id:10,status:'done',intake:'planned',completedDate:'2026-10-27',actualStart:'12:00',actualEnd:'14:00',actualMinutes:120,time:'3h',scheduleHistory:[]},before=JSON.stringify(t),s=A.records(t,parse)[0];
 assert.equal(s.date,'2026-10-27');assert.equal(s.start,'12:00');assert.equal(parse(s.duration),120);assert.equal(s.result,'completed');assert.equal(s.executionOnly,true);assert.equal(JSON.stringify(t),before);
});
test('Legacy closure derives a two-hour slot ending at the local closure time, without changing its original data',()=>{
 const t={id:10,status:'done',time:'2h',completedAt:new Date(2026,9,27,14,0).toISOString(),scheduleHistory:[]},s=A.records(t,parse)[0];assert.equal(s.date,'2026-10-27');assert.equal(s.start,'12:00');assert.equal(s.inferredTime,true);
});
test('Correcting or reopening immediately moves or removes the derived slot; scheduled completions are not duplicated',()=>{
 const t={id:10,status:'done',completedDate:'2026-10-27',actualStart:'12:00',actualMinutes:120,scheduleHistory:[]};
 t.completedDate='2026-10-28';t.actualStart='10:00';assert.equal(A.records(t,parse)[0].date,'2026-10-28');assert.equal(A.records(t,parse)[0].start,'10:00');
 t.status='pending';assert.deepEqual(A.records(t,parse),[]);t.status='done';t.scheduleHistory=[{...fresh,result:'completed'}];assert.equal(A.records(t,parse).length,1);assert.equal(A.records(t,parse)[0].executionOnly,undefined);
});
test('Two recurring occurrences stay separate, old postponed plans do not reappear',()=>{assert.equal(A.records({id:10,recurrenceMasterId:1,scheduleHistory:[fresh]},parse).length,1);assert.equal(A.records({id:11,recurrenceMasterId:1,scheduleHistory:[fresh]},parse).length,1);assert.deepEqual(A.records({status:'postponed',scheduleHistory:[old,{...fresh,result:'postponed'}]},parse),[])});
function appContext(tasks){
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),ctx={tasks,scope:'work',window:{PlanINTCalendarRecords:A},parseDuration:parse,visibleTasks:()=>tasks,visible:()=>[],importantDates:[],availabilityCapacityForScope:()=>480};
 vm.createContext(ctx);
 for(const name of ['calendarRecordsForTask','planRecordForDate','schedulesForDate','eventsForDate','resolvedPlannedMinutes']){const start=html.indexOf('function '+name+'('),tail=html.indexOf('\nfunction ',start+1);vm.runInContext(html.slice(start,tail),ctx)}
 const start=html.indexOf('function scheduleCommitmentClosed('),end=html.indexOf('function trackingBreakdownForWeek(',start);vm.runInContext(html.slice(start,end),ctx);return ctx;
}
test('Actual calendar, weekly capacity and scheduling load share one projection and consume exactly two hours',()=>{
 const t={id:10,status:'done',scope:'work',intake:'planned',completedDate:'2026-10-27',actualStart:'12:00',actualMinutes:120,time:'2h',scheduleHistory:[]},c=appContext([t]);
 assert.equal(c.eventsForDate('2026-10-27').length,1);assert.equal(c.schedulesForDate('2026-10-27').length,1);assert.equal(c.trackingBreakdownForDate('2026-10-27').occupied,120);assert.equal(c.trackingBreakdownForDate('2026-10-27').free,360);
 assert.equal(c.trackingBreakdownForDate('2026-10-26').occupied,0);
});
test('Existing duplicated history releases the old day in the actual calendar and availability totals',()=>{const c=appContext([{id:10,scope:'work',intake:'planned',status:'scheduled',scheduleHistory:[old,fresh]}]);assert.equal(c.eventsForDate('2026-10-26').length,0);assert.equal(c.trackingBreakdownForDate('2026-10-26').occupied,0);assert.equal(c.eventsForDate('2026-10-28').length,1);assert.equal(c.trackingBreakdownForDate('2026-10-28').occupied,120)});
test('The real reprogramming button retires a missed record and retains its history through cloud serialization',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),line=html.split('\n').find(x=>x.startsWith("document.getElementById('saveSchedule').onclick="));
 const task={id:10,status:'missed',time:'2h',scheduleHistory:[{...old}]},fields={saveSchedule:{},scheduleDate:{value:'2026-10-28'},scheduleStart:{value:'10:00'},scheduleChangeReason:{value:'Otra actividad'},scheduleCauseTask:{value:'30'}};
 const ctx={tasks:[task],scheduleTaskId:10,window:{PlanINTCalendarRecords:A},document:{getElementById:id=>fields[id]},isoDate:()=> '2026-10-28',scheduleProposalState:()=>({ok:true}),confirm:()=>true,formatDateES:x=>x,uid:()=>2,save(){},refreshVisibleSurface(){},closeModal(){},renderAll(){},alert:m=>{throw Error(m)}};
 vm.createContext(ctx);vm.runInContext(line,ctx);fields.saveSchedule.onclick();
 const restored=JSON.parse(JSON.stringify(task));assert.equal(restored.scheduleHistory[0].result,'rescheduled');assert.equal(restored.scheduleHistory[0].missedAt,old.missedAt);assert.equal(restored.scheduleHistory.length,2);assert.equal(A.records(restored,parse).length,1);assert.equal(A.records(restored,parse)[0].date,'2026-10-28');
});
test('Calendar color precedence: planned grey, reprogrammed orange, missed red, completed green and unplanned yellow',()=>{
 const t={status:'scheduled',intake:'planned',scheduleHistory:[old,fresh]};assert.equal(A.state(t,fresh),'rescheduled');
 assert.equal(A.state({...t,scheduleHistory:[fresh]},fresh),'pending');assert.equal(A.state({...t,status:'missed'},{...fresh,result:'missed'}),'missed');assert.equal(A.state({...t,status:'done'},{...fresh,result:'completed'}),'done');assert.equal(A.state({...t,intake:'unplanned',status:'done'},fresh),'unplanned');
});
