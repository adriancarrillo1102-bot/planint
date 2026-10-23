const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/ui/time-blocks.js'),'utf8');
test('All literal modal open/close targets exist, including reminders after cloud deletion',()=>{
  const source=html+'\n'+ui,ids=new Set([...source.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const m of source.matchAll(/(?:openModal|closeModal)\('([^']+)'\)/g))assert.ok(ids.has(m[1]),'Missing modal '+m[1]);
});
test('New scripts and styles resolve locally and UI modules parse',()=>{
  for(const m of html.matchAll(/(?:src|href)="(src\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
  new vm.Script(ui);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
});
test('Availability editor keeps unknown and new profile properties while saving its base hours',()=>{
  const start=html.indexOf('function saveWorkSchedule(){'),end=html.indexOf('/* V11.5 · bindings',start);
  const profile={version:1,breakMinutes:0,timeBlocks:[{id:'meal'}],futureProperty:'preserve',days:[{name:'Lunes',active:true,start:'08:00',end:'17:00'}]};
  const ctx={editingAvailabilityScope:'work',availabilityScheduleForScope:()=>profile,workSchedule:profile,
    document:{querySelector:s=>s.includes('active')?{checked:true}:{value:s.includes('start')?'08:00':'17:00'},getElementById:()=>({value:'60'})},save(){},refreshVisibleSurface(){},closeModal(){},renderAll(){}};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);ctx.saveWorkSchedule();
  assert.equal(ctx.workSchedule.timeBlocks[0].id,'meal');assert.equal(ctx.workSchedule.futureProperty,'preserve');assert.equal(ctx.workSchedule.breakMinutes,60);
});
test('Blocked times reject programming in the actual scheduling validator',()=>{
  const code=html.slice(html.indexOf('function scheduleProposalState(){'),html.indexOf('function scheduleTimelineSegmentHTML('));
  const fields={scheduleDate:{value:'2026-10-23'},scheduleStart:{value:'13:00'}};
  const ctx={tasks:[{id:1,scope:'work',time:'1h'}],scheduleTaskId:1,document:{getElementById:id=>fields[id]},parseDuration:()=>60,
    availabilityGrossInterval:()=>({start:480,end:1020}),availabilityCapacityMinutes:()=>480,minutesFromTime:()=>780,
    scheduleNormalizeStartForAvailability:x=>x,availabilityBlockConflicts:()=>[{block:{title:'Comida'}}]};
  vm.createContext(ctx);vm.runInContext(code,ctx);const result=ctx.scheduleProposalState();assert.equal(result.ok,false);assert.match(result.reason,/Comida/);
});
test('Restore only declares cloud success after awaiting the persistence boundary',()=>{
  const code=html.slice(html.indexOf('async function restoreBackupPayload(){'),html.indexOf("document.getElementById('downloadBackupBtn').onclick"));
  assert.match(code,/submitted=true;await window\.PlanINTCloud\.flush\(\)/);
  assert.ok(code.indexOf('submitted=true;await')<code.indexOf("alert('Restauración completada y guardada en la nube."));
  assert.match(code,/if\(submitted\)/);
});
test('Reminder deletion reads its private editor state only through the public editor API',async()=>{
  const code=html.slice(html.indexOf('async function deleteReminderCloudAware(){'),html.indexOf('async function logout(){'));
  const calls=[];const ctx={reminders:[{id:12,title:'QA'}],confirm:()=>true,console,
    window:{PlanINTEntityEditors:{getReminderId:()=>12,clearReminder:()=>calls.push('closed')}},
    cloudDeleteByClient:async(table,id)=>calls.push([table,id]),rehydrateAfterCloudChange:async()=>calls.push('refreshed'),alert:message=>{throw Error(message)}};
  vm.createContext(ctx);vm.runInContext(code,ctx);await ctx.deleteReminderCloudAware();
  assert.deepEqual(calls,[['planint_reminders',12],'closed','refreshed']);
});
test('Habit deletion and date deletion invoke the proper cloud entities and preserve failure visibility',async()=>{
  const code=html.slice(html.indexOf('async function deleteImportantCloudAware(){'),html.indexOf('async function deleteReminderCloudAware(){'));
  const calls=[];const ctx={editingHabitId:12,editingImportantId:13,habits:[{id:12,name:'QA hábito'}],importantDates:[{id:13,name:'QA fecha'}],confirm:()=>true,console,
    cloudDeleteByClient:async(table,id)=>calls.push([table,id]),rehydrateAfterCloudChange:async()=>{},closeModal:id=>calls.push(id),alert:message=>{throw Error(message)}};
  vm.createContext(ctx);vm.runInContext(code,ctx);await ctx.deleteHabitCloudAware();await ctx.deleteImportantCloudAware();
  assert.deepEqual(calls,[['planint_habits',12],'habitModal',['planint_important_dates',13],'importantModal']);
});
