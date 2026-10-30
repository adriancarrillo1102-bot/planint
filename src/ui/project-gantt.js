(function(){
  'use strict';
  const $=id=>document.getElementById(id),G=window.PlanINTProjectGantt,C=window.PlanINTCalendarRecords;
  const controls={collapsed:new Map(),scale:new Map(),selected:new Map()};let creating=null;
  const labels={pending:'Planeada',done:'Terminada',missed:'No realizada',unplanned:'No planeada',rescheduled:'Reprogramada'};
  const dateLabel=ds=>new Date(ds+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
  const origin=()=>originById(currentProjectDetail),projectId=()=>String(currentProjectDetail);
  function model(o){return G.build({origin:o,structure:projectStructures[String(o.id)]||{milestones:[]},tasks,records:C.records,execution:C.execution,state:C.state,parseDuration,today:isoDate(new Date())})}
  function taskCaption(row){return row.kind==='undated'?'Sin fecha · '+(row.task.status==='done'?'Terminada':labels[row.state]||'Pendiente'):row.kind==='commitment'?'Compromiso: '+dateLabel(row.start)+' · Sin programar':(row.kind==='actual'?'Realizada: ':'Programada: ')+dateLabel(row.start)+(row.time?' · '+row.time:'')+' · '+(labels[row.state]||'Pendiente')}
  function draw(o){
    const m=model(o),id=String(o.id),collapsed=controls.collapsed.get(id)||new Set(),scale=controls.scale.get(id)||(m.range.days>120?'months':'weeks'),ticks=G.ticks(m.range,scale),today=isoDate(new Date()),todayInside=today>=m.range.start&&today<=m.range.end;
    const now=todayInside?G.position(m.range,today).left+.5/m.range.days*100:null;
    const grid=ticks.map(t=>`<i class="pg-tick" style="left:${t.left}%"></i>`).join('')+(now!==null?`<i class="pg-now" style="left:${now}%"></i>`:'');
    const point=ds=>Math.min(99.5,G.position(m.range,ds).left+50/m.range.days);
    function taskRow(row){
      const t=row.task,caption=taskCaption(row),a=`data-gantt-task="${esc(t.id)}"`,pos=row.start?G.position(m.range,row.start,row.end):null;
      let mark= row.kind==='undated'?`<div class="pg-undated"><span>${t.status==='done'?'Cierre sin fecha registrada':'Sin programar'}</span>${t.status!=='done'?`<button class="pg-schedule" data-gantt-schedule="${esc(t.id)}">Programar</button>`:''}</div>`:
        row.kind==='commitment'?`<button class="pg-commitment" style="left:${point(row.start)}%" ${a} aria-label="${esc(t.name+' · '+caption)}" title="${esc(t.name+' · '+caption)}"></button>`:
        `<button class="pg-bar ${row.state}" style="left:${pos.left}%;width:${Math.min(pos.width,100-pos.left)}%" ${a} aria-label="${esc(t.name+' · '+caption+' · '+fmtHours(row.duration))}" title="${esc(t.name+' · '+caption+' · '+fmtHours(row.duration))}"></button>`;
      return `<div class="pg-row pg-task ${String(controls.selected.get(id))===String(t.id)?'pg-selected':''}"><div class="pg-name"><div class="pg-name-copy"><button class="pg-task-title" ${a}>${esc(t.name)}</button><small>${esc(caption)}</small>${t.deliverable?`<small>Entregable: ${esc(t.deliverable)}</small>`:''}</div></div><div class="pg-track">${grid}${mark}</div></div>`;
    }
    const rows=m.groups.map(g=>{
      const h=g.milestone,isClosed=collapsed.has(g.key),hs=h?projectStructureStatusLabel(h.status,h.dueDate):null,pos=g.start&&g.end?G.position(m.range,g.start,g.end):null;
      const deadline=h&&G.validDate(h.dueDate)?`<button class="pg-diamond ${h.status==='completed'?'done':h.dueDate<today?'missed':''}" style="left:${point(h.dueDate)}%" data-gantt-milestone="${esc(h.id)}" aria-label="${esc('Editar hito '+h.name+' · '+dateLabel(h.dueDate))}" title="${esc(h.name+' · Fecha objetivo '+dateLabel(h.dueDate))}"></button>`:'';
      return `<div class="pg-row pg-milestone"><div class="pg-name"><div class="pg-name-copy"><button class="pg-hito-toggle" data-gantt-collapse="${esc(g.key)}" aria-expanded="${!isClosed}"><span aria-hidden="true">${isClosed?'▸':'▾'}</span>${esc(h?.name||'Sin hito asignado')}</button><small>${g.done}/${g.tasks.length} terminadas · ${g.progress}%${h?' · '+hs.label:''}</small>${h?`<small>${G.validDate(h.dueDate)?'Objetivo: '+dateLabel(h.dueDate):'Hito sin fecha objetivo'}</small>`:''}</div><button class="pg-mini" data-gantt-new="${esc(h?.id||'')}" aria-label="${esc('Agregar actividad a '+(h?.name||'este proyecto'))}">+</button></div><div class="pg-track">${grid}${pos?`<span class="pg-span" style="left:${pos.left}%;width:${Math.min(pos.width,100-pos.left)}%"></span>`:''}${deadline}${!g.tasks.length?'<div class="pg-undated"><span>Sin actividades vinculadas</span></div>':''}</div></div>${isClosed?'':g.tasks.map(taskRow).join('')}`;
    }).join('');
    const timeWidth=Math.max(560,Math.min(1800,m.range.days*(scale==='months'?5:16)));
    return `<section class="project-gantt" style="--pg-time:${timeWidth}px" aria-label="Cronograma del proyecto ${esc(o.name)}"><div class="pg-toolbar"><div><h3>Hitos y actividades</h3><div class="pg-caption">${dateLabel(m.range.start)} – ${dateLabel(m.range.end)} · ${m.activities} actividades · ${m.undated} sin fecha</div></div><div class="pg-actions"><label>Escala<select id="projectGanttScale"><option value="weeks" ${scale==='weeks'?'selected':''}>Semanas</option><option value="months" ${scale==='months'?'selected':''}>Meses</option></select></label><button class="btn" data-gantt-new-milestone>Nuevo hito</button><button class="btn primary" data-gantt-new="">+ Agregar actividad</button></div></div><div class="pg-scroll"><div class="pg-board"><div class="pg-axis"><div class="pg-axis-name">Hito / actividad<small>Selecciona para ver y editar</small></div><div class="pg-axis-track">${ticks.map(t=>`<i class="pg-tick" style="left:${t.left}%"><span>${scale==='months'?new Date(t.date+'T12:00:00').toLocaleDateString('es-MX',{month:'short',year:'numeric'}):dateLabel(t.date)}</span></i>`).join('')}${now!==null?`<span class="pg-now-label" style="left:${Math.max(3,Math.min(97,now))}%">Hoy · ${dateLabel(today)}</span>`:''}</div></div>${rows||'<div class="pg-notice">Este proyecto aún no tiene hitos ni actividades. Puedes agregarlos desde aquí.</div>'}</div></div><div class="pg-legend"><span><i class="hito"></i>Fecha objetivo del hito</span><span><i></i>Planeada</span><span><i class="done"></i>Terminada</span><span><i class="missed"></i>No realizada</span><span><i class="unplanned"></i>No planeada</span><span><i class="rescheduled"></i>Reprogramada</span><span><i class="commitment"></i>Compromiso sin programación</span></div><div class="pg-notice">Las barras usan la programación vigente o las fechas reales de realización. El rombo vacío es una fecha compromiso, sin reservar tiempo. Las actividades sin fecha se conservan en su hito, pendientes de programar. La fecha objetivo del hito se mantiene al reprogramar sus actividades.</div>${m.masters.length?`<details class="pg-recurring"><summary>Reglas recurrentes · ${m.masters.length}</summary>${m.masters.map(t=>`<button data-gantt-task="${esc(t.id)}">${esc(t.name)} · ${esc(recurrenceText(t))}</button>`).join('')}</details>`:''}<div class="pg-toolbar-status" id="projectGanttStatus" role="status" aria-live="polite"></div></section>`;
  }
  const tabs=$('projectDetailView').querySelector('.project-tabs');tabs.insertAdjacentHTML('beforeend','<button type="button" id="projectGanttTab" data-project-tab="gantt">Cronograma</button>');
  const baseRender=renderProjectDetail;
  renderProjectDetail=function(){baseRender();const o=origin();$('projectGanttTab').hidden=o?.type!=='project';if(o?.type==='project'&&projectDetailTab==='gantt'){$('projectDetailTasks').innerHTML=draw(o);const select=$('projectGanttScale');if(select)select.onchange=()=>{controls.scale.set(String(o.id),select.value);renderProjectDetail()};icons()}};
  $('projectGanttTab').onclick=()=>{projectDetailTab='gantt';renderProjectDetail()};
  $('taskModal').querySelector('.modal-body').insertAdjacentHTML('afterbegin','<section id="projectGanttCreateFields" class="pg-create-fields" hidden><label class="pg-create-check"><input type="checkbox" id="projectGanttScheduleNow" checked> Programar esta actividad al guardarla</label><div class="pg-create-times"><label>Fecha programada<input type="date" id="projectGanttCreateDate"></label><label>Hora inicial<input type="time" id="projectGanttCreateTime" value="09:00"></label></div><p id="projectGanttCreateHint"></p><p id="projectGanttCreateError" class="pg-create-error" role="alert"></p></section>');
  function clearCreate(){creating=null;$('projectGanttCreateFields').hidden=true}
  const baseReset=resetNewTaskForm;resetNewTaskForm=function(){clearCreate();return baseReset()};
  function updateCreate(){if(!creating)return;const recurring=$('taskNature').value!=='unique',on=$('projectGanttScheduleNow').checked&&!recurring;$('projectGanttScheduleNow').disabled=recurring;$('projectGanttCreateDate').disabled=!on;$('projectGanttCreateTime').disabled=!on;$('projectGanttCreateHint').textContent=recurring?'La recurrencia se programa con su propia regla, configurada en esta ficha.':on?'Después de guardar se revisa el horario con las validaciones habituales. Si cancelas esa revisión, la actividad permanece en el Banco.':'La actividad se agrega al proyecto y al hito sin inventar una fecha programada.'}
  function add(mid){const o=origin();if(!o||o.type!=='project')return;if(mid&&!findMilestone(o.id,mid))return;weekDirectCreateDate=null;openTaskForStructure(mid||'','');creating={projectId:String(o.id),milestoneId:mid||''};$('projectGanttCreateFields').hidden=false;$('projectGanttScheduleNow').checked=true;$('projectGanttCreateDate').min=isoDate(new Date());$('projectGanttCreateDate').value=isoDate(new Date());$('projectGanttCreateTime').value='09:00';$('projectGanttCreateError').textContent='';updateCreate()}
  $('projectGanttScheduleNow').onchange=updateCreate;$('taskNature').addEventListener('change',updateCreate);
  document.querySelectorAll('.close-task').forEach(b=>b.addEventListener('click',clearCreate));
  const baseCreate=$('saveTask').onclick;
  $('saveTask').onclick=function(){
    if(!creating)return baseCreate.call(this);
    const want=$('projectGanttScheduleNow').checked&&$('taskNature').value==='unique',date=$('projectGanttCreateDate').value,time=$('projectGanttCreateTime').value;
    if(want&&(!G.validDate(date)||date<isoDate(new Date())||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))){$('projectGanttCreateError').textContent='Selecciona una fecha actual o futura y una hora válida.';return}
    const ids=new Set(tasks.map(t=>String(t.id)));weekDirectCreateDate=want?date:null;baseCreate.call(this);
    const created=tasks.find(t=>!ids.has(String(t.id))&&!t.recurrenceMasterId);
    if(created&&want&&!created.isRecurringMaster){$('scheduleStart').value=time;renderScheduleDayLoad()}
  };
  $('projectDetailTasks').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const o=origin();if(!o||o.type!=='project')return;
    if(b.hasAttribute('data-gantt-new')){add(b.dataset.ganttNew);return}
    if(b.hasAttribute('data-gantt-new-milestone')){openStructureItemModal('milestone');return}
    if(b.dataset.ganttCollapse){const id=projectId(),set=controls.collapsed.get(id)||new Set(),key=b.dataset.ganttCollapse;set.has(key)?set.delete(key):set.add(key);controls.collapsed.set(id,set);renderProjectDetail();return}
    if(b.dataset.ganttMilestone){openStructureItemModal('milestone',b.dataset.ganttMilestone);return}
    const id=b.dataset.ganttTask||b.dataset.ganttSchedule,t=tasks.find(t=>String(t.id)===String(id)&&String(t.originId)===String(o.id));if(!t)return;
    controls.selected.set(String(o.id),t.id);if(b.dataset.ganttSchedule)openScheduleModal(t.id);else openTaskDetail(t.id,'origin');
  });
  if(currentProjectDetail)renderProjectDetail();
  window.PlanINTProjectGanttUI={render:renderProjectDetail};
})();
