(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fields=['status','completedAt','completedDate','actualStart','actualEnd','actualMinutes','closingComments'];
  const execution=t=>Object.fromEntries(fields.map(k=>[k,t[k]??null]));
  function minutes(start,end){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end))throw new Error('Captura horas válidas.');
    const m=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
    const n=(m(end)-m(start)+1440)%1440;if(!n)throw new Error('El inicio y la terminación deben ser diferentes.');return n;
  }
  function change(snapshot,id,values,now,today){
    const next=clone(snapshot),t=next.tasks.find(x=>String(x.id)===String(id));
    if(!t||t.status!=='done'||t.isRecurringMaster)throw new Error('Selecciona una actividad terminada.');
    const before=execution(t),historyBefore=clone(t.scheduleHistory||[]);
    const s=(t.scheduleHistory||[]).slice().reverse().find(x=>['completed','completed_early','completed_late'].includes(x.result));
    if(values){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(values.date)||new Date(values.date+'T12:00:00Z').toISOString().slice(0,10)!==values.date)throw new Error('Captura una fecha válida.');
      t.actualMinutes=minutes(values.start,values.end);t.actualStart=values.start;t.actualEnd=values.end;t.completedDate=values.date;t.closingComments=values.comments||'';
      if(s){s.completedDate=values.date;s.result=s.date<values.date?'completed_late':s.date>values.date?'completed_early':'completed'}
    }else{
      if(s){s.result=s.date<today?'missed':'active';delete s.completedAt;delete s.completedDate}
      t.status=s?(s.result==='missed'?'missed':'scheduled'):'pending';
      t.completedAt=null;t.completedDate='';t.actualStart='';t.actualEnd='';t.actualMinutes=0;t.closingComments='';
    }
    t.completionHistory=[...(t.completionHistory||[]),{action:values?'correct':'reopen',at:now,before,after:execution(t),scheduleBefore:historyBefore,scheduleAfter:clone(t.scheduleHistory||[])}];
    return next;
  }
  const api={minutes,change};root.PlanINTCompletionActions=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
