(function(root){
  'use strict';
  function copy(snapshot,sourceId,fields,id,checklistIds,now){
    const next=JSON.parse(JSON.stringify(snapshot)),source=next.tasks.find(t=>String(t.id)===String(sourceId));
    if(!source)throw Error('La actividad original ya no está disponible.');
    if(next.tasks.some(t=>String(t.id)===String(id)))throw Error('No fue posible generar un identificador nuevo.');
    const origin=next.projects.find(o=>String(o.id)===String(fields.originId));
    if(!origin||!String(fields.name||'').trim())throw Error('Captura título y origen para la copia.');
    const t={...JSON.parse(JSON.stringify(source)),...fields,id,name:fields.name.trim(),scope:origin.scope,originId:origin.id,originType:origin.type,project:origin.name,
      status:'pending',nature:'unique',intake:'planned',createdAt:now,originHistory:[],postponeHistory:[],completionHistory:[],scheduleHistory:[],
      completedAt:null,completedDate:'',actualStart:'',actualEnd:'',actualMinutes:0,closingComments:'',
      checklist:(fields.checklist||[]).map((text,i)=>({id:checklistIds[i],text,done:false}))};
    for(const k of ['isRecurringMaster','recurrenceMasterId','recurrenceDate','recurrence','updatedAt'])delete t[k];
    next.tasks.unshift(t);return next;
  }
  const api={copy};root.PlanINTActivityCopy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
