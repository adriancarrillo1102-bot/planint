(function(root){
  'use strict';
  const DAY=86400000;
  function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v}
  const day=v=>Math.floor(Date.parse(v+'T12:00:00Z')/DAY);
  const iso=n=>new Date(n*DAY).toISOString().slice(0,10);
  const timeMinutes=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'')?Number(v.slice(0,2))*60+Number(v.slice(3)):0;
  function build({origin,structure={milestones:[]},tasks,records,execution,state,parseDuration,today}){
    const own=tasks.filter(t=>String(t.originId)===String(origin.id)),masters=own.filter(t=>t.isRecurringMaster),activities=own.filter(t=>!t.isRecurringMaster);
    const groups=(structure.milestones||[]).map(m=>({key:'h:'+m.id,milestone:m,tasks:[],start:null,end:validDate(m.dueDate)?m.dueDate:null}));
    const loose={key:'unassigned',milestone:null,tasks:[],start:null,end:null};
    for(const t of activities){
      let group=groups.find(g=>String(g.milestone.id)===String(t.milestoneId));
      if(!group&&t.deliverableId)group=groups.find(g=>(g.milestone.deliverables||[]).some(d=>String(d.id)===String(t.deliverableId)));
      group=group||loose;
      const actual=t.status==='done'?execution(t,parseDuration):null,s=actual||records(t,parseDuration)[0]||null;
      const scheduled=s&&validDate(s.date),commitment=!scheduled&&validDate(t.tentativeDate);
      const start=scheduled?s.date:commitment?t.tentativeDate:null;
      const duration=scheduled?(Number(actual?.duration?.match(/^([\d.]+)/)?.[1])||parseDuration(s.duration||'')||parseDuration(t.time||'')||0):0;
      const end=start?iso(day(start)+(scheduled?Math.max(0,Math.floor((timeMinutes(s.start)+duration-1)/1440)):0)):null;
      const row={task:t,id:t.id,start,end,record:s,time:scheduled?s.start||'':'',duration,kind:scheduled?(actual?'actual':'scheduled'):commitment?'commitment':'undated',state:state(t,s)};
      group.tasks.push(row);
    }
    if(loose.tasks.length)groups.push(loose);
    for(const group of groups){
      group.tasks.sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||String(a.task.name).localeCompare(String(b.task.name),'es'));
      const starts=group.tasks.map(t=>t.start).filter(Boolean),ends=group.tasks.map(t=>t.end).filter(Boolean);
      group.start=starts.length?starts.reduce((a,b)=>a<b?a:b):group.end;
      group.end=[...ends,group.end].filter(Boolean).sort().at(-1)||null;
      group.done=group.tasks.filter(x=>x.task.status==='done').length;group.progress=group.tasks.length?Math.round(group.done/group.tasks.length*100):0;
    }
    const dates=groups.flatMap(g=>[g.start,g.end]).filter(Boolean).sort();
    const first=dates[0]||today,last=dates.at(-1)||today;
    let startDay=day(first),endDay=day(last),weekday=(new Date(startDay*DAY).getUTCDay()+6)%7;
    startDay-=weekday;endDay+=6-(new Date(endDay*DAY).getUTCDay()+6)%7;
    return {origin,groups,masters,activities:activities.length,done:activities.filter(t=>t.status==='done').length,undated:groups.reduce((n,g)=>n+g.tasks.filter(t=>t.kind==='undated').length,0),range:{start:iso(startDay),end:iso(endDay),days:endDay-startDay+1},hasDates:dates.length>0};
  }
  function ticks(range,scale='weeks'){
    const lo=day(range.start),hi=day(range.end),span=hi-lo+1,result=[];
    if(scale==='months'){
      const d=new Date(lo*DAY);d.setUTCDate(1);const count=(new Date(hi*DAY).getUTCFullYear()-d.getUTCFullYear())*12+new Date(hi*DAY).getUTCMonth()-d.getUTCMonth()+1,step=Math.max(1,Math.ceil(count/18));
      while(Math.floor(d.getTime()/DAY)<=hi){const n=Math.max(lo,Math.floor(d.getTime()/DAY));result.push({date:iso(n),left:(n-lo)/span*100});d.setUTCMonth(d.getUTCMonth()+step)}
    }else{const step=Math.max(1,Math.ceil(span/7/18))*7;for(let n=lo;n<=hi;n+=step)result.push({date:iso(n),left:(n-lo)/span*100})}
    return result;
  }
  function position(range,start,end=start){const n=range.days;return {left:Math.max(0,(day(start)-day(range.start))/n*100),width:Math.max(100/n,(day(end)-day(start)+1)/n*100)}}
  const api={validDate,day,iso,build,ticks,position};root.PlanINTProjectGantt=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
