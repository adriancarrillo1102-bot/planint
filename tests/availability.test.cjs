const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../src/data/availability.js');
const date='2026-10-23';
const block=(extra={})=>({id:'b1',title:'Comida',startDate:date,endDate:'',startTime:'13:00',endTime:'14:00',freq:'weekly',days:[0,1,2,3,4],allDay:false,replacesBreak:false,excludedDates:[],...extra});
const profile=(blocks=[],pause=0,start='08:00',end='17:00')=>({breakMinutes:pause,days:Array.from({length:7},(_,day)=>({day,active:day<5,start,end})),timeBlocks:blocks});
test('Lunch consumes availability, not activity time; replaces an existing generic pause once',()=>{
  assert.equal(A.capacity(profile([block()]),date),480);
  assert.equal(A.capacity(profile([],60),date),480);
  assert.equal(A.capacity(profile([block({replacesBreak:true})],60),date),480);
  assert.equal(A.capacity(profile([block({endTime:'13:30',replacesBreak:true})],60),date),480);
  assert.equal(A.capacity(profile([block()],60),date),420); // Explicitly separate pauses.
});
test('An all-day holiday affects only that date and its own profile',()=>{
  const p=profile([block({title:'Feriado',freq:'none',allDay:true})],60);
  assert.equal(A.capacity(p,date),0);assert.equal(A.capacity(p,'2026-10-26'),480);
  const personal=profile([],0,'17:00','22:00');assert.equal(A.capacity(personal,date),300);
  assert.equal(A.generalCapacity([p,personal],date),300);
});
test('Overlapping cuts are merged; outside hours do not subtract capacity',()=>{
  assert.equal(A.capacity(profile([block(),block({id:'b2',startTime:'13:30',endTime:'14:30'})]),date),450);
  assert.equal(A.capacity(profile([block({startTime:'20:00',endTime:'21:00'})]),date),540);
});
test('General availability unions remaining scope intervals and does not cancel personal time for a work block',()=>{
  const work=profile([block()],0,'08:00','17:00'),personal=profile([],0,'12:00','18:00');
  assert.equal(A.generalCapacity([work,personal],date),600);
  assert.equal(A.generalCapacity([profile([],60),profile([],60)],date),480);
});
test('Calendar day arithmetic survives DST and year boundaries without UTC shifts',()=>{
  assert.equal(A.shift('2026-12-31',1),'2027-01-01');assert.equal(A.shift('2026-11-01',-1),'2026-10-31');
  assert.equal(A.shift('2026-03-08',1),'2026-03-09');assert.equal(A.validDate('2026-02-30'),false);
});
test('Night blocks spill to the next calendar day; exclusions apply to the originating occurrence',()=>{
  const p=profile([block({freq:'none',startTime:'23:00',endTime:'02:00'})]);
  assert.deepEqual(A.occurrences(p,date).map(({start,end})=>[start,end]),[[1380,1440]]);
  assert.deepEqual(A.occurrences(p,'2026-10-24').map(({start,end})=>[start,end]),[[0,120]]);
  assert.equal(A.conflicts(p,date,1410,120).length,2);
  p.timeBlocks[0].excludedDates=[date];assert.equal(A.occurrences(p,'2026-10-24').length,0);
});
test('Night availability clips both sides by calendar date',()=>{
  const p=profile([],0,'22:00','06:00');
  assert.equal(A.capacity(p,date),480); // Previous Thursday + Friday.
  assert.equal(A.capacity(p,'2026-10-24'),360); // Friday carry, no Saturday shift.
  assert.equal(A.capacity(p,'2026-10-25'),0);
});
test('A long night shift receives its legacy pause only once; an explicit meal replaces that same pause across midnight',()=>{
  const p=profile([],60,'18:00','08:00');p.days.forEach(d=>d.active=d.day===4);
  assert.equal(A.capacity(p,date)+A.capacity(p,'2026-10-24'),780);
  p.timeBlocks=[block({freq:'none',startTime:'19:00',endTime:'20:00',replacesBreak:true})];
  assert.equal(A.capacity(p,date),300);assert.equal(A.capacity(p,'2026-10-24'),480);
});
test('Recurrence boundaries, dates and day exclusions are inclusive',()=>{
  const p=profile([block({endDate:'2026-10-26',excludedDates:[date]})]);
  assert.equal(A.occurrences(p,date).length,0);assert.equal(A.occurrences(p,'2026-10-26').length,1);
  assert.equal(A.occurrences(p,'2026-10-27').length,0);
});
test('Touching endpoints are allowed, a real overlap is rejected',()=>{
  const p=profile([block()]);
  assert.equal(A.conflicts(p,date,12*60,60).length,0);assert.equal(A.conflicts(p,date,14*60,60).length,0);
  assert.equal(A.conflicts(p,date,12*60+30,60).length,1);
});
test('Actual execution during a blocked lunch or holiday is classified outside availability',()=>{
  assert.equal(A.executionInside(profile([block()]),date,12*60+30,120),60);
  assert.equal(A.executionInside(profile([block({allDay:true,freq:'none'})]),date,9*60,60),0);
  const p=profile([],0,'22:00','06:00');assert.equal(A.executionInside(p,date,23*60,120),120);
});
test('Validate malformed dates, empty week days and equal hours',()=>{
  assert.equal(A.validate(block()),'');assert.ok(A.validate(block({startDate:'2026-02-30'})));
  assert.ok(A.validate(block({days:[]})));assert.ok(A.validate(block({endTime:'13:00'})));
  assert.ok(A.validate(block({endDate:'2026-10-22'})));assert.ok(A.validate(block({startTime:'25:00'})));
});
