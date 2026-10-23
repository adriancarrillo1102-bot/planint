const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Actions=require('../src/data/activity-actions.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function fixture(){return {tasks:[
  {id:1,name:'Maestro',isRecurringMaster:true,scope:'work',recurrence:{freq:'daily',start:'2026-10-20',end:'',excludedDates:[]}},
  {id:2,name:'Anterior',recurrenceMasterId:1,recurrenceDate:'2026-10-22',status:'done'},
  {id:3,name:'Hoy',recurrenceMasterId:1,recurrenceDate:'2026-10-23',status:'scheduled'},
  {id:4,name:'Futura',recurrenceMasterId:1,recurrenceDate:'2026-10-24',status:'scheduled'},
  {id:5,name:'Ajena',scope:'personal',scheduleHistory:[{id:51,relatedTaskId:3,date:'2026-10-23',result:'active'}]},
  {id:6,name:'Realizada anticipadamente',recurrenceMasterId:1,recurrenceDate:'2026-10-25',status:'done'}],
  weekBaselines:{week:{items:[{taskId:3},{taskId:5}]}},workSchedule:{timeBlocks:[]},personalSchedule:{timeBlocks:[]}}}
test('Delete only one occurrence adds a durable exception, clears related refs, preserves other dates and input',()=>{
  const original=fixture(),s=Actions.deleteActivity(original,3,'occurrence');
  assert.equal(original.tasks.length,6);assert.equal(s.tasks.length,5);
  assert.deepEqual(s.tasks.find(t=>t.id===1).recurrence.excludedDates,['2026-10-23']);
  assert.equal(s.tasks.find(t=>t.id===5).scheduleHistory[0].relatedTaskId,null);
  assert.deepEqual(s.weekBaselines.week.items,[{taskId:5}]);assert.ok(s.tasks.find(t=>t.id===4));
});
test('Delete a series removes only its master and children, with no orphan baseline references',()=>{
  const s=Actions.deleteActivity(fixture(),3,'series');assert.deepEqual(s.tasks.map(t=>t.id),[5]);
  assert.deepEqual(s.weekBaselines.week.items,[{taskId:5}]);assert.equal(s.tasks[0].scheduleHistory[0].relatedTaskId,null);
});
test('Conversion preserves prior and completed history, ends the master, removes only pending future and adds a block',()=>{
  const block={id:'b1',title:'Comida',startDate:'2026-10-23'};
  const s=Actions.convert(fixture(),3,'2026-10-23',block,'work');
  assert.deepEqual(s.tasks.map(t=>t.id),[1,2,5,6]);assert.equal(s.tasks[0].recurrence.stopFrom,'2026-10-23');assert.equal(s.tasks[0].recurrence.end,'');
  assert.deepEqual(s.workSchedule.timeBlocks,[block]);assert.deepEqual(s.personalSchedule.timeBlocks,[]);
});
test('Single activity with prior execution cannot be converted destructively',()=>{
  const s=fixture();s.tasks.push({id:9,status:'done',scheduleHistory:[]});
  assert.throws(()=>Actions.convert(s,9,'2026-10-23',{},'work'),/historial/);
  s.tasks[6].status='pending';s.tasks[6].scheduleHistory=[{date:'2026-10-22',result:'missed'}];
  assert.throws(()=>Actions.convert(s,9,'2026-10-23',{},'work'),/historial/);
});
test('The actual Delete button invokes the exported API, not the private closure function',()=>{
  const binding=html.match(/document\.getElementById\('activityDetailDelete'\)\.onclick=([\s\S]*?);document\.getElementById\('activityDetailSave'\)/)[1];
  let calls=0;const ctx={window:{PlanINTCloud:{deleteActivity:()=>calls++}},alert:()=>{}};
  vm.createContext(ctx);vm.runInContext('('+binding+')()',ctx);assert.equal(calls,1);
  ctx.window.PlanINTCloud=null;assert.doesNotThrow(()=>vm.runInContext('('+binding+')()',ctx));
});
test('The actual recurrence matcher does not regenerate a removed occurrence, including after JSON reload',()=>{
  const code=html.slice(html.indexOf('function recurrenceMatches('),html.indexOf('function generateRecurringOccurrences('));
  const ctx={isoDate:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};vm.createContext(ctx);vm.runInContext(code,ctx);
  const s=JSON.parse(JSON.stringify(Actions.deleteActivity(fixture(),3,'occurrence'))),rule=s.tasks[0].recurrence;
  assert.equal(ctx.recurrenceMatches(rule,new Date('2026-10-23T12:00:00')),false);
  assert.equal(ctx.recurrenceMatches(rule,new Date('2026-10-24T12:00:00')),true);
});
test('Missing task, missing master or unspecified series scope fail without modifying the snapshot',()=>{
  const s=fixture();assert.throws(()=>Actions.deleteActivity(s,99,'single'));
  assert.throws(()=>Actions.deleteActivity(s,1,'occurrence'));
  s.tasks.shift();assert.throws(()=>Actions.deleteActivity(s,3,'occurrence'));
});
