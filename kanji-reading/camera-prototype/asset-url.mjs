// Vite injects the project base. In direct module tests use the deployed root.
export function assetUrl(path){
 const base=import.meta.env?.BASE_URL??'/kana-romaji-camera-kanji/';
 return new URL(base+path,location.origin).href;
}
