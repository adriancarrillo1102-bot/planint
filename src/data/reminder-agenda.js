(function(root){
  'use strict';
  const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'');
  function forDate(reminders,date,scope='all'){
    return (reminders||[]).filter(r=>r.active!==false&&r.date===date&&(scope==='all'||r.scope===scope))
      .slice().sort((a,b)=>(validTime(a.time)?a.time:'99:99').localeCompare(validTime(b.time)?b.time:'99:99')||String(a.title||'').localeCompare(String(b.title||''),'es')||String(a.id).localeCompare(String(b.id)));
  }
  function atTimes(reminders,date,scope='all'){
    const groups=new Map();for(const r of forDate(reminders,date,scope))if(validTime(r.time)){
      if(!groups.has(r.time))groups.set(r.time,[]);groups.get(r.time).push(r);
    }return [...groups].map(([time,items])=>({time,items,minute:Number(time.slice(0,2))*60+Number(time.slice(3))}));
  }
  const api={forDate,atTimes,validTime};root.PlanINTReminderAgenda=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
