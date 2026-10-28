// Local-only synthetic UI fixture. Never published. No Supabase requests or personal data.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const clock=new Date();clock.setHours(12,0,0,0);
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=iso(clock),tomorrow=new Date(clock);tomorrow.setDate(tomorrow.getDate()+1);
const tasks=[{id:700001,name:'QA actividad de controles',scope:'work',originId:'700010',originType:'other',project:'Otro',status:'scheduled',nature:'unique',intake:'planned',priority:'Media',urgency:'Media',time:'1h',checklistEnabled:true,checklist:[{id:700002,text:'Paso de prueba',done:false}],scheduleHistory:[{id:700003,date:today,start:'09:00',duration:'1h',result:'active'}]},
 {id:700004,name:'QA comida recurrente',scope:'work',originId:'700010',originType:'other',project:'Otro',status:'recurring',nature:'recurrent',isRecurringMaster:true,priority:'Media',urgency:'Baja',time:'1h',recurrence:{freq:'daily',days:[0,1,2,3,4,5,6],time:'13:00',start:today,end:iso(tomorrow)},scheduleHistory:[],checklist:[]}];
const days=Array.from({length:7},(_,day)=>({day,name:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][day],active:true,start:'08:00',end:'17:00'}));
const seed={mp2_tasks:tasks,mp2_projects:[{id:'700010',name:'Otro',type:'other',scope:'work'},{id:'700011',name:'Otro',type:'other',scope:'personal'}],mp2_work_schedule:{version:1,breakMinutes:60,days,timeBlocks:[]},mp2_personal_schedule:{version:1,breakMinutes:0,days:days.map(x=>({...x,start:'17:00',end:'22:00'})),timeBlocks:[]},mp2_habits:[],mp2_reminders:[],mp2_important:[],mp2_import_logs:[],mp2_project_structures:{},mp2_management_structures:{},mp2_week_baselines:{}};
html=html.replace(/<script src="https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2"><\/script>/,'');
const cloudStart=html.lastIndexOf('<script>',html.indexOf('(function PlanINTCloudV11828()')),cloudEnd=html.indexOf('</script>',cloudStart)+9;
if(cloudStart<0)throw Error('Cloud boundary changed');
html=html.slice(0,cloudStart)+`<script>window.QAIsolation=true;window.QAFlushCount=0;window.QAFailFlushAt=0;window.PlanINTCloud={isHydrated:()=>true,queueSave:()=>{},flush:async()=>{window.QAFlushCount++;if(window.QAFlushCount===window.QAFailFlushAt)throw Error('QA network failure')},deleteActivity:()=>window.PlanINTActions.openDelete(taskDetailId),deleteHabit:()=>{},deleteReminder:()=>{},deleteImportant:()=>{}};</script>`+html.slice(cloudEnd);
const seedScript=`<script>window.QAUncaught=[];if(!sessionStorage.getItem('qaSeeded')){localStorage.clear();for(const [k,v]of Object.entries(${JSON.stringify(seed)}))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('qaSeeded','yes')} window.confirm=()=>true;window.alert=m=>{document.getElementById('qaErrors').textContent='Aviso de prueba: '+m};window.addEventListener('error',e=>{window.QAUncaught.push(e.message);const p=document.getElementById('qaErrors');if(p)p.textContent+=e.message+'\\n'});</script>`;
html=html.replace('<head>','<head>'+seedScript).replace(/(src|href)="src\//g,'$1="/src/');
html=html.replace('<body>','<body><div id="qaErrors" role="alert" style="color:#b00"></div><div style="position:fixed;bottom:0;right:0;z-index:99999;background:#fff0b8;font-size:10px">QA local · datos ficticios · sin conexión a Supabase</div>');
html=html.replace('</body>','<script src="/tests/ui-harness.js?v='+Date.now()+'"></script></body>');
fs.writeFileSync(path.join(__dirname,'browser-fixture.html'),html);
console.log('Synthetic browser fixture generated for '+today);
