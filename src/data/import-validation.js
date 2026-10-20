(function(root){
  'use strict';
  const text=v=>String(v??'').trim();
  const fold=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function date(value){
    if(value==null||value==='')return '';
    let y,m,d;
    if(value instanceof Date){if(isNaN(value))throw new Error('Fecha compromiso inválida.');y=value.getFullYear();m=value.getMonth()+1;d=value.getDate()}
    else{
      const s=text(value);let match=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]00:00(?::00(?:\.000)?)?(?:Z)?)?$/.exec(s);
      if(match)[,y,m,d]=match.map(Number);
      else{match=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);if(!match)throw new Error('Fecha compromiso inválida: usa una fecha Excel o AAAA-MM-DD.');d=+match[1];m=+match[2];y=+match[3]}
    }
    const check=new Date(0);check.setFullYear(+y,+m-1,+d);check.setHours(12,0,0,0);
    if(y<1900||y>9999||check.getFullYear()!==+y||check.getMonth()+1!==+m||check.getDate()!==+d)throw new Error('Fecha compromiso inválida.');
    return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  function urgency(value){
    const s=fold(value);if(!s)return 'Media';
    const values={baja:'Baja',media:'Media',alta:'Alta',critica:'Crítica',normal:'Media',urgente:'Alta'};
    if(values[s])return values[s];
    throw new Error('Urgencia inválida: usa Baja, Media, Alta o Crítica.');
  }
  function priority(value){const s=fold(value)||'media',values={alta:'Alta',media:'Media',baja:'Baja'};if(!values[s])throw new Error('Prioridad inválida: usa Alta, Media o Baja.');return values[s]}
  const api={date,urgency,priority,fold};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PlanINTImport=api;
})(typeof window==='object'?window:globalThis);
