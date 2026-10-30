// Preserve detected region geometry; PP-OCR does not measure individual glyphs.
import {assetUrl} from '../camera-prototype/asset-url.mjs';
let core;
const loadCore=()=>core ||= import(/* @vite-ignore */ assetUrl('ppocr-core.mjs'));
export async function initializePPOCR(){return (await loadCore()).initializePPOCR();}
export function snapshotFromPPOCR(run){
 return {...run,engine:'ppocrv6-manga',geometry:'detected-regions',
  lines:(run.extendedRegions||run.classifiedRegions).map((r,id)=>({id,text:r.text,box:[...r.box],
   regionType:r.type,reason:r.reason,parentText:r.parentText,sourceTexts:[...new Set([...(r.sourceTexts||[]),...(r.canonicalRegion?.text?[r.canonicalRegion.text]:[])])],
   geometry:'detected-region',orientation:'unknown',provenance:r.provenance,canonicalRegion:r.canonicalRegion,
   glyphs:[{text:r.text,box:[...r.box],geometry:'detected-region'}]}))};
}
export async function scanPPOCR(source){
 const canonical=await (await loadCore()).recognizePPOCR(source,{resolution:'tiles'});
 const {augmentPPOCR}=await import(/* @vite-ignore */ assetUrl('ppocr-single.mjs'));
 return snapshotFromPPOCR(await augmentPPOCR(source,canonical));
}

// Reuse the canonical classifier on verified geometry, preserving its original
// classifications separately. A clipped body can otherwise make its ruby look
// the same height as body text. No classifier thresholds are changed.
export async function reclassifyVerifiedPPOCR(run){
 if(!run.geometryVerification?.accepted&&!run.overlapVerification?.accepted)return run;
 const core=await loadCore();return {...run,extendedRegions:core.classifyLocal(run.extendedRegions)};
}
