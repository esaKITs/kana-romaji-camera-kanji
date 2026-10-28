// Preserve detected region geometry; PP-OCR does not measure individual glyphs.
import {assetUrl} from '../camera-prototype/asset-url.mjs';
let core;
const loadCore=()=>core ||= import(/* @vite-ignore */ assetUrl('ppocr-core.mjs'));
export async function initializePPOCR(){return (await loadCore()).initializePPOCR();}
export function snapshotFromPPOCR(run){
 return {...run,engine:'ppocrv6-manga',geometry:'detected-regions',
  lines:(run.extendedRegions||run.classifiedRegions).map((r,id)=>({id,text:r.text,box:[...r.box],
   regionType:r.type,reason:r.reason,parentText:r.parentText,
   geometry:'detected-region',orientation:'unknown',
   glyphs:[{text:r.text,box:[...r.box],geometry:'detected-region'}]}))};
}
export async function scanPPOCR(source){
 const canonical=await (await loadCore()).recognizePPOCR(source,{resolution:'tiles'});
 const {augmentPPOCR}=await import(/* @vite-ignore */ assetUrl('ppocr-single.mjs'));
 return snapshotFromPPOCR(await augmentPPOCR(source,canonical));
}
