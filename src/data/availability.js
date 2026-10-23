/* Calendar-local interval arithmetic; no network, DOM or UTC date conversions. */
(function(root){
  'use strict';
  const date = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const shift = (ds,n) => {const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return date(d)};
  const weekday = ds => (new Date(ds+'T12:00:00').getDay()+6)%7;
  const minutes = t => /^\d{2}:\d{2}$/.test(t||'') ? Number(t.slice(0,2))*60+Number(t.slice(3)) : NaN;
  const validDate = ds => /^\d{4}-\d{2}-\d{2}$/.test(ds||'') && date(new Date(ds+'T12:00:00'))===ds;
  const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t||'');
  function union(rows){
    const out=[];
    for(const r of rows.filter(r=>r&&r.end>r.start).map(r=>({start:r.start,end:r.end})).sort((a,b)=>a.start-b.start||a.end-b.end)){
      const last=out[out.length-1];if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else out.push(r);
    }return out;
  }
  const length = rows => union(rows).reduce((sum,r)=>sum+r.end-r.start,0);
  function subtract(base,cuts){
    let out=union(base);
    for(const c of union(cuts))out=out.flatMap(r=>c.end<=r.start||c.start>=r.end?[r]:[
      {start:r.start,end:Math.min(c.start,r.end)},{start:Math.max(c.end,r.start),end:r.end}
    ].filter(r=>r.end>r.start));
    return out;
  }
  const intersection=(a,b)=>a.flatMap(x=>b.map(y=>({start:Math.max(x.start,y.start),end:Math.min(x.end,y.end)}))).filter(x=>x.end>x.start);
  function matches(b,ds){
    if(!b||!b.startDate||ds<b.startDate||(b.endDate&&ds>b.endDate)||(b.excludedDates||[]).includes(ds))return false;
    return b.freq==='daily'||(b.freq==='weekly'?(b.days||[]).map(Number).includes(weekday(ds)):ds===b.startDate);
  }
  function occurrences(profile,ds){
    const out=[];
    for(const b of profile?.timeBlocks||[]){
      for(const origin of [ds,shift(ds,-1)]){
        if(!matches(b,origin))continue;
        let start=b.allDay?0:minutes(b.startTime),end=b.allDay?1440:minutes(b.endTime);
        if(!Number.isFinite(start)||!Number.isFinite(end)||start===end)continue;
        if(end<start)end+=1440;
        const offset=origin===ds?0:-1440;
        start=Math.max(0,start+offset);end=Math.min(1440,end+offset);
        if(end>start)out.push({start,end,block:b,occurrenceDate:origin});
      }
    }return out;
  }
  function base(profile,ds){
    const rows=[];
    for(const origin of [ds,shift(ds,-1)]){
      const day=profile?.days?.[weekday(origin)];if(!day?.active)continue;
      let start=minutes(day.start),end=minutes(day.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start===end)continue;
      if(end<start)end+=1440;
      const offset=origin===ds?0:-1440;
      start=Math.max(0,start+offset);end=Math.min(1440,end+offset);
      if(end>start)rows.push({start,end});
    }return union(rows);
  }
  function available(profile,ds){return subtract(base(profile,ds),occurrences(profile,ds))}
  function residualBreak(profile,ds){
    // The legacy pause has no clock time. Allocate it once per originating shift,
    // across its remaining calendar-day portions; never charge it twice overnight.
    let total=0;
    for(const origin of [ds,shift(ds,-1)]){
      const d=profile?.days?.[weekday(origin)];if(!d?.active)continue;
      const start=minutes(d.start);let end=minutes(d.end);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start===end)continue;
      if(end<start)end+=1440;if(end-start<360)continue;
      if(origin!==ds&&end<=1440)continue;
      const cuts=occurrences(profile,origin).concat(end>1440?occurrences(profile,shift(origin,1)).map(x=>({...x,start:x.start+1440,end:x.end+1440})):[]);
      const window=[{start,end}],remaining=subtract(window,cuts),net=length(remaining);
      if(!net)continue;
      const replaced=length(intersection(window,cuts.filter(x=>x.block.replacesBreak)));
      const pause=Math.min(net,Math.max(0,Number(profile.breakMinutes||0)-replaced));
      const first=length(intersection(remaining,[{start:0,end:1440}]));
      const firstPause=Math.floor(pause*first/net);
      total+=origin===ds?firstPause:pause-firstPause;
    }
    return Math.min(length(available(profile,ds)),total);
  }
  const capacity=(profile,ds)=>Math.max(0,length(available(profile,ds))-residualBreak(profile,ds));
  function generalCapacity(profiles,ds){
    return Math.max(0,length(profiles.flatMap(p=>available(p,ds)))-Math.max(0,...profiles.map(p=>residualBreak(p,ds))));
  }
  function conflicts(profile,ds,start,duration){
    const result=[];
    if(!Number.isFinite(start)||!(duration>0))return result;
    for(let offset=0;offset<=Math.floor((start+duration-1)/1440);offset++){
      const day=shift(ds,offset),lo=Math.max(0,start-offset*1440),hi=Math.min(1440,start+duration-offset*1440);
      for(const x of occurrences(profile,day))if(lo<x.end&&hi>x.start)result.push({...x,date:day});
    }return result;
  }
  function executionInside(profile,ds,start,duration){
    if(!Number.isFinite(start)||!(duration>0))return 0;
    let total=0;
    for(let offset=0;offset<=Math.floor((start+duration-1)/1440);offset++){
      const lo=Math.max(0,start-offset*1440),hi=Math.min(1440,start+duration-offset*1440);
      total+=length(intersection(available(profile,shift(ds,offset)),[{start:lo,end:hi}]));
    }return total;
  }
  function validate(b){
    if(!b||!String(b.title||'').trim())return 'Escribe el nombre del bloqueo.';
    if(!validDate(b.startDate)||(b.endDate&&!validDate(b.endDate)))return 'Captura una fecha válida.';
    if(b.endDate&&b.endDate<b.startDate)return 'La fecha final debe ser igual o posterior al inicio.';
    if(!['none','weekly','daily'].includes(b.freq))return 'Selecciona una repetición válida.';
    if(b.freq==='weekly'&&(!Array.isArray(b.days)||!b.days.length||b.days.some(x=>!Number.isInteger(x)||x<0||x>6)))return 'Selecciona al menos un día de la semana.';
    if(!b.allDay&&(!validTime(b.startTime)||!validTime(b.endTime)||b.startTime===b.endTime))return 'Captura horas inicial y final distintas y válidas.';
    if(!Array.isArray(b.excludedDates||[])||(b.excludedDates||[]).some(x=>!validDate(x)))return 'Hay fechas de excepción inválidas.';
    return '';
  }
  const api={date,shift,weekday,minutes,validDate,union,length,subtract,intersection,matches,occurrences,base,available,residualBreak,capacity,generalCapacity,conflicts,executionInside,validate};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PlanINTAvailability=api;
})(typeof window==='object'?window:globalThis);
