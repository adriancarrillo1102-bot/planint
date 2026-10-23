const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../src/data/completion-actions.js');
const now='2026-10-23T20:00:00Z',today='2026-10-23';
function fixture(){return {tasks:[{id:1,status:'done',completedAt:'2026-10-22T21:00:00Z',completedDate:'2026-10-22',actualStart:'09:00',actualEnd:'11:00',actualMinutes:120,closingComments:'Resultado',recurrenceMasterId:2,checklist:[{id:3,done:true}],scheduleHistory:[{id:4,date:'2026-10-22',start:'09:00',result:'completed',completedDate:'2026-10-22'}]},{id:2,isRecurringMaster:true,status:'recurring'},{id:5,status:'scheduled'}],weekBaselines:{keep:'original'}}}
test('Correct 09:00 to 10:00, recalculate actual time and preserve original schedule and closure audit',()=>{
 const s=fixture(),n=A.change(s,1,{date:'2026-10-22',start:'10:00',end:'11:00',comments:'Resultado'},now,today),t=n.tasks[0];
 assert.equal(t.actualMinutes,60);assert.equal(t.status,'done');assert.equal(t.completedAt,s.tasks[0].completedAt);assert.equal(t.scheduleHistory[0].start,'09:00');assert.deepEqual(t.checklist,s.tasks[0].checklist);assert.equal(t.completionHistory[0].before.actualStart,'09:00');assert.equal(s.tasks[0].actualStart,'09:00');assert.deepEqual(n.tasks.slice(1),s.tasks.slice(1));assert.deepEqual(n.weekBaselines,s.weekBaselines);
});
test('Changing completion date updates early/late accounting',()=>{const n=A.change(fixture(),1,{date:'2026-10-23',start:'10:00',end:'11:00'},now,today);assert.equal(n.tasks[0].scheduleHistory[0].result,'completed_late')});
test('Reopen retains history and checklist, clears actual totals and restores missed schedule',()=>{const s=fixture(),t=A.change(s,1,null,now,today).tasks[0];assert.equal(t.status,'missed');assert.equal(t.actualMinutes,0);assert.equal(t.completedAt,null);assert.equal(t.scheduleHistory[0].result,'missed');assert.equal(t.completionHistory[0].before.closingComments,'Resultado');assert.deepEqual(t.checklist,s.tasks[0].checklist)});
test('Reopen future schedule stays scheduled, unscheduled stays pending',()=>{const s=fixture();s.tasks[0].scheduleHistory[0].date='2026-10-24';assert.equal(A.change(s,1,null,now,today).tasks[0].status,'scheduled');s.tasks[0].scheduleHistory=[];assert.equal(A.change(s,1,null,now,today).tasks[0].status,'pending')});
test('Reject non-completed tasks, masters, impossible dates and times without changing source',()=>{for(const id of [2,5,99])assert.throws(()=>A.change(fixture(),id,null,now,today));for(const v of [{date:'2026-02-30',start:'10:00',end:'11:00'},{date:today,start:'25:00',end:'11:00'},{date:today,start:'10:00',end:'10:00'}])assert.throws(()=>A.change(fixture(),1,v,now,today))});
test('Overnight execution follows the existing next-day semantics',()=>assert.equal(A.minutes('23:30','00:30'),60));
