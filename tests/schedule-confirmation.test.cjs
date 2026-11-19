const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../src/data/calendar-records.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function setup(){
 const fields=new Map(),get=id=>{if(!fields.has(id))fields.set(id,{value:'',dataset:{},disabled:false,textContent:'',listeners:{},setAttribute(){},focus(){},addEventListener(e,fn){this.listeners[e]=fn},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()}});return fields.get(id)};
 const task={id:1,name:'Actividad real',status:'scheduled',time:'1h',scheduleHistory:[{id:10,date:'2026-11-18',start:'09:00',duration:'1h',result:'active'}],checklist:[{id:9,text:'Conservar',done:true}]};
 const calls=[],ctx={window:{PlanINTCalendarRecords:C},document:{body:{insertAdjacentHTML(){}},getElementById:get,activeElement:{focus(){}}},tasks:[task],scheduleTaskId:1,isoDate:()=> '2026-11-19',formatDateES:x=>x,scheduleProposalState:()=>({ok:true}),uid:()=>11,save:()=>calls.push('save'),refreshVisibleSurface(){},closeModal(){},renderAll(){},renderScheduleDayLoad(){}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../src/ui/schedule-confirmation.js'),'utf8'),ctx);
 vm.runInContext(html.split('\n').find(l=>l.startsWith("document.getElementById('saveSchedule').onclick=")),ctx);
 get('scheduleDate').value='2026-11-20';get('scheduleStart').value='10:30';
 return {ctx,get,task,calls,click:()=>get('saveSchedule').onclick()};
}
test('No data changes before explicit in-app confirmation; double clicks persist exactly one new schedule',async()=>{
 const {get,task,calls,click}=setup(),before=JSON.stringify(task),pending=click();assert.equal(get('scheduleConfirmDialog').open,true);assert.equal(JSON.stringify(task),before);assert.equal(calls.length,0);await click();
 get('scheduleConfirmAccept').onclick();get('scheduleConfirmAccept').onclick();await pending;
 assert.equal(calls.length,1);assert.equal(task.scheduleHistory.length,2);assert.equal(task.scheduleHistory[1].date,'2026-11-20');assert.equal(task.scheduleHistory[1].start,'10:30');assert.equal(task.scheduleHistory[0].result,'rescheduled');assert.equal(task.checklist[0].done,true);
});
test('Cancel and Escape leave activity and schedule history intact and allow retry',async()=>{
 for(const action of ['cancel','escape']){const {get,task,calls,click}=setup(),before=JSON.stringify(task),pending=click();if(action==='cancel')get('scheduleConfirmCancel').onclick();else get('scheduleConfirmDialog').listeners.cancel({preventDefault(){}});await pending;assert.equal(JSON.stringify(task),before);assert.equal(calls.length,0);assert.equal(get('saveSchedule').dataset.confirming,undefined);const retry=click();get('scheduleConfirmCancel').onclick();await retry;}
});
test('Availability and conflict validation runs again at confirmation; failure never retires the original schedule',async()=>{
 const {ctx,get,task,calls,click}=setup(),before=JSON.stringify(task),pending=click();ctx.scheduleProposalState=()=>({ok:false,reason:'Horario no disponible: Comida.'});get('scheduleConfirmAccept').onclick();await pending;assert.equal(JSON.stringify(task),before);assert.equal(calls.length,0);assert.match(get('scheduleValidation').textContent,/Comida/);
});
test('Invalid initial proposal, concurrent task updates and changed form fields cannot save stale consent',async()=>{
 const invalid=setup();invalid.ctx.scheduleProposalState=()=>({ok:false,reason:'Conflicto de horario'});await invalid.click();assert.equal(invalid.get('scheduleConfirmDialog').open,undefined);assert.equal(invalid.calls.length,0);
 for(const changed of ['task','field','deleted']){const {ctx,get,task,calls,click}=setup(),pending=click();if(changed==='task')task.name='Actualizada en otro dispositivo';else if(changed==='field')get('scheduleStart').value='11:00';else ctx.tasks=[];get('scheduleConfirmAccept').onclick();await pending;assert.equal(calls.length,0);assert.equal(task.scheduleHistory.length,1);assert.match(get('scheduleValidation').textContent,/datos cambiaron/);}
});
