const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Copy=require('../src/data/activity-copy.js');
test('Copy UI preserves edited fields, retains a failed save, and retries the same identity before scheduling',async()=>{
 const fields=new Map(),el=id=>{if(!fields.has(id))fields.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,parentElement:{hidden:false},options:[{value:'executor'},{value:'responsible'}],add(x){this.options.push(x)},insertAdjacentHTML(){}});return fields.get(id)};
 const original={id:1,name:'Original',scope:'work',originId:10,status:'done',time:'2h',priority:'Alta',urgency:'Media',phase:'Original phase',description:'Original description',checklist:[{id:2,text:'Paso',done:true}],scheduleHistory:[],actualMinutes:120,completedDate:'2026-10-27'};
 let flushes=0,fail=true,saves=0,opened=null;
 const ctx={tasks:[JSON.parse(JSON.stringify(original))],projects:[{id:10,name:'Proyecto',type:'project',scope:'work'}],projectStructures:{},managementStructures:{},taskDetailId:1,
  document:{getElementById:el,body:{insertAdjacentHTML(){}},querySelectorAll:()=>[]},window:{PlanINTActivityCopy:Copy,PlanINTCloud:{isHydrated:()=>true,flush:async()=>{flushes++;if(fail&&flushes===2)throw Error('Network failure')}}},
  originById:id=>ctx.projects.find(x=>String(x.id)===String(id)),currentScheduleRecord:()=>null,parseDuration:()=>120,isoDate:()=> '2026-10-28',esc:String,Option:function(text,value){this.text=text;this.value=value},uid:()=>100,
  backupDataSnapshot:()=>JSON.parse(JSON.stringify({tasks:ctx.tasks,projects:ctx.projects})),applyBackupDataExact:s=>{ctx.tasks=s.tasks},syncTaskStructureNames(){},syncTaskManagementCategoryName(){},save(){saves++},renderAll(){},closeModal(){},openModal(){},openScheduleModal:(id,date)=>{opened={id,date}},renderScheduleDayLoad(){},console:{error(){}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../src/ui/activity-copy.js'),'utf8'),ctx);
 el('activityDetailCopy').onclick();assert.equal(el('copyName').value,'Original');assert.equal(el('copyChecklist').value,'Paso');
 el('copyName').value='Editable copy';el('copyDescription').value='Edited description';el('copyPhase').value='Edited phase';el('copyDate').value='2026-10-29';el('copyTime').value='10:00';
 await el('confirmActivityCopy').onclick();assert.equal(ctx.tasks.length,2);assert.match(el('copyStatus').textContent,/pendiente/);assert.equal(opened,null);assert.equal(saves,1);
 fail=false;await el('confirmActivityCopy').onclick();assert.equal(ctx.tasks.length,2);assert.equal(saves,1);assert.deepEqual(opened,{id:100,date:'2026-10-29'});assert.equal(el('scheduleStart').value,'10:00');
 const copy=ctx.tasks[0];assert.equal(copy.description,'Edited description');assert.equal(copy.phase,'Edited phase');assert.equal(copy.checklist[0].done,false);assert.equal(copy.checklist[0].id,101);assert.equal(copy.status,'pending');assert.deepEqual(JSON.parse(JSON.stringify(ctx.tasks[1])),original);
});
test('Every local JavaScript module parses, including calendar creation, summaries, exports and copying',()=>{const path=require('node:path'),root=path.resolve(__dirname,'../src');for(const dir of ['data','ui'])for(const file of fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,dir,file),'utf8'),{filename:file})});
