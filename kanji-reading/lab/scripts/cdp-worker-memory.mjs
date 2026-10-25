export async function workerMemory(browser,needle='worker-v2.js'){
 const cdp=await browser.newBrowserCDPSession();let sessionId;
 try{
  const {targetInfos}=await cdp.send('Target.getTargets');const target=targetInfos.find(t=>t.type==='worker'&&t.url.includes(needle));if(!target)return {unavailable:'Worker CDP target absent'};
  ({sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false}));
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('CDP heap timeout')),3000);
   cdp.on('Target.receivedMessageFromTarget',e=>{if(e.sessionId!==sessionId)return;const r=JSON.parse(e.message);if(r.id===77){clearTimeout(timer);r.error?reject(Error(r.error.message)):resolve(r.result)}});
   cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:77,method:'Runtime.getHeapUsage'})}).catch(e=>{clearTimeout(timer);reject(e)});
  });return {kind:'CDP Runtime.getHeapUsage in dedicated reading Worker; components only, not total process memory',...result};
 }catch(e){return {unavailable:e.message}}finally{if(sessionId)await cdp.send('Target.detachFromTarget',{sessionId}).catch(()=>{});await cdp.detach()}
}
