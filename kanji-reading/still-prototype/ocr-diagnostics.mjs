// Local diagnostics only. No requests or image bytes are included in reports.
export const CAMERA_VERSION='0.2.26';
export async function fingerprintInput(source){
 try{
  const rgba=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height).data;
  const digest=await crypto.subtle.digest('SHA-256',rgba);
  return {width:source.width,height:source.height,rgbaSha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};
 }catch(error){return {width:source.width,height:source.height,error:error.message};}
}
export function createOcrReport(run,{origin='unknown',settings={},environment={}}={}){
 return {schema:'kana-camera-ocr-report-v1',version:CAMERA_VERSION,origin,environment,settings,
  input:run.inputFingerprint,rawText:run.rawText,effectiveText:run.effectiveText,
  snapshot:run.snapshot,reading:{analysis:run.result?.analysis,withheld:run.result?.withheld,pairs:run.result?.pairs},
  rendering:{drawn:(run.rendering?.drawn||[]).map(({backgroundPatch,...label})=>label),omitted:run.rendering?.omitted},timings:run.timings};
}
