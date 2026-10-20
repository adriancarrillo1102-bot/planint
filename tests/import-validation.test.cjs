const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const validation=require('../src/data/import-validation.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
test('Excel dates and calendar text preserve the intended date; invalid dates are rejected',()=>{
 assert.equal(validation.date(new Date(2026,8,18)),'2026-09-18');
 assert.equal(validation.date('04/10/2026'),'2026-10-04');
 assert.equal(validation.date('2026-11-07'),'2026-11-07');
 assert.equal(validation.date(''),'');
 assert.throws(()=>validation.date('2026-02-30'));
 assert.throws(()=>validation.date('11-07-26'));
 assert.throws(()=>validation.date(new Date(NaN)));
});
test('Urgency requires an explicit policy for legacy values',()=>{
 assert.throws(()=>validation.urgency('Alta'));
 assert.equal(validation.urgency('Alta','high-urgent'),'Urgente');
 assert.equal(validation.urgency('Media','high-urgent'),'Normal');
 assert.equal(validation.urgency('Baja','high-urgent'),'Normal');
 assert.equal(validation.urgency('Alta','high-critical'),'Crítica');
 assert.equal(validation.urgency('Media','high-critical'),'Urgente');
 assert.equal(validation.urgency('Crítica'),'Crítica');
 assert.throws(()=>validation.priority('Inmediata'));
});
function harness(){
 const context={window:{PlanINTImport:validation},document:{getElementById:()=>({value:'high-urgent'})},
   norm:v=>String(v??'').trim(),normScope:v=>v==='Personal'?'personal':v==='Trabajo'?'work':'',originById:()=>null,
   tasks:[],originForTask:t=>t.origin||null,isoDate:()=> '2026-10-20',importTargetProject:null,importAnalysis:null,renderImportPreview(){}};
 vm.createContext(context);
 const start=html.indexOf('function normOriginType('),end=html.indexOf('function renderImportPreview(',start);
 vm.runInContext(html.slice(start,end),context);return context;
}
const row=()=>({'Ámbito':'Personal','Tipo Origen':'Proyecto','Origen':'QA','Actividad':'Una actividad','Naturaleza':'Única','Urgencia':'Alta','Fecha compromiso':'2026-11-07','Fase':'Diseño','Categoría':'QA','Dependencia':'Referencia'});
test('Bulk preview rejects in-file duplicates and missing or invalid fields',()=>{
 const h=harness();h.analyzeRows([row(),row(),{...row(),Actividad:'Otra','Fecha compromiso':'2026-02-30'}, {...row(),Actividad:''}],'qa.xlsx');
 assert.deepEqual(Array.from(h.importAnalysis.results,r=>r.type),['new','conflict','conflict','conflict']);
 assert.equal(h.importAnalysis.results[0].data.urgency,'Urgente');
 assert.equal(h.importAnalysis.results[0].data.phase,'Diseño');
});
test('The same workbook after creation is flagged as a duplicate instead of creating twice',()=>{
 const h=harness();h.tasks=[{id:123,name:'Una actividad',scope:'personal',originType:'project',origin:{name:'QA',type:'project'}}];
 h.analyzeRows([row()],'qa.xlsx');assert.equal(h.importAnalysis.results[0].type,'conflict');
});
test('Repeated activity IDs in one file cannot apply two different updates',()=>{
 const h=harness();h.tasks=[{id:123,name:'Anterior',scope:'personal',originType:'project',nature:'unique',origin:{name:'QA',type:'project'}}];
 h.originTypeLabel=t=>t==='project'?'Proyecto':'Otro';h.natureLabel=()=> 'Única';
 h.analyzeRows([{...row(),'ID Actividad':'123'},{...row(),'ID Actividad':'123',Actividad:'Otra edición'}],'qa.xlsx');
 assert.deepEqual(Array.from(h.importAnalysis.results,r=>r.type),['update','conflict']);
});
