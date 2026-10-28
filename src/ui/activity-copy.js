(function(){
  'use strict';const $=id=>document.getElementById(id);let sourceId=null,pendingId=null,busy=false;
  $('activityDetailSave').insertAdjacentHTML('afterend','<button class="btn" id="activityDetailCopy">Copiar actividad</button>');
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="activityCopyModal"><div class="modal"><div class="modal-head"><h3>Copiar actividad</h3><button class="icon-btn" type="button" data-close-copy aria-label="Cerrar copia">×</button></div><div class="modal-body copy-fields"><p>La copia será una actividad independiente. Puedes editar los campos antes de revisar su programación. El historial de la original se conserva y los pasos de la copia comienzan sin completar.</p>
    <label>Título *<input id="copyName" maxlength="300"></label><label>Origen *<select id="copyOrigin"></select></label>
    <label>Descripción<textarea id="copyDescription"></textarea></label><label>Notas<textarea id="copyNotes"></textarea></label>
    <div class="grid two-col"><label>Prioridad<select id="copyPriority"><option>Baja</option><option>Media</option><option>Alta</option></select></label><label>Urgencia<select id="copyUrgency"><option>Baja</option><option>Media</option><option>Alta</option><option>Crítica</option></select></label></div>
    <div class="grid two-col"><label>Duración (horas)<input id="copyHours" type="number" min="0" max="48" step="1"></label><label>Minutos<input id="copyMinutes" type="number" min="0" max="59" step="1"></label></div>
    <div class="grid two-col"><label>Nueva fecha *<input id="copyDate" type="date"></label><label>Hora inicial *<input id="copyTime" type="time"></label></div>
    <label>Hito<select id="copyMilestone"></select></label><label>Entregable<select id="copyDeliverable"></select></label><label>Categoría de gestión<select id="copyManagement"></select></label>
    <label>Responsabilidad<select id="copyRole"><option value="executor">Ejecutor</option><option value="responsible">Responsable</option></select></label>
    <label>Fase<input id="copyPhase"></label><label>Categoría<input id="copyCategory"></label><label>Dependencia<input id="copyDependency"></label>
    <label>Checklist · un paso por línea<textarea id="copyChecklist" rows="5"></textarea></label><p id="copyStatus" role="status" aria-live="polite"></p>
    </div><div class="modal-foot"><button class="btn" data-close-copy type="button">Cancelar</button><button class="btn primary" id="confirmActivityCopy">Crear copia y revisar horario</button></div></div></div>`);
  function fillSelect(id,list,value,empty='Sin asignar'){const el=$(id);el.innerHTML='<option value="">'+empty+'</option>'+list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');el.value=value||''}
  function structure(mid='',did='',cid=''){
    const id=$('copyOrigin').value,o=originById(id),st=projectStructures[id]||{},ms=st.milestones||[];
    fillSelect('copyMilestone',ms,mid);const m=ms.find(x=>String(x.id)===String(mid));fillSelect('copyDeliverable',m?.deliverables||[],did);fillSelect('copyManagement',managementStructures[id]?.categories||[],cid);
    $('copyMilestone').parentElement.hidden=o?.type!=='project';$('copyDeliverable').parentElement.hidden=o?.type!=='project';$('copyManagement').parentElement.hidden=o?.type!=='management';
  }
  $('activityDetailCopy').onclick=()=>{
    if(pendingId){closeModal('activityDetailModal');openModal('activityCopyModal');return}
    const t=tasks.find(x=>x.id===taskDetailId);if(!t)return;sourceId=t.id;
    fillSelect('copyOrigin',projects.filter(o=>!o.archived||String(o.id)===String(t.originId)),t.originId,'Selecciona origen');
    for(const [field,key]of [['copyName','name'],['copyDescription','description'],['copyNotes','notes'],['copyPriority','priority'],['copyUrgency','urgency'],['copyPhase','phase'],['copyCategory','category'],['copyDependency','dependency']])$(field).value=t[key]||'';
    const role=t.responsibilityRole||'executor';if(![...$('copyRole').options].some(x=>x.value===role))$('copyRole').add(new Option(role,role));$('copyRole').value=role;
    const mins=parseDuration(t.time)||0;$('copyHours').value=Math.floor(mins/60);$('copyMinutes').value=mins%60;
    $('copyDate').min=isoDate(new Date());$('copyDate').value=isoDate(new Date());$('copyTime').value=currentScheduleRecord(t)?.start||t.actualStart||'09:00';$('copyChecklist').value=(t.checklist||[]).map(x=>x.text).join('\n');
    structure(t.milestoneId,t.deliverableId,t.managementCategoryId);$('copyStatus').textContent='';closeModal('activityDetailModal');openModal('activityCopyModal');
  };
  $('copyOrigin').onchange=()=>structure();$('copyMilestone').onchange=()=>structure($('copyMilestone').value);
  document.querySelectorAll('[data-close-copy]').forEach(b=>b.onclick=()=>{if(!busy)closeModal('activityCopyModal')});
  $('confirmActivityCopy').onclick=async()=>{
    if(busy)return;const button=$('confirmActivityCopy'),date=$('copyDate').value,time=$('copyTime').value;
    const mins=Number($('copyHours').value)*60+Number($('copyMinutes').value);
    if(!pendingId&&(!date||date<isoDate(new Date())||!time||!mins||mins<0)){$('copyStatus').textContent='Captura fecha actual o futura, hora y duración mayor a cero.';return}
    busy=true;button.disabled=true;$('copyStatus').textContent='Guardando copia…';
    try{
      if(!window.PlanINTCloud?.isHydrated())throw Error('Espera a que termine de cargar tu cuenta.');
      await window.PlanINTCloud.flush();
      if(!pendingId){
        const checklist=$('copyChecklist').value.split('\n').map(x=>x.trim()).filter(Boolean),id=uid(),fields={name:$('copyName').value,originId:$('copyOrigin').value,description:$('copyDescription').value,notes:$('copyNotes').value,priority:$('copyPriority').value,urgency:$('copyUrgency').value,time:mins+' min',tentativeDate:date,milestoneId:$('copyMilestone').value,deliverableId:$('copyDeliverable').value,managementCategoryId:$('copyManagement').value,responsibilityRole:$('copyRole').value,phase:$('copyPhase').value,category:$('copyCategory').value,dependency:$('copyDependency').value,checklistEnabled:checklist.length>0,checklist};
        const next=window.PlanINTActivityCopy.copy(backupDataSnapshot(),sourceId,fields,id,checklist.map((_,i)=>id+i+1),new Date().toISOString());
        applyBackupDataExact(next);const t=tasks.find(x=>x.id===id);syncTaskStructureNames(t);syncTaskManagementCategoryName(t);pendingId=id;save();renderAll();await window.PlanINTCloud.flush();
      }
      const id=pendingId;pendingId=null;closeModal('activityCopyModal');openScheduleModal(id,date);$('scheduleStart').value=time;renderScheduleDayLoad();
    }catch(e){$('copyStatus').textContent=pendingId?'La copia está pendiente de sincronizar. Reintenta con este botón; no se creará otra.':e.message;console.error('PLANINT_COPY',e)}finally{busy=false;button.disabled=false}
  };
})();
