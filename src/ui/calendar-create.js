(function(){
  'use strict';
  const $=id=>document.getElementById(id);let target=null;
  const originalWeekAdd=openWeekAdd;
  openWeekAdd=function(ds){target=null;return originalWeekAdd(ds)};
  function openSlot(ds,time){
    if(ds<isoDate(new Date()))return;
    originalWeekAdd(ds);target={date:ds,time};$('weekAddDateLabel').textContent=`Para ${formatDateES(ds)} a las ${time}`;
  }
  const originalSchedule=openScheduleModal;
  openScheduleModal=function(id,ds){
    const slot=target;target=null;originalSchedule(id,ds);
    if(slot&&slot.date===ds){$('scheduleStart').value=slot.time;renderScheduleDayLoad()}
  };
  const originalBank=openWeekBankPicker;
  openWeekBankPicker=function(){originalBank();if(target)$('weekBankDateLabel').textContent=`Programar para ${formatDateES(target.date)} a las ${target.time}`};
  function decorate(){
    if(!$('calendarStatusLegend'))$('calendarContent').insertAdjacentHTML('afterbegin','<div class="calendar-status-legend" id="calendarStatusLegend" aria-label="Colores de actividades"><span class="calendar-state-marker pending"><i></i>Gris · Planeada</span><span class="calendar-state-marker done"><i></i>Verde · Terminada</span><span class="calendar-state-marker missed"><i></i>Rojo · No realizada</span><span class="calendar-state-marker unplanned"><i></i>Amarillo · No planeada</span><span class="calendar-state-marker rescheduled"><i></i>Naranja · Reprogramada</span></div>');
    const lanes=[...$('calendarContent').querySelectorAll('.cal-day-lane,.cal-week-lane')];if(!lanes.length)return;
    const dates=lanes.map(l=>l.dataset.date||isoDate(calendarDate)),bounds=calendarTimelineBounds(dates),span=bounds.end-bounds.start;
    for(const lane of lanes){
      const base=lane.dataset.date||isoDate(calendarDate);
      lane.querySelectorAll('[data-calendar-slot]').forEach(e=>e.remove());
      let html='';for(let m=bounds.start;m<bounds.end;m+=30){
        const ds=window.PlanINTAvailability.shift(base,Math.floor(m/1440)),minute=m%1440,time=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'),label=`Programar el ${formatDateES(ds)} a las ${time}`;
        html+=`<button type="button" class="cal-create-slot" data-calendar-slot data-date="${ds}" data-time="${time}" style="top:${(m-bounds.start)/span*100}%;height:${30/span*100}%" aria-label="${esc(label)}" title="Doble clic para ${esc(label.toLowerCase())}" ${ds<isoDate(new Date())?'disabled':''}><span>+ ${time}</span></button>`;
      }
      lane.insertAdjacentHTML('beforeend',html);
    }
    if(!$('calendarCreateHint'))$('calendarContent').insertAdjacentHTML('afterbegin','<p id="calendarCreateHint" class="summary-chart-note">Doble clic sobre una hora libre para crear una actividad o elegir una del Banco. En pantalla táctil, toca el horario; con teclado, usa Enter.</p>');
  }
  const originalCalendar=renderCalendar;
  renderCalendar=function(){originalCalendar();decorate()};
  const select=e=>{const b=e.target.closest('[data-calendar-slot]');if(b&&!b.disabled)openSlot(b.dataset.date,b.dataset.time)};
  $('calendarContent').addEventListener('dblclick',select);
  $('calendarContent').addEventListener('click',e=>{if(e.detail===0)select(e)});
  $('calendarContent').addEventListener('pointerup',e=>{if(e.pointerType==='touch')select(e)});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const text=b.getAttribute('onclick')||'';if(b.id==='newTaskBtn'||b.classList.contains('close-task')||/closeModal\('(weekAddModal|weekBankModal|scheduleModal)'\)/.test(text))target=null});
  decorate();
})();
