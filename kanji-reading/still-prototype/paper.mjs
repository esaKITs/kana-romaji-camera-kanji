// Port of first-edition sampledPaperColor / paperFamily / unifiedLabelPaper.
// The source image is read, never the already-painted overlay.
export function sampledPaperColor(b,image){
 if(!image.width||!image.height)return[245,245,245];
 const x0=Math.max(0,Math.floor(b.x0)),x1=Math.min(image.width,Math.ceil(b.x1)),y0=Math.max(0,Math.floor(b.y0)),y1=Math.min(image.height,Math.ceil(b.y1));
 if(x1<=x0||y1<=y0)return[245,245,245];
 const pixels=image.getContext('2d',{willReadFrequently:true}).getImageData(x0,y0,x1-x0,y1-y0).data,w=x1-x0,h=y1-y0,samples=[],bins=new Map();
 for(let row=0;row<Math.min(16,h);row++)for(let col=0;col<Math.min(40,w);col++){
  const y=Math.min(h-1,Math.floor((row+.5)*h/Math.min(16,h))),x=Math.min(w-1,Math.floor((col+.5)*w/Math.min(40,w))),k=(y*w+x)*4;if(pixels[k+3]<128)continue;
  const rgb=[pixels[k],pixels[k+1],pixels[k+2]],key=rgb.map(v=>v>>5).join(',');samples.push(rgb);const bin=bins.get(key)||{count:0,sum:[0,0,0]};bin.count++;rgb.forEach((v,c)=>bin.sum[c]+=v);bins.set(key,bin);
 }
 if(!samples.length)return[245,245,245];let paper=[];
 for(const bin of [...bins.values()].sort((a,b)=>b.count-a.count).slice(0,8)){const center=bin.sum.map(v=>v/bin.count),cluster=samples.filter(rgb=>rgb.reduce((v,c,i)=>v+(c-center[i])**2,0)<35**2);if(cluster.length>paper.length)paper=cluster;}
 return[0,1,2].map(c=>Math.round(paper.reduce((sum,rgb)=>sum+rgb[c],0)/Math.max(1,paper.length)));
}
export function paperFamily(rgb){const[r,g,b]=rgb,spread=Math.max(r,g,b)-Math.min(r,g,b);if(Math.min(r,g,b)>=208&&spread<=30)return'white';if(r>g*1.07&&r>b*1.12&&r-g>=18)return'warm';return'other';}
const distance=(a,b)=>Math.sqrt(a.reduce((n,v,i)=>n+(v-b[i])**2,0));
export function selectPapers(samples){
 const groups=[];for(const sample of samples){const family=paperFamily(sample.rgb),weight=sample.weight??1;let group=groups.find(g=>g.family===family&&(family==='white'||distance(g.rgb,sample.rgb)<58));if(!group){group={family,rgb:[...sample.rgb],weight:0};groups.push(group);}const sum=group.weight+weight;group.rgb=group.rgb.map((v,i)=>(v*group.weight+sample.rgb[i]*weight)/sum);group.weight=sum;}
 const ranked=groups.sort((a,b)=>b.weight-a.weight),selected=[];for(const family of ['white','warm']){const group=ranked.find(g=>g.family===family);if(group)selected.push(group);}for(const group of ranked)if(selected.length<3&&!selected.includes(group))selected.push(group);
 return selected.length?selected.map(g=>g.rgb.map(Math.round)):[[245,245,245]];
}
export function paperFor(rgb,palette){const family=paperFamily(rgb),matching=palette.filter(p=>paperFamily(p)===family),choices=matching.length?matching:palette;return choices.reduce((best,p)=>distance(rgb,p)<distance(rgb,best)?p:best,choices[0]);}
export function foregroundFor(paper){return paper[0]*.299+paper[1]*.587+paper[2]*.114>145?'#15212a':'#ffffff';}
export class StablePapers{
 constructor(){this.reset();}
 reset(){this.papers=null;}
 resolve(samples){
  const candidate=selectPapers(samples);if(!this.papers)this.papers=candidate;
  // Keep existing tones fixed within one scene. New families may use spare slots.
  for(const p of candidate)if(this.papers.length<3&&!this.papers.some(q=>paperFamily(q)===paperFamily(p)&&(paperFamily(p)==='white'||distance(p,q)<58)))this.papers.push(p);
  return this.papers.map(p=>[...p]);
 }
}
// Camera-only palette: fixed representatives suppress color pumping while allowing
// many local paper colors. Bounded storage; the original three-tone lab stays intact.
export class AdaptivePapers{
 constructor({limit=32,tolerance=24}={}){this.limit=limit;this.tolerance=tolerance;this.reset();}
 reset(){this.papers=[];this.labels=new Map();}
 resolve(samples){
  for(const {rgb} of [...samples].sort((a,b)=>(b.weight??1)-(a.weight??1))){
   if(this.papers.length<this.limit&&!this.papers.some(p=>distance(p,rgb)<=this.tolerance))this.papers.push(rgb.map(Math.round));
  }
  return this.papers.length?this.papers.map(p=>[...p]):[[245,245,245]];
 }
 colorFor(rgb,label){
  const b=label.box,key=(label.source??label.output)+':'+Math.round((b.y0+b.y1)/Math.max(20,b.y1-b.y0));
  const previous=this.labels.get(key);
  if(previous&&distance(previous,rgb)<44)return [...previous];
  const chosen=this.papers.reduce((best,p)=>distance(rgb,p)<distance(rgb,best)?p:best,this.papers[0]??rgb);
  if(this.labels.size>=512)this.labels.delete(this.labels.keys().next().value);
  this.labels.set(key,[...chosen]);return [...chosen];
 }
}
