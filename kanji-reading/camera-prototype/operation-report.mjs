// Only processing stages, sizes and exceptions; never PDF bytes or recognized text.
export function createOperationReport({storage=null,version='',environment={},changed=()=>{}}={}){
 const key='romaji-pdf-last-operation-v1';let report=null,active=false;
 try{report=JSON.parse(storage?.getItem(key)||'null');}catch{}
 function save(){try{storage?.setItem(key,JSON.stringify(report));}catch{}changed(report);}
 function step(phase,details={}){if(!active)return;report.phase=phase;report.events.push({phase,at:new Date().toISOString(),...details});if(report.events.length>80)report.events.splice(0,report.events.length-80);save();}
 return {
  get current(){return report;},
  begin(details={}){active=true;report={schema:'romaji-pdf-operation-v1',version,startedAt:new Date().toISOString(),environment,complete:false,events:[]};step('file-selected',details);},
  step,
  fail(error){if(!active)return;report.error={phase:report.phase,name:error?.name||'Error',message:error?.message||String(error),stack:error?.stack||null};report.finishedAt=new Date().toISOString();active=false;save();},
  finish(phase='complete'){if(!active)return;step(phase);report.complete=phase==='complete';report.finishedAt=new Date().toISOString();active=false;save();}
 };
}
let localStorage=null;try{localStorage=globalThis.sessionStorage;}catch{}
export const pdfOperation=createOperationReport({storage:localStorage,version:'0.2.33',environment:{userAgent:globalThis.navigator?.userAgent||'',devicePixelRatio:globalThis.devicePixelRatio||1},changed:()=>globalThis.dispatchEvent?.(new Event('pdf-operation-change'))});

export function bindPdfFailurePanel(doc){
 const tools=doc.getElementById('pdf-failure-tools'),message=doc.getElementById('pdf-failure-message'),save=doc.getElementById('pdf-failure-save'),close=doc.getElementById('pdf-failure-close');
 function refresh(){const r=pdfOperation.current;tools.hidden=!r||r.complete||r.phase==='cancelled';message.textContent=r?.error?('PDF failed at '+r.error.phase+': '+r.error.message):('Last PDF step: '+r?.phase);}
 let dismissed=false;
 globalThis.addEventListener?.('pdf-operation-change',()=>{const r=pdfOperation.current;if(r?.error){dismissed=false;refresh();}else if(!dismissed&&r&&!r.finishedAt)tools.hidden=true;});
 close.onclick=()=>{dismissed=true;tools.hidden=true;};
 save.onclick=()=>{const r=pdfOperation.current;if(!r)return;const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download='romaji-pdf-'+r.startedAt.replace(/[^0-9]/g,'')+'.json';doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 refresh();
}
