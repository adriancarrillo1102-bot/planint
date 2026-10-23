/* Pure mutations used by UI and transaction tests. Input snapshot is never mutated. */
(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  function remove(snapshot,ids){
    const s=clone(snapshot),gone=new Set(ids.map(String));
    s.tasks=s.tasks.filter(t=>!gone.has(String(t.id)));
    s.tasks.forEach(t=>(t.scheduleHistory||[]).forEach(h=>{if(gone.has(String(h.relatedTaskId)))h.relatedTaskId=null}));
    Object.values(s.weekBaselines||{}).forEach(b=>b.items=(b.items||[]).filter(i=>!gone.has(String(i.taskId))));
    return s;
  }
  function deleteActivity(snapshot,id,mode){
    const s=clone(snapshot),t=s.tasks.find(t=>String(t.id)===String(id));if(!t)throw new Error('La actividad ya no está disponible.');
    if(t.recurrenceMasterId&&mode==='occurrence'){
      const m=s.tasks.find(x=>String(x.id)===String(t.recurrenceMasterId));
      if(!m?.recurrence||!t.recurrenceDate)throw new Error('No se encontró la regla recurrente. Recarga antes de eliminar.');
      m.recurrence.excludedDates=[...new Set([...(m.recurrence.excludedDates||[]),t.recurrenceDate])].sort();
      return remove(s,[t.id]);
    }
    if(t.isRecurringMaster||t.recurrenceMasterId){
      if(mode!=='series')throw new Error('Elige esta ocurrencia o toda la serie.');
      const masterId=t.isRecurringMaster?t.id:t.recurrenceMasterId;
      return remove(s,s.tasks.filter(x=>String(x.id)===String(masterId)||String(x.recurrenceMasterId)===String(masterId)).map(x=>x.id));
    }
    return remove(s,[t.id]);
  }
  // Conversion retires future recurrence without deleting completed/past history.
  function convert(snapshot,id,fromDate,block,scope){
    let s=clone(snapshot);const t=s.tasks.find(t=>String(t.id)===String(id));if(!t)throw new Error('Actividad no disponible.');
    const master=t.isRecurringMaster?t:s.tasks.find(x=>String(x.id)===String(t.recurrenceMasterId));
    let ids=[];
    if(master){
      master.recurrence.stopFrom=master.recurrence.stopFrom&&master.recurrence.stopFrom<fromDate?master.recurrence.stopFrom:fromDate;
      ids=s.tasks.filter(x=>String(x.recurrenceMasterId)===String(master.id)&&x.recurrenceDate>=fromDate&&x.status!=='done').map(x=>x.id);
    }else{
      if(t.status==='done')throw new Error('El historial realizado no se convierte ni se elimina.');
      if((t.scheduleHistory||[]).some(x=>x.date<fromDate||['completed','completed_early','completed_late'].includes(x.result)))throw new Error('Esta actividad tiene historial previo. Crea un bloqueo nuevo para conservarla.');
      ids=[t.id];
    }
    s=remove(s,ids);
    const profile=scope==='work'?s.workSchedule:s.personalSchedule;
    profile.timeBlocks=[...(profile.timeBlocks||[]),clone(block)];
    return s;
  }
  const api={remove,deleteActivity,convert};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PlanINTActivityActions=api;
})(typeof window==='object'?window:globalThis);
