const {Repository,TABLES}=require('../src/data/cloud-repository.js');
const r=new Repository();
const user='00000000-0000-4000-8000-999999999999';
const s={projects:[{id:9000000000001,name:'QA temporal',type:'other',scope:'personal'}],projectStructures:{},managementStructures:{},
 tasks:[{id:9000000000002,name:'QA sincronización',scope:'personal',originId:9000000000001,status:'pending',checklist:[{id:9000000000003,text:'Paso',done:false}],scheduleHistory:[]}],
 importantDates:[],habits:[],reminders:[],workSchedule:null,personalSchedule:null,weekBaselines:{},importLogs:[]};
console.log(JSON.stringify(r.diff(r.normalize(s,user))));
