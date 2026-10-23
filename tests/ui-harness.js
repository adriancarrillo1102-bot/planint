/* Local browser integration tests. Loaded ONLY by make-browser-fixture.cjs. */
(function(){
  'use strict';
  if(!window.QAIsolation||location.hostname!=='127.0.0.1')throw Error('QA must remain isolated from production');
  const $=id=>document.getElementById(id),tick=()=>new Promise(r=>setTimeout(r,40));
  const initial=backupDataSnapshot(),results=[];
  const assert=(value,message)=>{if(!value)throw Error(message)};
  async function click(id){assert($(id),'Missing control '+id);$(id).click();await tick()}
  function value(id,v){assert($(id),'Missing field '+id);$(id).value=v;$(id).dispatchEvent(new Event('input',{bubbles:true}));$(id).dispatchEvent(new Event('change',{bubbles:true}))}
  function check(id,v){$(id).checked=v;$(id).dispatchEvent(new Event('change',{bubbles:true}))}
  async function test(name,fn){try{await fn();results.push({name,ok:true})}catch(error){results.push({name,ok:false,error:error.message});console.error('QA',name,error)}render()}
  function render(){ $('qaResults').textContent=JSON.stringify({passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results},null,2) }
  function reset(){document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.remove('show'));applyBackupDataExact(JSON.parse(JSON.stringify(initial)));save();saveBaselines();renderAll()}
  document.body.insertAdjacentHTML('beforeend','<aside style="position:fixed;bottom:8px;right:8px;z-index:100001;max-width:460px;background:white;border:2px solid #765295;padding:8px;border-radius:8px"><button id="qaRun" type="button">Ejecutar controles QA</button><pre id="qaResults" style="max-height:160px;overflow:auto;font-size:10px;white-space:pre-wrap">Pruebas aisladas, sin Supabase.</pre></aside>');
  $('qaRun').onclick=async()=>{
    $('qaRun').disabled=true;results.length=0;reset();
    await test('Navigation and scope controls',async()=>{
      for(const b of document.querySelectorAll('#sidebar [data-view]')){b.click();await tick();assert(document.querySelector('.view.active')?.id===b.dataset.view,'Navigation '+b.dataset.view)}
      for(const b of document.querySelectorAll('[data-scope]')){b.click();await tick();assert(scope===b.dataset.scope,'Scope '+b.dataset.scope)}
      setScope('all');navigate('dashboard');
    });
    await test('Calendar modes, next, previous and today',async()=>{
      navigate('calendar');for(const mode of ['day','week','month','year']){document.querySelector(`.cal-mode[data-mode="${mode}"]`).click();await tick();assert(calendarMode===mode,mode)}
      const year=calendarDate.getFullYear();await click('calendarNext');assert(calendarDate.getFullYear()===year+1,'Next year');await click('calendarPrev');await click('calendarToday');assert(calendarMode==='day','Today enters day');
    });
    await test('Create activity, validate title and save its checklist',async()=>{
      await click('newTaskBtn');value('taskName','');await click('saveTask');assert($('taskModal').classList.contains('show'),'Blank title must remain open');
      value('taskName','QA creada desde controles');value('taskProject','700010');value('taskTimeHours','1');value('taskTimeMinutes','00');check('taskChecklistEnabled',true);
      value('newChecklistText','Paso nuevo QA');await click('addNewChecklistItem');await click('saveTask');
      const t=tasks.find(t=>t.name==='QA creada desde controles');assert(t,'Activity saved');assert(t.checklist.length===1,'Checklist saved');
      openTaskDetail(t.id);value('activityDetailName','QA editada desde controles');await click('activityDetailSave');assert(t.name==='QA editada desde controles','Detail saved');
      openTaskDetail(t.id);await click('activityDetailChecklist');value('editChecklistText','Segundo paso');await click('addEditChecklistItem');await click('saveChecklist');assert(t.checklist.length===2,'Checklist edited');
    });
    await test('Schedule, reschedule, postpone and complete',async()=>{
      const t=tasks.find(t=>t.name==='QA editada desde controles');openTaskDetail(t.id);await click('activityDetailProgram');value('scheduleDate',isoDate(new Date()));value('scheduleStart','11:00');await click('saveSchedule');assert(t.status==='scheduled','Scheduled');
      openTaskDetail(t.id);await click('activityDetailProgram');value('scheduleStart','15:00');await click('saveSchedule');assert(t.scheduleHistory.some(s=>s.result==='rescheduled'),'Previous schedule retained');
      openTaskDetail(t.id);await click('activityDetailPostpone');assert(t.status==='postponed','Postponed');
      openTaskDetail(t.id);await click('activityDetailComplete');value('completionActualStart','15:00');value('completionActualEnd','16:00');await click('confirmCompletion');assert(t.status==='done'&&t.actualMinutes===60,'Completed with actual time');
    });
    await test('Delete single activity through its real button and transaction UI',async()=>{
      const t=tasks.find(t=>t.name==='QA editada desde controles');openTaskDetail(t.id);await click('activityDetailDelete');assert($('deleteActivityModal').classList.contains('show'),'Delete opens');await click('confirmActivityDelete');assert(!tasks.some(x=>x.id===t.id),'Deleted');
    });
    await test('Delete recurring occurrence, regenerate and keep the exception after persistence',async()=>{
      const t=tasks.find(t=>String(t.recurrenceMasterId)==='700004'),ds=t.recurrenceDate;openTaskDetail(t.id);await click('activityDetailDelete');value('deleteActivityMode','occurrence');await click('confirmActivityDelete');generateRecurringOccurrences();
      assert(!tasks.some(x=>String(x.recurrenceMasterId)==='700004'&&x.recurrenceDate===ds),'Removed occurrence not regenerated');
      assert(JSON.parse(localStorage.getItem('mp2_tasks')).find(x=>x.id===700004).recurrence.excludedDates.includes(ds),'Exception persisted');
    });
    await test('Delete whole recurring series, keep other activities',async()=>{
      openTaskDetail(700004);await click('activityDetailDelete');await click('confirmActivityDelete');assert(!tasks.some(x=>x.id===700004||String(x.recurrenceMasterId)==='700004'),'Series removed');assert(tasks.some(x=>x.id===700001),'Unrelated retained');
    });
    await test('Create recurring meal block, preserve eight work hours, show it in calendar only',async()=>{
      navigate('calendar');await click('calendarBlocks');await click('newTimeBlock');value('blockTitle','QA comida como bloqueo');value('blockFrequency','daily');check('blockReplacesBreak',true);await click('saveTimeBlock');
      assert(workSchedule.timeBlocks.length===1,'Block saved');assert(workCapacityMinutes(isoDate(new Date()))===480,'Meal not double counted');assert(!tasks.some(t=>t.name==='QA comida como bloqueo'),'Not an activity');
      closeModal('timeBlocksModal');await click('calendarToday');assert($('calendarContent').textContent.includes('No disponible · QA comida como bloqueo'),'Daily visible');
      document.querySelector('.cal-mode[data-mode="week"]').click();assert($('calendarContent').querySelector('[data-calendar-block]'),'Weekly calendar visible');
      document.querySelector('.cal-mode[data-mode="month"]').click();assert($('calendarContent').querySelector('.month-block-label'),'Monthly visible');
    });
    await test('Reject scheduling in a meal block, allow its boundary',async()=>{
      openTaskDetail(700001);await click('activityDetailProgram');value('scheduleStart','13:00');assert($('saveSchedule').disabled,'Blocked time disabled');assert($('scheduleValidation').textContent.includes('Horario no disponible'),'Reason shown');
      value('scheduleStart','14:00');assert(!$('saveSchedule').disabled,'Boundary allowed');closeModal('scheduleModal');
    });
    await test('Availability editor preserves saved blocks',async()=>{
      await click('editWorkSchedule');await click('saveWorkScheduleBtn');assert(workSchedule.timeBlocks.length===1,'Blocks survive base schedule save');
      await click('editWorkSchedule');await click('availabilityBlocks');assert($('timeBlocksModal').classList.contains('show'),'Availability blocks entry works');closeModal('timeBlocksModal');
    });
    await test('Edit block, exclude one date and remove it',async()=>{
      const id=workSchedule.timeBlocks[0].id;window.PlanINTActions.openEditor('work',id,isoDate(new Date()));value('blockTitle','QA comida editada');await click('saveTimeBlock');assert(workSchedule.timeBlocks[0].title==='QA comida editada','Edited');
      window.PlanINTActions.openEditor('work',id,isoDate(new Date()));await click('excludeBlockDate');assert(workSchedule.timeBlocks[0].excludedDates.includes(isoDate(new Date())),'Date released');
      window.PlanINTActions.openEditor('work',id);await click('removeTimeBlock');assert(!workSchedule.timeBlocks.length,'Block removed');closeModal('timeBlocksModal');
    });
    await test('Holiday cuts only work availability and preserves personal time',async()=>{
      window.PlanINTActions.openEditor('work');value('blockTitle','QA feriado');check('blockAllDay',true);await click('saveTimeBlock');const ds=isoDate(new Date());assert(workCapacityMinutes(ds)===0,'Work day blocked');assert(personalCapacityMinutes(ds)===300,'Personal preserved');assert(generalAvailabilityCapacityMinutes(ds)===300,'General correct');
      closeModal('timeBlocksModal');
    });
    await test('Profile block sync failure is pending, retry does not duplicate',async()=>{
      window.PlanINTActions.openEditor('personal');value('blockTitle','QA reintento');window.QAFailFlushAt=window.QAFlushCount+2;await click('saveTimeBlock');
      assert($('blockEditorStatus').textContent.includes('pendiente'),'Pending shown');assert(personalSchedule.timeBlocks.length===1,'One pending block');window.QAFailFlushAt=0;await click('saveTimeBlock');assert(personalSchedule.timeBlocks.length===1,'Retry does not duplicate');closeModal('timeBlocksModal');
    });
    await test('Convert recurring meal preserves history and removes only future pending',async()=>{
      reset();const completed=tasks.find(t=>t.recurrenceMasterId===700004);completed.status='done';completed.completedDate=isoDate(new Date());save();
      openTaskDetail(700004);await click('activityDetailConvert');value('blockFrequency','daily');check('blockReplacesBreak',true);await click('saveTimeBlock');
      assert(workSchedule.timeBlocks.length===1,'Converted to block');assert(tasks.some(t=>t.id===completed.id&&t.status==='done'),'History kept');assert(!tasks.some(t=>t.recurrenceMasterId===700004&&t.status!=='done'),'Future pending removed');closeModal('timeBlocksModal');
    });
    await test('Projects and management create, edit and archive',async()=>{
      await click('newProjectBtn');value('projectName','QA Proyecto');value('projectScope','work');await click('saveProject');const p=projects.find(x=>x.name==='QA Proyecto');assert(p&&p.type==='project','Project created');
      openOriginModal(p.id);value('projectName','QA Proyecto editado');await click('saveProject');assert(p.name==='QA Proyecto editado','Project edited');openOriginModal(p.id);await click('archiveOriginBtn');assert(p.archived,'Archived');closeModal('projectModal');
      await click('newManagementBtn');value('projectName','QA Gestión');value('projectScope','personal');await click('saveProject');assert(projects.some(x=>x.name==='QA Gestión'&&x.type==='management'),'Management created');
    });
    await test('Important dates create and edit',async()=>{
      await click('newImportantBtn');value('importantName','QA fecha');value('importantDate',isoDate(new Date()));await click('saveImportant');const item=importantDates.find(x=>x.name==='QA fecha');assert(item,'Created');openImportantEditor(item.id);value('importantName','QA fecha editada');await click('saveImportant');assert(item.name==='QA fecha editada','Edited');
    });
    await test('Habits create and edit with tracking preserved',async()=>{
      await click('newHabitBtn');value('habitName','QA hábito');const first=document.querySelector('[name="habitDay"]');first.checked=true;first.dispatchEvent(new Event('change',{bubbles:true}));await click('saveHabitBtn');const h=habits.find(x=>x.name==='QA hábito');assert(h,'Habit created');h.tracking={[isoDate(new Date())]:'done'};save();window.editHabit(h.id);value('habitName','QA hábito editado');await click('saveHabitBtn');assert(h.tracking[isoDate(new Date())]==='done','Tracking preserved');
    });
    await test('Reminders create, edit and administrative navigation',async()=>{
      await click('navRemindersBtn');await click('remindersAdminNew');value('reminderTitle','QA recordatorio');value('reminderDate',isoDate(new Date()));value('reminderTime','18:30');await click('saveReminderBtn');const r=reminders.find(x=>x.title==='QA recordatorio');assert(r,'Created');window.PlanINTEntityEditors.editReminder(r.id);value('reminderTitle','QA recordatorio editado');await click('saveReminderBtn');assert(r.title==='QA recordatorio editado','Edited');await click('remindersAdminViewUpcoming');document.querySelector('.close-reminders')?.click();navigate('remindersAdmin');await click('remindersAdminBack');
    });
    await test('Backup contains blocks, restore validates and preserves all collections',async()=>{
      document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.remove('show'));const b=backupPayload();assert(b.data.workSchedule.timeBlocks.length===1,'Backup includes blocks');assert(validateBackupPayload(b).ok,'Valid backup');
      renderBackupRestorePreview(b,'qa-backup.json');await click('confirmBackupRestore');assert(backupSemanticEqual(b.data,backupDataSnapshot()),'Restore exact');assert($('qaErrors').textContent.includes('guardada en la nube'),'Success after flush');
    });
    await test('Import preview validation, export and template controls',async()=>{
      navigate('imports');await click('importsOpen');assert($('confirmImport').disabled,'No data cannot import');closeModal('importModal');
      assert(typeof XLSX!=='undefined','SheetJS loaded');await click('importsTemplate');await click('importsExport');
    });
    await test('Week controls and baseline confirmation',async()=>{
      document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.remove('show'));navigate('tracking');await click('trackingWeekBtn');await click('trackingNext');await click('trackingPrev');await click('trackingCurrent');await click('trackingTodayBtn');await click('confirmWeekBaseline');assert(Object.keys(weekBaselines).length>0,'Baseline captured');
    });
    await test('No missing IDs in modal action targets and no uncaught UI errors',async()=>{
      const text=$('qaErrors').textContent;assert(!/not defined|Cannot read|is not a function/.test(text),text);assert(!window.QAUncaught.length,window.QAUncaught.join(';'));
    });
    document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.remove('show'));navigate('calendar');calendarMode='day';renderCalendar();$('qaRun').disabled=false;render();
  };
})();
