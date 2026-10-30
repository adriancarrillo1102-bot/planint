const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../src/data/project-gantt.js'),C=require('../src/data/calendar-records.js'),{Repository}=require('../src/data/cloud-repository.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function fixture(){return {tasks:[{id:1,name:'Original intacta',originId:10,scope:'work',status:'pending',nature:'unique',intake:'planned',time:'2h',milestoneId:'h1',checklistEnabled:true,checklist:[{id:2,text:'Paso',done:true}],scheduleHistory:[],description:'Conservar descripción',completionHistory:[{action:'keep'}]},{id:2,name:'Otro proyecto',originId:20,scope:'personal',status:'pending',scheduleHistory:[]}],projects:[{id:10,name:'Proyecto A',type:'project',scope:'work'},{id:20,name:'Proyecto B',type:'project',scope:'personal'}],projectStructures:{10:{milestones:[{id:'h1',name:'Hito real',dueDate:'2026-11-06',status:'pending',deliverables:[]}]}},managementStructures:{},weekBaselines:{},importantDates:[],habits:[],reminders:[],importLogs:[],workSchedule:null,personalSchedule:null}}
function setup(){
 const snapshot=fixture(),fields=new Map(),events={},calls=[],get=id=>{if(!fields.has(id))fields.set(id,{id,value:'',checked:false,disabled:false,hidden:false,innerHTML:'',textContent:'',style:{},dataset:{},classList:{toggle(){}},querySelector:sel=>get(id+':'+sel),insertAdjacentHTML(pos,text){this.innerHTML+=text},addEventListener:(event,fn)=>events[id+':'+event]=fn});return fields.get(id)};
 let counter=100;
 const ctx={...snapshot,currentProjectDetail:'10',projectDetailTab:'summary',weekDirectCreateDate:null,newTaskChecklistItems:[],window:{PlanINTProjectGantt:G,PlanINTCalendarRecords:C},
  document:{getElementById:get,querySelectorAll:()=>[],querySelector:()=>({textContent:''})},
  originById:id=>ctx.projects.find(o=>String(o.id)===String(id)),findMilestone:(oid,mid)=>ctx.projectStructures[oid]?.milestones.find(h=>String(h.id)===String(mid)),findDeliverable:()=>null,findManagementCategory:()=>null,
  esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),parseDuration:v=>{let h=String(v).match(/([\d.]+)\s*h/),m=String(v).match(/([\d.]+)\s*min/);return h?Number(h[1])*60:m?Number(m[1]):0},isoDate:()=> '2026-10-30',fmtHours:m=>m/60+' h',projectStructureStatusLabel:()=>({label:'Pendiente',cls:'pending'}),recurrenceText:()=>'',icons(){},
  renderProjectDetail(){get('projectDetailTasks').innerHTML='Summary';calls.push(['render'])},resetNewTaskForm(){get('taskName').value='';get('taskNature').value='unique';get('taskPriority').value='Media';get('taskUrgency').value='Media';get('taskTentativeDate').value='';get('taskTime').value='1h'},
  syncTaskScopeFromOrigin(){get('taskScope').value=ctx.originById(get('taskProject').value).scope},refreshStructureSelects(oid,mid,did){get('taskMilestone').value=mid;get('taskDeliverable').value=did},updateTaskCreatePresentation(){},
  syncDurationHidden(){},ensureV8Task:t=>t,syncTaskStructureNames:t=>{t.milestone=ctx.findMilestone(t.originId,t.milestoneId)?.name||''},syncTaskManagementCategoryName(){},uid:()=>++counter,
  save:()=>calls.push(['save']),generateRecurringOccurrences(){},refreshVisibleSurface(){},renderAll(){ctx.renderProjectDetail()},projectWorkspaceIsActive:()=>true,refreshProjectWorkspace:()=>ctx.renderProjectDetail(),
  openModal:id=>calls.push(['open',id]),closeModal:id=>calls.push(['close',id]),openTaskDetail:(id,context)=>calls.push(['task',id,context]),openStructureItemModal:(...v)=>calls.push(['milestone',...v]),
  openScheduleModal:(id,date)=>{ctx.scheduleTaskId=id;get('scheduleDate').value=date||'2026-10-30';get('scheduleStart').value='09:00';calls.push(['schedule',id,date])},renderScheduleDayLoad:()=>calls.push(['validate']),alert:message=>calls.push(['alert',message]),
  scheduleProposalState:()=>({ok:true}),confirm:()=>true,formatDateES:x=>x};
 vm.createContext(ctx);
 let start=html.indexOf('function createTaskFromForm(){'),end=html.indexOf('\n',start);vm.runInContext(html.slice(start,end),ctx);
 start=html.indexOf('function openTaskForStructure(');end=html.indexOf('\n',start);vm.runInContext(html.slice(start,end),ctx);
 get('saveTask').onclick=()=>ctx.createTaskFromForm();get('taskResponsibility').value='executor';get('taskDescription').value='';get('taskNotes').value='';
 const saveLine=html.split('\n').find(l=>l.startsWith("document.getElementById('saveSchedule').onclick="));vm.runInContext(saveLine,ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../src/ui/project-gantt.js'),'utf8'),ctx);
 const click=dataset=>events['projectDetailTasks:click']({target:{closest:()=>({dataset,hasAttribute:name=>Object.hasOwn(dataset,name.replace(/^data-/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase()))})}});
 return {ctx,get,calls,click};
}
test('Opening the real project Gantt, collapsing and changing scale produce no persistence changes',()=>{
 const {ctx,get,calls,click}=setup(),before=JSON.stringify({tasks:ctx.tasks,projects:ctx.projects,structures:ctx.projectStructures}),repo=new Repository(()=>String(Math.random()));const snapshot=()=>({...fixture(),tasks:ctx.tasks,projects:ctx.projects,projectStructures:ctx.projectStructures});repo.accept(repo.normalize(snapshot(),'owner'));
 get('projectGanttTab').onclick();assert.match(get('projectDetailTasks').innerHTML,/Original intacta/);assert.match(get('projectDetailTasks').innerHTML,/Hito real/);assert.match(get('projectDetailTasks').innerHTML,/Sin fecha/);assert.equal(ctx.projectDetailTab,'gantt');
 click({ganttCollapse:'h:h1'});assert.doesNotMatch(get('projectDetailTasks').innerHTML,/data-gantt-task="1"/);get('projectGanttScale').value='months';get('projectGanttScale').onchange();
 assert.equal(JSON.stringify({tasks:ctx.tasks,projects:ctx.projects,structures:ctx.projectStructures}),before);assert.equal(calls.filter(x=>x[0]==='save').length,0);assert.equal(repo.diff(repo.normalize(snapshot(),'owner')).length,0);
});
test('Rows and milestone diamonds open the original editors with the original identities and reject cross-project clicks',()=>{const {get,calls,click}=setup();get('projectGanttTab').onclick();click({ganttTask:'1'});assert.ok(calls.some(x=>x[0]==='task'&&x[1]===1&&x[2]==='origin'));click({ganttTask:'2'});assert.equal(calls.filter(x=>x[0]==='task').length,1);click({ganttMilestone:'h1'});assert.ok(calls.some(x=>x[0]==='milestone'&&x[1]==='milestone'&&x[2]==='h1'))});
test('Create through the real form retains project/hito and selected date/hour; schedule confirmation changes only the new task',()=>{
 const {ctx,get,calls,click}=setup(),original=JSON.stringify(ctx.tasks);get('projectGanttTab').onclick();click({ganttNew:'h1'});assert.equal(get('taskProject').value,'10');assert.equal(get('taskMilestone').value,'h1');assert.equal(get('projectGanttCreateFields').hidden,false);
 get('taskName').value='Nueva desde Gantt';get('taskDescription').value='Detalle nuevo';get('projectGanttCreateDate').value='2026-11-03';get('projectGanttCreateTime').value='10:30';get('saveTask').onclick();
 const t=ctx.tasks.find(t=>t.name==='Nueva desde Gantt');assert.ok(t);assert.equal(t.originId,10);assert.equal(t.milestoneId,'h1');assert.equal(t.milestone,'Hito real');assert.equal(t.status,'pending');assert.equal(get('scheduleDate').value,'2026-11-03');assert.equal(get('scheduleStart').value,'10:30');assert.equal(JSON.stringify(ctx.tasks.filter(x=>x.id!==t.id)),original);
 get('scheduleChangeReason').value='';get('scheduleCauseTask').value='';get('saveSchedule').onclick();assert.equal(t.status,'scheduled');assert.equal(t.scheduleHistory[0].start,'10:30');assert.equal(t.scheduleHistory[0].date,'2026-11-03');assert.equal(JSON.stringify(ctx.tasks.filter(x=>x.id!==t.id)),original);assert.ok(calls.some(x=>x[0]==='validate'));
});
test('Unscheduled creation stays undated, invalid dates create nothing, and reset preserves calendar direct scheduling',()=>{
 const {ctx,get,click}=setup();click({ganttNew:'h1'});get('taskName').value='Sin fecha Gantt';get('projectGanttCreateDate').value='2020-01-01';get('saveTask').onclick();assert.equal(ctx.tasks.length,2);assert.match(get('projectGanttCreateError').textContent,/fecha/);
 get('projectGanttScheduleNow').checked=false;get('saveTask').onclick();const t=ctx.tasks.find(x=>x.name==='Sin fecha Gantt');assert.equal(t.status,'pending');assert.equal(t.tentativeDate,'');assert.equal(t.scheduleHistory.length,0);ctx.weekDirectCreateDate='2026-11-05';ctx.resetNewTaskForm();assert.equal(ctx.weekDirectCreateDate,'2026-11-05');
});
