const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const api=require('../src/data/cloud-repository.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const code=html.slice(html.indexOf('const repository=new window.PlanINTRepository.Repository();'),html.indexOf('function timeHM(v)'));
function harness(rpc){
 const memory=new Map(), states=[];
 const context={console,crypto:require('node:crypto').webcrypto,PlanINTRepository:api,hydrated:true,client:{rpc},
   tasks:[],projects:[{id:1,name:'Otro',scope:'personal',type:'other'}],projectStructures:{},managementStructures:{},
   habits:[],reminders:[],importantDates:[],importLogs:[],workSchedule:null,personalSchedule:null,weekBaselines:{},
   setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>{},
   localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
   document:{hidden:false,addEventListener(){},querySelector(){return null},getElementById(){return null}},setSessionState:(text)=>states.push(text)};
 context.window={PlanINTRepository:api,addEventListener(){}};
 vm.createContext(context);vm.runInContext(code,context);
 vm.runInContext("currentUserId='00000000-0000-4000-8000-999999999999';showSyncNotice=()=>{};",context);
 return {context,memory,states,run:s=>vm.runInContext(s,context)};
}
const response=changes=>changes.map(c=>({table:c.table,rows:c.upserts.map(o=>o.row),deleted:c.deletes.map(o=>o.id)}));
test('A save during an in-flight request is serialized and persisted next',async()=>{
 let release,calls=0;
 const h=harness(async(name,{changes})=>{calls++;if(calls===1)await new Promise(r=>release=r);return {data:response(changes)}});
 h.run('queueSave()');const saving=h.run('flush()');await Promise.resolve();await Promise.resolve();
 h.context.projects[0].name='Editada durante guardado';h.run('queueSave()');release();await saving;
 assert.equal(calls,2);assert.equal(h.memory.size,0);assert.equal(h.run('repository.db.planint_origins[0].name'),'Editada durante guardado');
});
test('A failed save remains in the per-user outbox and retry succeeds',async()=>{
 let fail=true;const h=harness(async(name,{changes})=>fail?{error:{message:'Offline'}}:{data:response(changes)});
 h.run('queueSave()');await assert.rejects(h.run('flush()'));assert.equal(h.memory.size,1);
 fail=false;await h.run('flush()');assert.equal(h.memory.size,0);assert.ok(h.states.includes('Guardado en la nube'));
});
test('A no-op save never leaves a resolved promise blocking later saves',async()=>{
 let calls=0;const h=harness(async(name,{changes})=>{calls++;return {data:response(changes)}});
 h.run('queueSave()');await h.run('flush()');
 h.run('queueSave()');await h.run('flush()');assert.equal(h.run('saving'),null);
 h.context.projects[0].name='Segundo cambio';h.run('queueSave()');await h.run('flush()');assert.equal(calls,2);
});
