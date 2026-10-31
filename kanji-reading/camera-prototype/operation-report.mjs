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
export const pdfOperation=createOperationReport({storage:localStorage,version:'0.2.31',environment:{userAgent:globalThis.navigator?.userAgent||'',devicePixelRatio:globalThis.devicePixelRatio||1},changed:()=>globalThis.dispatchEvent?.(new Event('pdf-operation-change'))});
