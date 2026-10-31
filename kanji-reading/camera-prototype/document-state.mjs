// Page results contain OCR data only, never a full-resolution canvas per page.
export class DocumentState{
 pdf=null;name='';count=0;current=0;dpi=300;epoch=0;selected=new Set();records=new Map();
 replace(pdf,name){this.cancel();const old=this.pdf;this.pdf=pdf;this.name=name;this.count=pdf.numPages;this.current=0;this.selected=new Set([1]);this.records=new Map();return old;}
 cancel(){return ++this.epoch;}
 owns(epoch){return epoch===this.epoch;}
 pages(){return [...this.selected].sort((a,b)=>a-b);}
 select(number,selected){if(!Number.isInteger(number)||number<1||number>this.count)throw Error('Invalid page');if(selected)this.selected.add(number);else this.selected.delete(number);}
 remember(number,run,dpi=this.dpi){
  const {rendering,primarySnapshot,recovery,...data}=run;
  this.records.set(number,{run:{...data,rendering:null},dpi});
 }
 ready(){return this.pages().length>0&&this.pages().every(n=>this.records.get(n)?.dpi===this.dpi);}
 clear(){this.cancel();const old=this.pdf;this.pdf=null;this.name='';this.count=this.current=0;this.selected.clear();this.records.clear();return old;}
}
