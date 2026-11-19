(function(){
  'use strict';
  document.body.insertAdjacentHTML('beforeend',`<dialog id="scheduleConfirmDialog" aria-labelledby="scheduleConfirmTitle" aria-describedby="scheduleConfirmMessage" style="max-width:460px;width:calc(100% - 32px);box-sizing:border-box;border:1px solid #dce4ef;border-radius:18px;padding:24px;color:#192b45;box-shadow:0 18px 70px #172d4b40"><h3 id="scheduleConfirmTitle" style="margin:0 0 14px">Confirmar programación</h3><p id="scheduleConfirmMessage" style="line-height:1.6;overflow-wrap:anywhere"></p><div style="display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin-top:24px"><button type="button" class="btn" id="scheduleConfirmCancel" autofocus>Cancelar</button><button type="button" class="btn primary" id="scheduleConfirmAccept">Confirmar programación</button></div></dialog>`);
  const dialog=document.getElementById('scheduleConfirmDialog');
  let resolvePending=null,previousFocus=null;
  function finish(accepted){
    if(!resolvePending)return;
    const resolve=resolvePending;resolvePending=null;
    if(dialog.open)dialog.close();
    previousFocus?.focus();resolve(accepted);
  }
  document.getElementById('scheduleConfirmAccept').onclick=()=>finish(true);
  document.getElementById('scheduleConfirmCancel').onclick=()=>finish(false);
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false)});
  dialog.addEventListener('close',()=>finish(false));
  window.PlanINTScheduleConfirmation={
    ask(message){
      if(resolvePending)return Promise.resolve(false);
      previousFocus=document.activeElement;
      document.getElementById('scheduleConfirmMessage').textContent=message;
      return new Promise(resolve=>{resolvePending=resolve;try{dialog.showModal()}catch(e){resolvePending=null;resolve(false)}});
    },
    error(message){
      const el=document.getElementById('scheduleValidation');
      el.className='schedule-validation error';el.textContent=message;
      el.setAttribute('tabindex','-1');el.focus();
    }
  };
})();
