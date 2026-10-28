/* Read projections keep historical plans separate from occupied calendar slots. */
(function(root){
  'use strict';
  const closed=new Set(['completed','completed_early','completed_late']);
  const live=new Set(['active','missed',...closed]);
  const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'');
  const pad=n=>String(n).padStart(2,'0');
  const date=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const clock=n=>`${pad(Math.floor(((n%1440)+1440)%1440/60))}:${pad(((n%1440)+1440)%1440%60)}`;
  const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
  function latest(history){
    return (history||[]).map((s,i)=>({s,i})).filter(x=>x.s?.date).sort((a,b)=>{
      const at=Date.parse(a.s.plannedAt),bt=Date.parse(b.s.plannedAt);
      if(Number.isFinite(at)&&Number.isFinite(bt)&&at!==bt)return at-bt;
      const ai=Number(a.s.id),bi=Number(b.s.id);
      return Number.isFinite(ai)&&Number.isFinite(bi)&&ai!==bi?ai-bi:a.i-b.i;
    }).at(-1)?.s||null;
  }
  function execution(t,parseDuration){
    if(t.status!=='done'||t.isRecurringMaster)return null;
    const stamp=t.completedAt?new Date(t.completedAt):null,validStamp=stamp&&!isNaN(stamp);
    const ds=t.completedDate||(validStamp?date(stamp):'');
    let duration=Number(t.actualMinutes)||0;
    if(!duration&&validTime(t.actualStart)&&validTime(t.actualEnd))duration=(minutes(t.actualEnd)-minutes(t.actualStart)+1440)%1440;
    duration=duration||parseDuration(t.time||'')||0;
    if(!ds||!duration)return null;
    const end=validTime(t.actualEnd)?minutes(t.actualEnd):validStamp?stamp.getHours()*60+stamp.getMinutes():null;
    const start=validTime(t.actualStart)?t.actualStart:end!==null?clock(end-duration):'';
    return {id:'execution-'+t.id,date:ds,start,duration:duration+' min',result:'completed',completedDate:ds,completedAt:t.completedAt||null,executionOnly:true,unplanned:t.intake==='unplanned',inferredTime:!validTime(t.actualStart)};
  }
  function records(t,parseDuration){
    if(t.isRecurringMaster)return [];
    const s=latest(t.scheduleHistory);
    if(s&&live.has(s.result))return [s];
    const actual=execution(t,parseDuration);
    return actual?[actual]:[];
  }
  function retirePrevious(t,now,reason,relatedTaskId){
    for(const s of t.scheduleHistory||[])if(['active','missed'].includes(s.result)){
      s.result='rescheduled';s.rescheduledAt=now;s.changeReason=reason||'';s.relatedTaskId=relatedTaskId||null;
    }
  }
  function state(t,s){
    if(t.intake==='unplanned')return 'unplanned';
    if(t.status==='done'||closed.has(s?.result))return 'done';
    if(t.status==='missed'||s?.result==='missed')return 'missed';
    if((t.scheduleHistory||[]).some(x=>String(x.id)!==String(s?.id)&&['rescheduled','missed'].includes(x.result)))return 'rescheduled';
    return 'pending';
  }
  const api={latest,execution,records,retirePrevious,state};root.PlanINTCalendarRecords=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
