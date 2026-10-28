(function(root){
  'use strict';
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function range(mode,anchor){
    const start=new Date(anchor+'T12:00:00'),end=new Date(start);
    if(mode==='year'){start.setMonth(0,1);end.setMonth(11,31)}
    else if(mode==='month'){start.setDate(1);end.setMonth(end.getMonth()+1,0)}
    else{start.setDate(start.getDate()-(start.getDay()+6)%7);end.setTime(start.getTime());end.setDate(end.getDate()+6)}
    return {start:iso(start),end:iso(end)};
  }
  function shift(mode,anchor,direction){const r=range(mode,anchor),d=new Date(r.start+'T12:00:00');if(mode==='year')d.setFullYear(d.getFullYear()+direction);else if(mode==='month')d.setMonth(d.getMonth()+direction);else d.setDate(d.getDate()+direction*7);return iso(d)}
  function days(r){const out=[],d=new Date(r.start+'T12:00:00');while(iso(d)<=r.end){out.push(iso(d));d.setDate(d.getDate()+1)}return out}
  function summarize({tasks,projects,range:r,scope='all',mode='combined',records,parseDuration,capacity,inside}){
    const ds=days(r),cap=ds.reduce((n,d)=>n+capacity(scope,d),0),rows=new Map(),counts={pending:0,scheduled:0,done:0},ids=new Set();
    let outside=0,planned=0,actual=0;
    for(const t of tasks){
      if(t.isRecurringMaster||(scope!=='all'&&t.scope!==scope))continue;
      const rec=records(t).find(s=>s.date>=r.start&&s.date<=r.end);if(!rec)continue;
      ids.add(String(t.id));if(t.status==='done')counts.done++;else if(['scheduled','progress'].includes(t.status))counts.scheduled++;else counts.pending++;
      if(mode==='actual'&&t.status!=='done')continue;
      const duration=t.status==='done'?(Number(t.actualMinutes)||parseDuration(rec.duration)||parseDuration(t.time)):parseDuration(rec.duration)||parseDuration(t.time);
      const start=t.status==='done'&&rec.executionOnly?rec.start:rec.start;
      const used=inside(t,rec.date,start,duration),valid=Math.max(0,Math.min(duration,Number(used)||0));
      outside+=Math.max(0,duration-valid);if(t.status==='done')actual+=valid;else planned+=valid;
      const o=projects.find(o=>String(o.id)===String(t.originId)),key=t.scope+':'+(o?.id||'other');
      if(!rows.has(key))rows.set(key,{name:o?.name||'Otro',scope:t.scope,kind:o?.type||'other',minutes:0,planned:0,actual:0,outside:0,count:0});
      const row=rows.get(key);row.minutes+=valid;row[t.status==='done'?'actual':'planned']+=valid;row.outside+=Math.max(0,duration-valid);row.count++;
    }
    const assigned=planned+actual,free=Math.max(0,cap-assigned),excess=Math.max(0,assigned-cap);
    const result=[...rows.values()].sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name));
    result.push({name:'Sin asignación (ocio)',scope,kind:'free',minutes:free,planned:0,actual:0,outside:0,count:0});
    result.forEach(row=>row.percent=cap?row.minutes/cap*100:null);
    return {range:r,scope,mode,capacity:cap,assigned,planned,actual,free,outside,excess,rows:result,counts,activityIds:[...ids],days:ds.length};
  }
  const api={range,shift,days,summarize};root.PlanINTPeriodSummary=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
