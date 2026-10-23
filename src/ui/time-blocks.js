/* UI for availability exceptions and safe activity deletion. Uses the existing outbox/RPC. */
(function(){
  'use strict';
  const A=window.PlanINTAvailability,Actions=window.PlanINTActivityActions;
  const $=id=>document.getElementById(id),today=()=>isoDate(new Date());
  let editingId=null,editingScope='work',occurrenceDate='',conversionId=null,busy=false,pendingCommit=false;
  function profiles(){return [workSchedule,personalSchedule]}
  function blocksFor(sc){return availabilityScheduleForScope(sc).timeBlocks||[]}
  function scopeName(sc){return sc==='work'?'Laboral':'Personal'}
  function setMessage(id,text,error=false){$(id).textContent=text;$(id).className='block-status'+(error?' error':'')}
  async function commit(next){
    if(!window.PlanINTCloud?.isHydrated())throw new Error('Espera a que termine de cargar tu cuenta.');
    if(busy)throw new Error('Hay otro guardado en curso.');busy=true;
    try{
      await window.PlanINTCloud.flush();
      applyBackupDataExact(next());save();saveBaselines();
      pendingCommit=true;renderAll();
      await window.PlanINTCloud.flush();pendingCommit=false;
    }finally{busy=false}
  }
  async function run(button,status,operation,finish){
    if(pendingCommit&&button.dataset.pending!=='true')return setMessage(status,'Hay otro cambio pendiente de sincronizar. Reintenta su guardado antes de realizar otra operación.',true);
    button.disabled=true;setMessage(status,'Guardando en la nube…');
    try{
      if(pendingCommit){renderAll();await window.PlanINTCloud.flush();pendingCommit=false}
      else await operation();
      delete button.dataset.pending;button.textContent=button.dataset.label||'Guardar';finish();
    }catch(error){
      console.error('PLANINT_ACTION',error);
      setMessage(status,pendingCommit?'El cambio está pendiente de sincronizar. No repitas la operación; usa Reintentar guardado.':(error.message||'No fue posible guardar.'),true);
      if(pendingCommit){button.textContent='Reintentar guardado';button.dataset.pending='true'}
    }finally{button.disabled=false}
  }
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-backdrop" id="timeBlocksModal"><div class="modal"><div class="modal-head"><div><h3>Bloqueos y feriados</h3><div class="modal-subtitle">Tiempo no disponible, separado de tus actividades.</div></div><button type="button" class="icon-btn" data-close-blocks aria-label="Cerrar bloqueos">×</button></div><div class="modal-body">
      <div class="segmented"><button type="button" id="blocksWork">Laboral</button><button type="button" id="blocksPersonal">Personal</button></div>
      <div class="notice">Los bloqueos se muestran en violeta en Calendario y reducen la disponibilidad. No se incluyen como actividades de Semana ni Banco.</div>
      <div id="timeBlocksList"></div><div class="block-status" id="blockListStatus" role="status" aria-live="polite"></div>
    </div><div class="modal-foot"><button class="btn" type="button" data-close-blocks>Cerrar</button><button class="btn primary" type="button" id="newTimeBlock">Nuevo bloqueo</button></div></div></div>
    <div class="modal-backdrop" id="timeBlockEditor"><div class="modal"><div class="modal-head"><div><h3 id="timeBlockEditorTitle">Bloquear horario</h3><div class="modal-subtitle" id="timeBlockEditorSubtitle"></div></div><button class="icon-btn" type="button" data-close-block-editor aria-label="Cerrar editor de bloqueo">×</button></div><div class="modal-body">
      <label for="blockTitle">Nombre *</label><input id="blockTitle" maxlength="180" placeholder="Comida, feriado, cita…">
      <label for="blockScope">Ámbito</label><select id="blockScope"><option value="work">Laboral</option><option value="personal">Personal</option></select>
      <div class="grid two-col"><div><label for="blockStartDate">Fecha de inicio *</label><input type="date" id="blockStartDate"></div><div id="blockEndDateWrap"><label for="blockEndDate">Última fecha (opcional)</label><input type="date" id="blockEndDate"></div></div>
      <label class="block-check"><input type="checkbox" id="blockAllDay"> Día completo / feriado</label>
      <div class="grid two-col" id="blockTimes"><div><label for="blockStartTime">Hora inicial</label><input type="time" id="blockStartTime" value="13:00"></div><div><label for="blockEndTime">Hora final</label><input type="time" id="blockEndTime" value="14:00"></div></div>
      <label for="blockFrequency">Repetir</label><select id="blockFrequency"><option value="none">No repetir</option><option value="weekly">Cada semana</option><option value="daily">Todos los días</option></select>
      <fieldset id="blockDays"><legend>Días de la semana</legend><div class="block-weekdays">${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((d,i)=>`<label><input type="checkbox" value="${i}" ${i<5?'checked':''}>${d}</label>`).join('')}</div></fieldset>
      <label class="block-check"><input type="checkbox" id="blockReplacesBreak"> Este bloqueo representa la pausa de comida ya descontada</label>
      <small>Si marcas esta opción, la parte de comida dentro de tu horario sustituye el descuento genérico de pausa para no contarlo dos veces. Si el horario cruza medianoche, termina al día siguiente.</small>
      <div class="notice" id="blockConversionNotice" hidden></div><div class="notice" id="blockConflictNotice" hidden></div>
      <div class="block-status" id="blockEditorStatus" role="status" aria-live="polite"></div>
      <div id="blockRemovalControls" hidden><label for="blockOccurrenceDate">Fecha a liberar (para una repetición)</label><input type="date" id="blockOccurrenceDate"><div class="block-actions"><button type="button" class="btn" id="excludeBlockDate">Liberar solo esta fecha</button><button type="button" class="btn danger" id="removeTimeBlock">Quitar todo el bloqueo</button></div><small>Solo se libera disponibilidad; las actividades e historial permanecen.</small></div>
    </div><div class="modal-foot"><button class="btn" type="button" data-close-block-editor>Cancelar</button><button class="btn primary" type="button" id="saveTimeBlock" data-label="Guardar bloqueo">Guardar bloqueo</button></div></div></div>
    <div class="modal-backdrop" id="deleteActivityModal"><div class="modal"><div class="modal-head"><h3>Eliminar actividad</h3><button class="icon-btn" type="button" data-close-delete aria-label="Cancelar eliminación">×</button></div><div class="modal-body"><p id="deleteActivityDescription"></p><label for="deleteActivityMode">Qué deseas eliminar</label><select id="deleteActivityMode"></select><div class="notice" id="deleteActivityWarning"></div><div class="block-status" id="deleteActivityStatus" role="status" aria-live="polite"></div></div><div class="modal-foot"><button class="btn" type="button" data-close-delete>Cancelar</button><button class="btn danger" type="button" id="confirmActivityDelete" data-label="Eliminar selección">Eliminar selección</button></div></div></div>`);
  function renderList(){
    $('blocksWork').classList.toggle('active',editingScope==='work');$('blocksPersonal').classList.toggle('active',editingScope==='personal');
    $('timeBlocksList').innerHTML=blocksFor(editingScope).map(b=>`<div class="block-list-row"><div><b>${esc(b.title)}</b><small>${scopeName(editingScope)} · ${b.allDay?'Día completo':esc(b.startTime+'–'+b.endTime)} · ${b.freq==='none'?esc(b.startDate):b.freq==='daily'?'Diario':'Semanal'}${b.endDate?' · hasta '+esc(b.endDate):''}${b.excludedDates?.length?' · '+b.excludedDates.length+' excepciones':''}</small></div><button class="btn" type="button" data-edit-block="${esc(b.id)}">Editar</button></div>`).join('')||'<div class="empty">No hay bloqueos en este ámbito.</div>';
  }
  function openManager(sc){editingScope=sc|| (scope==='personal'?'personal':'work');renderList();setMessage('blockListStatus','');openModal('timeBlocksModal')}
  function fields(){
    const old=blocksFor(editingScope).find(b=>String(b.id)===String(editingId));
    return {...old,id:editingId||String(uid()),title:$('blockTitle').value.trim(),startDate:$('blockStartDate').value,endDate:$('blockFrequency').value==='none'?'':$('blockEndDate').value,
      allDay:$('blockAllDay').checked,startTime:$('blockStartTime').value,endTime:$('blockEndTime').value,freq:$('blockFrequency').value,
      days:[...$('blockDays').querySelectorAll('input:checked')].map(e=>Number(e.value)),replacesBreak:$('blockReplacesBreak').checked,excludedDates:old?.excludedDates||[]};
  }
  function updateFields(){
    $('blockTimes').hidden=$('blockAllDay').checked;$('blockDays').hidden=$('blockFrequency').value!=='weekly';$('blockEndDateWrap').hidden=$('blockFrequency').value==='none';
    const b=fields();if(A.validate(b)){$('blockConflictNotice').hidden=true;return}
    const sc=$('blockScope').value,p={...availabilityScheduleForScope(sc),timeBlocks:[b]};
    const hits=tasks.filter(t=>t.scope===sc&&!t.isRecurringMaster&&(t.scheduleHistory||[]).some(s=>['active','missed'].includes(s.result)&&A.conflicts(p,s.date,minutesFromTime(s.start||'00:00'),resolvedPlannedMinutes(t,s)).length));
    $('blockConflictNotice').hidden=!hits.length;
    $('blockConflictNotice').textContent=`${hits.length} actividad(es) ya programada(s) coinciden con este bloqueo. Se conservarán y aparecerán señaladas; puedes reprogramarlas.`;
  }
  function openEditor(sc,id=null,ds='',convertId=null){
    if(pendingCommit){openModal('timeBlockEditor');return}
    editingScope=sc||'work';editingId=id;occurrenceDate=ds;conversionId=convertId;
    const b=blocksFor(editingScope).find(x=>String(x.id)===String(id));
    const t=convertId?tasks.find(x=>String(x.id)===String(convertId)):null,m=t?.isRecurringMaster?t:tasks.find(x=>String(x.id)===String(t?.recurrenceMasterId));
    const r=m?.recurrence,s=t?currentScheduleRecord(t):null;
    $('timeBlockEditorTitle').textContent=t?'Convertir en bloqueo':b?'Editar bloqueo':'Bloquear horario';
    $('timeBlockEditorSubtitle').textContent='El historial de actividades se conserva. El color del bloqueo es violeta.';
    $('blockTitle').value=b?.title||t?.name||'';$('blockScope').value=editingScope;$('blockScope').disabled=!!t||!!b;
    $('blockStartDate').value=b?.startDate||(t?today():ds||today());$('blockEndDate').value=b?.endDate||r?.end||'';
    $('blockAllDay').checked=!!b?.allDay;$('blockStartTime').value=b?.startTime||r?.time||s?.start||'13:00';
    let st=minutesFromTime($('blockStartTime').value),dur=t?(parseDuration(t.time)||60):60;
    $('blockEndTime').value=b?.endTime||`${String(Math.floor(((st+dur)%1440)/60)).padStart(2,'0')}:${String((st+dur)%60).padStart(2,'0')}`;
    $('blockFrequency').value=b?.freq||r?.freq||'none';
    $('blockDays').querySelectorAll('input').forEach(e=>e.checked=(b?.days||r?.days||[0,1,2,3,4]).map(Number).includes(Number(e.value)));
    $('blockReplacesBreak').checked=!!b?.replacesBreak;$('blockOccurrenceDate').value=ds||today();
    $('blockRemovalControls').hidden=!b;$('excludeBlockDate').hidden=b?.freq==='none';
    $('blockOccurrenceDate').hidden=b?.freq==='none';
    $('blockConversionNotice').hidden=!t;$('blockConversionNotice').textContent='Al guardar, se detiene la actividad recurrente desde la fecha elegida y se retiran solo las ocurrencias pendientes desde esa fecha. Se conserva la regla anterior y todo el historial realizado o previo. Marca la opción de comida si ya tienes una pausa descontada.';
    $('saveTimeBlock').textContent='Guardar bloqueo';delete $('saveTimeBlock').dataset.pending;
    setMessage('blockEditorStatus','');updateFields();closeModal('timeBlocksModal');if(t)closeModal('activityDetailModal');openModal('timeBlockEditor');
  }
  $('saveTimeBlock').onclick=()=>{
    const b=fields(),sc=$('blockScope').value,error=A.validate(b);if(error&&!pendingCommit)return setMessage('blockEditorStatus',error,true);
    if(!pendingCommit&&conversionId&&b.startDate<today())return setMessage('blockEditorStatus','La conversión debe comenzar hoy o en una fecha futura para conservar el historial.',true);
    run($('saveTimeBlock'),'blockEditorStatus',()=>commit(()=>{
      const current=backupDataSnapshot();
      if(conversionId)return Actions.convert(current,conversionId,b.startDate,b,sc);
      const p=sc==='work'?current.workSchedule:current.personalSchedule;
      if(editingId&&!p.timeBlocks?.some(x=>String(x.id)===String(editingId)))throw new Error('El bloqueo ya no está disponible. Cierra y vuelve a cargar.');
      p.timeBlocks=editingId?p.timeBlocks.map(x=>String(x.id)===String(editingId)?b:x):[...(p.timeBlocks||[]),b];
      return current;
    }),()=>{closeModal('timeBlockEditor');openManager(sc)});
  };
  async function removeBlock(onlyDate){
    const ds=$('blockOccurrenceDate').value,original=blocksFor(editingScope).find(x=>String(x.id)===String(editingId));
    if(!original)return setMessage('blockEditorStatus','El bloqueo ya no está disponible.',true);
    if(onlyDate&&(!A.validDate(ds)||!A.matches(original,ds)))return setMessage('blockEditorStatus','Elige una fecha en la que se repita este bloqueo.',true);
    await run(onlyDate?$('excludeBlockDate'):$('removeTimeBlock'),'blockEditorStatus',()=>commit(()=>{
      const s=backupDataSnapshot(),p=editingScope==='work'?s.workSchedule:s.personalSchedule;
      p.timeBlocks=onlyDate?(p.timeBlocks||[]).map(b=>String(b.id)===String(editingId)?{...b,excludedDates:[...new Set([...(b.excludedDates||[]),ds])].sort()}:b):(p.timeBlocks||[]).filter(b=>String(b.id)!==String(editingId));
      return s;
    }),()=>{closeModal('timeBlockEditor');openManager(editingScope)});
  }
  $('removeTimeBlock').onclick=()=>removeBlock(false);$('excludeBlockDate').onclick=()=>removeBlock(true);
  $('blocksWork').onclick=()=>{editingScope='work';renderList()};$('blocksPersonal').onclick=()=>{editingScope='personal';renderList()};
  $('newTimeBlock').onclick=()=>openEditor(editingScope,null,today());
  $('timeBlocksList').onclick=e=>{const b=e.target.closest('[data-edit-block]');if(b)openEditor(editingScope,b.dataset.editBlock,today())};
  $('timeBlockEditor').querySelectorAll('input,select').forEach(e=>e.addEventListener('change',updateFields));
  document.querySelectorAll('[data-close-blocks]').forEach(b=>b.onclick=()=>closeModal('timeBlocksModal'));
  document.querySelectorAll('[data-close-block-editor]').forEach(b=>b.onclick=()=>{closeModal('timeBlockEditor');if(!pendingCommit)openManager(editingScope)});
  let deletingId=null;
  function openDelete(id){
    if(pendingCommit){openModal('deleteActivityModal');return}
    const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;deletingId=t.id;
    $('deleteActivityDescription').textContent=t.name;
    $('deleteActivityMode').innerHTML=t.isRecurringMaster?'<option value="series">Toda la serie</option>':t.recurrenceMasterId?'<option value="occurrence">Solo esta ocurrencia</option><option value="series">Toda la serie</option>':'<option value="single">Esta actividad</option>';
    updateDeleteWarning();$('confirmActivityDelete').textContent='Eliminar selección';setMessage('deleteActivityStatus','');
    closeModal('activityDetailModal');openModal('deleteActivityModal');
  }
  function updateDeleteWarning(){
    $('deleteActivityWarning').textContent=$('deleteActivityMode').value==='series'?'Se eliminarán la regla y todas sus ocurrencias, incluyendo el historial, checklist y programación de esa serie. Las demás actividades se conservan. Esta acción no tiene papelera.':$('deleteActivityMode').value==='occurrence'?'Se eliminará esta ocurrencia y su programación. Quedará una excepción guardada para que no reaparezca al recargar. Las demás fechas se conservan. Esta acción no tiene papelera.':'Se eliminarán esta actividad, su checklist y programación. Las demás actividades se conservan. Esta acción no tiene papelera.';
  }
  $('deleteActivityMode').onchange=updateDeleteWarning;
  $('confirmActivityDelete').onclick=()=>run($('confirmActivityDelete'),'deleteActivityStatus',()=>commit(()=>Actions.deleteActivity(backupDataSnapshot(),deletingId,$('deleteActivityMode').value)),()=>{taskDetailId=null;closeModal('deleteActivityModal')});
  document.querySelectorAll('[data-close-delete]').forEach(b=>b.onclick=()=>closeModal('deleteActivityModal'));
  window.PlanINTActions={openDelete,openBlocks:openManager,openEditor,convertActivity:id=>{
    const t=tasks.find(x=>String(x.id)===String(id));if(t)openEditor(t.scope,null,today(),t.id);
  }};
  $('calendarBlocks').onclick=()=>openManager();$('availabilityBlocks').onclick=()=>{closeModal('workScheduleModal');openManager(window.PlanINTEntityEditors.getAvailabilityScope())};$('settingsBlocks').onclick=()=>openManager();
  $('activityDetailConvert').onclick=()=>window.PlanINTActions.convertActivity(taskDetailId);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-block]');if(b){e.stopPropagation();openEditor(b.dataset.scope,b.dataset.calendarBlock,b.dataset.date)}});
})();
