/* Corrections operate on one completed occurrence and use the existing cloud outbox. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),A=window.PlanINTCompletionActions;
  let editing=false,busy=false,pending=false,reopenId=null,pendingButton=null;
  $('activityDetailComplete').insertAdjacentHTML('afterend','<button class="btn" id="activityDetailCorrect">Corregir realización</button><button class="btn" id="activityDetailReopen">Reabrir actividad</button>');
  $('completionModal').querySelector('.modal-body').insertAdjacentHTML('beforeend','<p id="completionEditStatus" role="status" aria-live="polite"></p>');
  document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop" id="reopenCompletionModal"><div class="modal"><div class="modal-head"><h3>Reabrir actividad</h3></div><div class="modal-body"><p id="reopenCompletionName"></p><p>La actividad dejará de estar terminada. Se conservarán su programación, checklist y el registro del cierre anterior. Si su fecha planeada ya pasó, quedará como no realizada.</p><p id="reopenCompletionStatus" role="status" aria-live="polite"></p></div><div class="modal-foot"><button class="btn" id="cancelReopenCompletion">Cancelar</button><button class="btn primary" id="confirmReopenCompletion">Reabrir actividad</button></div></div></div>');
  const originalDetail=openTaskDetail;
  openTaskDetail=function(id,ctx){originalDetail(id,ctx);const t=tasks.find(x=>String(x.id)===String(id)),show=t?.status==='done'&&!t.isRecurringMaster;for(const key of ['activityDetailCorrect','activityDetailReopen'])$(key).style.display=show?'inline-flex':'none'};
  const originalOpen=openCompletion;
  openCompletion=function(id){
    if(busy)return;
    if(pending){openModal(pendingButton==='confirmCompletion'?'completionModal':'reopenCompletionModal');return}
    const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
    editing=t.status==='done';
    if(!editing)originalOpen(id);
    else{
      completionTaskId=t.id;$('completionTaskName').textContent=t.name;$('completionTaskDescription').textContent=t.description||'';
      $('completionTaskMeta').textContent=t.scope==='work'?'Laboral':'Personal';
      $('completionDate').value=t.completedDate||'';$('completionActualStart').value=t.actualStart||'';$('completionActualEnd').value=t.actualEnd||'';
      $('completionComments').value=t.closingComments||'';$('completionCommentsCount').textContent=String($('completionComments').value.length);
      $('completionChecklistNotice').textContent='El checklist se conserva sin cambios.';
      updateCompletionDateTile();updateCompletionTimePresentation();openModal('completionModal');
    }
    $('completionModal').querySelector('.modal-head h3').textContent=editing?'Corregir realización':'Confirmar cierre de actividad';
    $('completionTaskStatus').textContent=editing?'Terminada':'Por cerrar';
    $('confirmCompletion').textContent=editing?'Guardar corrección':'Confirmar cierre';$('completionEditStatus').textContent='';
  };
  async function commit(button,status,operation,finish){
    if(pending&&pendingButton!==button.id){$(status).textContent='Primero reintenta el guardado pendiente.';return}
    if(busy)return;busy=true;button.disabled=true;$(status).textContent='Guardando en la nube…';
    try{
      if(!window.PlanINTCloud?.isHydrated())throw new Error('Espera a que termine de cargar tu cuenta.');
      await window.PlanINTCloud.flush();
      if(!pending){applyBackupDataExact(operation());save();pending=true;pendingButton=button.id;renderAll();await window.PlanINTCloud.flush()}
      pending=false;pendingButton=null;$(status).textContent='';finish();
    }catch(e){$(status).textContent=pending?'El cambio está pendiente de sincronizar. Usa el mismo botón para reintentar.':(e.message||'No fue posible guardar.');console.error('PLANINT_COMPLETION',e)}
    finally{busy=false;button.disabled=false}
  }
  $('activityDetailCorrect').onclick=()=>{closeModal('activityDetailModal');openCompletion(taskDetailId)};
  $('activityDetailReopen').onclick=()=>{if(busy)return;if(pending){closeModal('activityDetailModal');openModal(pendingButton==='confirmCompletion'?'completionModal':'reopenCompletionModal');return}reopenId=taskDetailId;$('reopenCompletionName').textContent=tasks.find(x=>x.id===reopenId)?.name||'';$('reopenCompletionStatus').textContent='';closeModal('activityDetailModal');openModal('reopenCompletionModal')};
  $('cancelReopenCompletion').onclick=()=>{if(!busy)closeModal('reopenCompletionModal')};
  $('confirmReopenCompletion').onclick=()=>{const id=reopenId;return commit($('confirmReopenCompletion'),'reopenCompletionStatus',()=>A.change(backupDataSnapshot(),id,null,new Date().toISOString(),isoDate(new Date())),()=>{closeModal('reopenCompletionModal');renderAll()})};
  const originalConfirm=$('confirmCompletion').onclick;
  $('confirmCompletion').onclick=()=>{
    if(!editing)return originalConfirm();
    const id=completionTaskId,v={date:$('completionDate').value,start:$('completionActualStart').value,end:$('completionActualEnd').value,comments:$('completionComments').value.trim()};
    return commit($('confirmCompletion'),'completionEditStatus',()=>A.change(backupDataSnapshot(),id,v,new Date().toISOString(),isoDate(new Date())),()=>{closeModal('completionModal');renderAll()});
  };
})();
