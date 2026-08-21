import React,{useEffect,useRef,useState} from 'react';

type DiagnosticError={time:string;type:string;message:string;source?:string;line?:number;column?:number};

const DB_NAME='field-companion';
const STORE_NAMES=['system','factions','units','profiles','weapons','abilities','keywords','detachments','enhancements','stratagems','points','leaders','source','coreRules','community40kdc','dependencies','searchIndex','user','battle','staging'];

function req<T>(request:IDBRequest<T>){
  return new Promise<T>((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

function txDone(tx:IDBTransaction){
  return new Promise<void>((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error);
    tx.onerror=()=>reject(tx.error);
  });
}

async function existingDatabase(){
  const withDatabases=indexedDB as IDBFactory&{databases?:()=>Promise<{name?:string;version?:number}[]>};
  if(withDatabases.databases){
    const databases=await withDatabases.databases();
    if(!databases.some(database=>database.name===DB_NAME))return null;
  }
  return new Promise<IDBDatabase|null>((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME);
    let created=false;
    request.onupgradeneeded=()=>{created=true;request.transaction?.abort();};
    request.onsuccess=()=>{
      if(created){request.result.close();resolve(null);return;}
      resolve(request.result);
    };
    request.onerror=()=>{
      if(created){resolve(null);return;}
      reject(request.error);
    };
  });
}

async function readSystem(db:IDBDatabase,id:string){
  if(!db.objectStoreNames.contains('system'))return null;
  const tx=db.transaction('system','readonly');
  const row=await req<any>(tx.objectStore('system').get(id));
  await txDone(tx);
  return row?.value??null;
}

async function storeCounts(db:IDBDatabase){
  const output:Record<string,number|'missing'|'error'>={};
  await Promise.all(STORE_NAMES.map(async name=>{
    if(!db.objectStoreNames.contains(name)){output[name]='missing';return;}
    try{
      const tx=db.transaction(name,'readonly');
      output[name]=await req(tx.objectStore(name).count());
      await txDone(tx);
    }catch{output[name]='error';}
  }));
  return output;
}

async function fetchText(path:string){
  try{
    const response=await fetch(path,{cache:'no-store'});
    return response.ok?(await response.text()).trim():`HTTP ${response.status}`;
  }catch(cause){return `ERROR ${String(cause)}`;}
}

async function fetchManifest(){
  try{
    const response=await fetch('./data/version.json',{cache:'no-store'});
    if(!response.ok)return{error:`HTTP ${response.status}`};
    const manifest=await response.json();
    return{
      datasetVersion:manifest?.datasetVersion??null,
      schemaVersion:manifest?.schemaVersion??null,
      edition:manifest?.edition??null,
      scope:manifest?.scope??null,
      resolved:manifest?.resolved??null,
      packages:Object.fromEntries(Object.entries(manifest?.factions?.necrons?.packages||{}).map(([name,value]:[string,any])=>[name,{file:value?.file,hash:value?.hash}])),
    };
  }catch(cause){return{error:String(cause)};}
}

async function cacheNames(){
  try{return 'caches' in window?await caches.keys():[];}catch{return[];}
}

async function collectDiagnostics(errors:DiagnosticError[]){
  const db=await existingDatabase().catch(()=>null);
  let indexedDb:any={available:Boolean(db)};
  if(db){
    try{
      indexedDb={
        available:true,
        version:db.version,
        stores:Array.from(db.objectStoreNames),
        counts:await storeCounts(db),
        installed:await readSystem(db,'installed'),
        pendingUpdate:await readSystem(db,'pending-update'),
        legacyMigrated:await readSystem(db,'legacy-migrated'),
      };
    }finally{db.close();}
  }

  const [buildCommit,bundledManifest,cacheStorage]=await Promise.all([
    fetchText('./build-commit.txt'),
    fetchManifest(),
    cacheNames(),
  ]);
  const connection=(navigator as Navigator&{connection?:{type?:string;effectiveType?:string;downlink?:number;rtt?:number}}).connection;
  return{
    generatedAt:new Date().toISOString(),
    app:{buildCommit,href:location.href,origin:location.origin,userAgent:navigator.userAgent},
    network:{online:navigator.onLine,type:connection?.type??null,effectiveType:connection?.effectiveType??null,downlink:connection?.downlink??null,rtt:connection?.rtt??null},
    serviceWorker:{supported:'serviceWorker' in navigator,controlled:Boolean(navigator.serviceWorker?.controller),controllerScript:navigator.serviceWorker?.controller?.scriptURL??null,cacheNames:cacheStorage},
    bundledManifest,
    indexedDb,
    recentErrors:errors.slice(-20),
  };
}

async function copyText(text:string){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    const area=document.createElement('textarea');
    area.value=text;
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied=document.execCommand('copy');
    area.remove();
    return copied;
  }
}

export function DiagnosticsButton(){
  const[open,setOpen]=useState(false);
  const[text,setText]=useState('');
  const[copyLabel,setCopyLabel]=useState('Copy JSON');
  const errors=useRef<DiagnosticError[]>([]);

  useEffect(()=>{
    const onError=(event:ErrorEvent)=>errors.current.push({time:new Date().toISOString(),type:'error',message:event.message,source:event.filename||undefined,line:event.lineno||undefined,column:event.colno||undefined});
    const onRejection=(event:PromiseRejectionEvent)=>errors.current.push({time:new Date().toISOString(),type:'unhandledrejection',message:String(event.reason)});
    window.addEventListener('error',onError);
    window.addEventListener('unhandledrejection',onRejection);
    return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);};
  },[]);

  async function refresh(){
    setText('Collecting diagnostics…');
    try{setText(JSON.stringify(await collectDiagnostics(errors.current),null,2));}
    catch(cause){setText(JSON.stringify({generatedAt:new Date().toISOString(),diagnosticsError:String(cause),recentErrors:errors.current.slice(-20)},null,2));}
  }

  async function show(){setOpen(true);await refresh();}
  async function copy(){const ok=await copyText(text);setCopyLabel(ok?'Copied':'Copy failed');window.setTimeout(()=>setCopyLabel('Copy JSON'),1400);}

  const buttonStyle:React.CSSProperties={position:'fixed',top:8,right:8,zIndex:1000,width:30,height:30,padding:0,borderRadius:7,border:'1px solid #38433e',background:'rgba(11,14,13,.72)',color:'#9aa8a0',font:'600 11px ui-monospace,SFMono-Regular,Consolas,monospace',opacity:.62};
  const overlayStyle:React.CSSProperties={position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'48px 12px 12px'};
  const panelStyle:React.CSSProperties={width:'min(760px,100%)',maxHeight:'calc(100vh - 60px)',overflow:'auto',background:'#151b18',border:'1px solid #38433e',borderRadius:12,padding:12,color:'#edf3ef'};
  const preStyle:React.CSSProperties={whiteSpace:'pre-wrap',overflowWrap:'anywhere',font:'11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace',background:'#0b0e0d',border:'1px solid #2a332f',borderRadius:8,padding:10,maxHeight:'65vh',overflow:'auto'};
  const actionStyle:React.CSSProperties={background:'#202824',color:'#edf3ef',border:'1px solid #38433e',borderRadius:8,padding:'8px 10px'};

  return <>
    <button type='button' aria-label='Open diagnostics JSON' title='Diagnostics JSON' style={buttonStyle} onClick={()=>void show()}>{'{}'}</button>
    {open&&<div role='dialog' aria-modal='true' aria-label='Diagnostics JSON' style={overlayStyle} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section style={panelStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8}}>
          <strong>Diagnostics JSON</strong>
          <div style={{display:'flex',gap:6}}>
            <button type='button' style={actionStyle} onClick={()=>void refresh()}>Refresh</button>
            <button type='button' style={actionStyle} onClick={()=>void copy()}>{copyLabel}</button>
            <button type='button' style={actionStyle} onClick={()=>setOpen(false)}>Close</button>
          </div>
        </div>
        <p style={{color:'#9aa8a0',fontSize:12,margin:'0 0 8px'}}>Copy this JSON into the GitHub issue or ChatGPT when the app behaves incorrectly.</p>
        <pre style={preStyle}>{text}</pre>
      </section>
    </div>}
  </>;
}
