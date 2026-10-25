// Generation ownership prevents stale recognition from repainting a new scene.
export class CameraSession{
 generation=0;kind='home';busy=false;source=null;
 enter(kind,source=null){this.generation++;this.kind=kind;this.source=source;return this.generation;}
 owns(generation){return generation===this.generation&&this.kind!=='home';}
 async exclusive(job){if(this.busy)return null;this.busy=true;try{return await job();}finally{this.busy=false;}}
}
