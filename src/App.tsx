import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,ChevronDown,Database,ExternalLink,Minus,Plus,RotateCcw,Search,Settings,Shield,Trash2} from 'lucide-react';
import {checkForUpdates,migrateLegacy,readBattle,readUser,system,writeBattle,writeUser} from './db';
import {createBattleState,phases,remainingUnitWounds,stateForModelWounds,stateForRemainingWounds,totalScore,totalUnitWounds,unitWounds} from './battle';
import {availableSizes,defaultSize,isCategory,loadNecrons,pointsFor,subfactionKeyword} from './data';
import {applyRequiredBindings,compatibleBodyguards,configurationGroups,createRosterUnit,defaultWargear,removeUnavailableEnhancements,rosterPoints,validateRoster} from './roster';
import {attachmentRoleFor,connectionNotesForEntry,eligibleEnhancementsForUnit,eligibleStratagemTargets,requiredBindingForUnit,retinueConditionFor,ruleMetaLine,stratagemAvailable} from './rules';
import type {BattleState,Detachment,Enhancement,InstalledRulesMeta,Phase,RosterUnit,Stratagem,UnitDetail,UnitIndex,ValidationIssue} from './types';

const CORE_RULES_URL='https://www.warhammer-community.com/en-gb/downloads/warhammer-40000/';
const POINTS_LIMIT=2000;
type UpdateSettings={automatic:boolean;wifiOnly:boolean;manualOnly:boolean};
type LoadedRules=Awaited<ReturnType<typeof loadNecrons>>;

function unitSearchText(unit:UnitIndex,detail?:UnitDetail){
  return JSON.stringify({...unit,details:detail}).toLowerCase();
}

export function App(){
  const[units,setUnits]=useState<UnitIndex[]>([]);
  const[details,setDetails]=useState<Map<string,UnitDetail>>(new Map());
  const[detachments,setDetachments]=useState<Detachment[]>([]);
  const[stratagems,setStratagems]=useState<Stratagem[]>([]);
  const[selected,setSelected]=useState<string[]>(['Cursed Legion']);
  const[roster,setRoster]=useState<RosterUnit[]>([]);
  const[battle,setBattle]=useState<BattleState|null>(null);
  const[tab,setTab]=useState<'build'|'battle'|'search'|'settings'>('build');
  const[query,setQuery]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(true);
  const[installed,setInstalled]=useState<InstalledRulesMeta|null>(null);
  const[updateMessage,setUpdateMessage]=useState('');
  const[settings,setSettings]=useState<UpdateSettings>({automatic:true,wifiOnly:false,manualOnly:false});
  const selectedRef=useRef(selected);

  useEffect(()=>{selectedRef.current=selected;},[selected]);

  function applyLoadedRules(data:LoadedRules){
    setUnits(data.index);
    setDetails(data.detailMap);
    setDetachments(data.detachments);
    setStratagems(data.stratagems);
    const validSelected=selectedRef.current.filter(name=>data.detachments.some(detachment=>detachment.name===name));
    if(validSelected.length!==selectedRef.current.length){
      selectedRef.current=validSelected;
      setSelected(validSelected);
    }
    const activeDetachments=data.detachments.filter(detachment=>validSelected.includes(detachment.name));
    const activeEnhancements=activeDetachments.flatMap(detachment=>detachment.enhancements||[]);
    setRoster(current=>applyRequiredBindings(removeUnavailableEnhancements(current,activeDetachments),data.index,activeEnhancements));
  }

  useEffect(()=>{
    let cancelled=false;
    void(async()=>{
      try{
        // Migration must finish before durable reads so first launch cannot race stale localStorage against IndexedDB.
        await migrateLegacy();
        const[data,storedDetachments,storedRoster,storedBattle,storedSettings]=await Promise.all([
          loadNecrons(),
          readUser<string[]>('detachments',['Cursed Legion']),
          readUser<RosterUnit[]>('roster',[]),
          readBattle(),
          readUser<UpdateSettings>('settings',{automatic:true,wifiOnly:false,manualOnly:false}),
        ]);
        if(cancelled)return;
        const validSelected=storedDetachments.filter(name=>data.detachments.some(detachment=>detachment.name===name));
        selectedRef.current=validSelected;
        setUnits(data.index);
        setDetails(data.detailMap);
        setDetachments(data.detachments);
        setStratagems(data.stratagems);
        setSelected(validSelected);
        const activeEnhancements=data.detachments
          .filter(detachment=>validSelected.includes(detachment.name))
          .flatMap(detachment=>detachment.enhancements||[]);
        setRoster(applyRequiredBindings(storedRoster,data.index,activeEnhancements));
        setBattle(storedBattle);
        setSettings(storedSettings);
        setInstalled(await system<InstalledRulesMeta|null>('installed',null));
      }catch(cause){
        if(!cancelled)setError(String(cause));
      }finally{
        if(!cancelled)setLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{if(!loading)void writeUser('roster',roster);},[roster,loading]);
  useEffect(()=>{if(!loading)void writeUser('detachments',selected);},[selected,loading]);
  useEffect(()=>{if(!loading)void writeBattle(battle);},[battle,loading]);
  useEffect(()=>{if(!loading)void writeUser('settings',settings);},[settings,loading]);

  useEffect(()=>{
    let cancelled=false;
    const connection=(navigator as Navigator&{connection?:{type?:string}}).connection;
    const wifiBlocked=settings.wifiOnly&&(!connection||connection.type!=='wifi');
    if(!loading&&settings.automatic&&!settings.manualOnly&&navigator.onLine&&!battle&&!wifiBlocked){
      void checkForUpdates().then(async result=>{
        if(cancelled)return;
        if(result.status==='updated'){
          const data=await loadNecrons();
          if(cancelled)return;
          applyLoadedRules(data);
          setUpdateMessage(`Background update installed: ${result.changed.join(', ')}`);
          setInstalled(await system<InstalledRulesMeta|null>('installed',null));
        }
      }).catch(()=>{});
    }
    return()=>{cancelled=true;};
  },[loading,settings.automatic,settings.manualOnly,settings.wifiOnly,battle]);

  const selectedDetachments=useMemo(()=>detachments.filter(detachment=>selected.includes(detachment.name)),[detachments,selected]);
  const selectedEnhancements=useMemo(()=>selectedDetachments.flatMap(detachment=>detachment.enhancements||[]),[selectedDetachments]);
  const totalDP=useMemo(()=>selectedDetachments.reduce((sum,detachment)=>sum+detachment.dp,0),[selectedDetachments]);
  const totalPoints=useMemo(()=>rosterPoints(roster,units,selectedDetachments),[roster,units,selectedDetachments]);
  const issues=useMemo(()=>validateRoster({roster,units,details,detachments,selectedDetachments:selected,pointsLimit:POINTS_LIMIT}),[roster,units,details,detachments,selected]);
  const errors=useMemo(()=>issues.filter(issue=>issue.level==='error'),[issues]);
  const searchText=useMemo(()=>new Map(units.map(unit=>[unit.id,unitSearchText(unit,details.get(unit.id))])),[units,details]);
  const normalizedQuery=query.trim().toLowerCase();
  const filtered=useMemo(()=>units.filter(unit=>!unit.legends&&(!normalizedQuery||searchText.get(unit.id)?.includes(normalizedQuery))),[units,searchText,normalizedQuery]);

  function toggleDetachment(detachment:Detachment){
    if(selected.includes(detachment.name)){
      const nextSelected=selected.filter(name=>name!==detachment.name);
      const nextDetachments=detachments.filter(candidate=>nextSelected.includes(candidate.name));
      selectedRef.current=nextSelected;
      setSelected(nextSelected);
      setRoster(current=>removeUnavailableEnhancements(current,nextDetachments));
    }else if(totalDP+detachment.dp<=3){
      const nextSelected=[...selected,detachment.name];
      const nextDetachments=detachments.filter(candidate=>nextSelected.includes(candidate.name));
      const nextEnhancements=nextDetachments.flatMap(candidate=>candidate.enhancements||[]);
      selectedRef.current=nextSelected;
      setSelected(nextSelected);
      setRoster(current=>applyRequiredBindings(current,units,nextEnhancements));
    }
  }

  function addUnit(unit:UnitIndex){
    const created=createRosterUnit(unit,details.get(unit.id));
    setRoster(current=>applyRequiredBindings([...current,created],units,selectedEnhancements));
  }

  function patchEntry(instanceId:string,patch:Partial<RosterUnit>){
    setRoster(current=>current.map(entry=>entry.instanceId===instanceId?{...entry,...patch}:entry));
  }

  function changeSize(entry:RosterUnit,models:number){
    patchEntry(entry.instanceId,{models,wargear:defaultWargear(details.get(entry.unitId),models)});
  }

  function setWarlord(instanceId:string){
    setRoster(current=>current.map(entry=>({...entry,warlord:entry.instanceId===instanceId})));
  }

  async function checkUpdatesNow(){
    try{
      setUpdateMessage('Checking…');
      const result=await checkForUpdates(true);
      if(result.status==='updated'){
        const data=await loadNecrons();
        applyLoadedRules(data);
        setUpdateMessage(`Installed: ${result.changed.join(', ')}`);
      }else if(result.status==='deferred'){
        setUpdateMessage(`Update waiting for the active battle to end: ${result.changed.join(', ')}`);
      }else if(result.status==='current'){
        setUpdateMessage('Local rules are current.');
      }else{
        setUpdateMessage('Offline — local rules remain active.');
      }
      setInstalled(await system<InstalledRulesMeta|null>('installed',null));
    }catch(cause){
      setUpdateMessage(`Update rejected: ${String(cause)}`);
    }
  }

  return <main className='app'>
    <header className='top'>
      <div><div className='eyebrow'>40K FIELD COMPANION</div><h1>Necrons — Strike Force</h1><p>Configure the army, validate it, then carry the same roster into battle.</p></div>
      <div className={`points ${totalPoints>POINTS_LIMIT?'over':''}`}><b>{totalPoints}</b><span>/ {POINTS_LIMIT} pts</span></div>
    </header>
    <div className='status'>
      <span><Database size={14}/>{loading?'Loading rules data…':error?'Rules data unavailable':'Rules data ready'}</span>
      <span>{totalDP}/3 DP selected</span>
      <span className={errors.length?'invalid':'valid'}>{errors.length?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>} {errors.length?`${errors.length} legality issue${errors.length===1?'':'s'}`:'Army legal'}</span>
    </div>
    {error&&<div className='error'>{error}</div>}
    <nav className='tabs' aria-label='App sections'>
      {(['build','battle','search','settings'] as const).map(name=><button className={tab===name?'active':''} aria-pressed={tab===name} onClick={()=>setTab(name)} key={name}>{name[0].toUpperCase()+name.slice(1)}</button>)}
    </nav>
    {tab==='build'&&<BuildView units={units} details={details} detachments={detachments} selected={selected} totalDP={totalDP} roster={roster} issues={issues} onToggleDetachment={toggleDetachment} onAdd={addUnit} onPatch={patchEntry} onSize={changeSize} onWarlord={setWarlord} onRemove={instanceId=>setRoster(current=>current.filter(entry=>entry.instanceId!==instanceId))}/>} 
    {tab==='battle'&&<BattleView roster={roster} units={units} details={details} selectedDetachments={selectedDetachments} stratagems={stratagems} issues={errors} battle={battle} setBattle={setBattle}/>} 
    {tab==='search'&&<SearchView query={query} setQuery={setQuery} units={filtered} details={details} onAdd={addUnit}/>} 
    {tab==='settings'&&<SettingsView installed={installed} settings={settings} setSettings={setSettings} updateMessage={updateMessage} onCheck={checkUpdatesNow}/>} 
  </main>;
}

function SettingsView({installed,settings,setSettings,updateMessage,onCheck}:{installed:InstalledRulesMeta|null;settings:UpdateSettings;setSettings:React.Dispatch<React.SetStateAction<UpdateSettings>>;updateMessage:string;onCheck:()=>Promise<void>}){
  const patch=(change:Partial<UpdateSettings>)=>setSettings(current=>({...current,...change}));
  return <section className='panel'>
    <div className='row'><div><div className='eyebrow'>LOCAL RULES DATABASE</div><h2>Offline settings</h2></div><Settings size={22}/></div>
    <p className='muted'>Rules, rosters and active battles live on this phone. Network checks only fetch a tiny manifest, then only changed packages.</p>
    <div className='formGrid'>
      <label className='checkLabel'><input type='checkbox' checked={settings.automatic} onChange={event=>patch({automatic:event.target.checked,manualOnly:!event.target.checked})}/> Automatic update checks</label>
      <label className='checkLabel'><input type='checkbox' checked={settings.manualOnly} onChange={event=>patch({manualOnly:event.target.checked,automatic:!event.target.checked})}/> Manual updates only</label>
      <label className='checkLabel'><input type='checkbox' checked={settings.wifiOnly} onChange={event=>patch({wifiOnly:event.target.checked})}/> Wi‑Fi only (automatic checks pause when detection is unavailable)</label>
    </div>
    <div className='rulePanel'><strong>Installed dataset: {installed?.datasetVersion||'initializing'}</strong><p>Schema {installed?.schemaVersion||1} · Last successful update: {installed?.lastSuccessfulUpdate?new Date(installed.lastSuccessfulUpdate).toLocaleString():'—'} · {navigator.onLine?'Online':'Offline'}</p></div>
    <button className='addButton' onClick={()=>void onCheck()}>Check for updates now</button>
    {updateMessage&&<p className='muted' aria-live='polite'>{updateMessage}</p>}
  </section>;
}

function BuildView(props:{units:UnitIndex[];details:Map<string,UnitDetail>;detachments:Detachment[];selected:string[];totalDP:number;roster:RosterUnit[];issues:ValidationIssue[];onToggleDetachment:(detachment:Detachment)=>void;onAdd:(unit:UnitIndex)=>void;onPatch:(instanceId:string,patch:Partial<RosterUnit>)=>void;onSize:(entry:RosterUnit,models:number)=>void;onWarlord:(instanceId:string)=>void;onRemove:(instanceId:string)=>void;}){
  const{units,details,detachments,selected,totalDP,roster,issues}=props;
  const[catalogueQuery,setCatalogueQuery]=useState('');
  const[detachmentOpen,setDetachmentOpen]=useState(true);
  const selectedDetachments=useMemo(()=>detachments.filter(detachment=>selected.includes(detachment.name)),[detachments,selected]);
  const enhancements=useMemo(()=>selectedDetachments.flatMap(detachment=>detachment.enhancements||[]),[selectedDetachments]);
  const issuesByInstance=useMemo(()=>{
    const map=new Map<string,ValidationIssue[]>();
    for(const issue of issues){
      if(!issue.unitInstanceId)continue;
      map.set(issue.unitInstanceId,[...(map.get(issue.unitInstanceId)||[]),issue]);
    }
    return map;
  },[issues]);
  const catalogueSearch=useMemo(()=>new Map(units.map(unit=>[unit.id,unitSearchText(unit,details.get(unit.id))])),[units,details]);
  const normalizedCatalogueQuery=catalogueQuery.trim().toLowerCase();
  const catalogue=useMemo(()=>units.filter(unit=>!unit.legends&&(!normalizedCatalogueQuery||catalogueSearch.get(unit.id)?.includes(normalizedCatalogueQuery))),[units,catalogueSearch,normalizedCatalogueQuery]);
  const categories=useMemo(()=>Array.from(catalogue.reduce((groups,unit)=>{
    const category=catalogueCategory(unit);
    groups.set(category,[...(groups.get(category)||[]),unit]);
    return groups;
  },new Map<string,UnitIndex[]>()).entries()).sort(([a],[b])=>a.localeCompare(b)),[catalogue]);
  const connectionRows=useMemo(()=>roster.flatMap(entry=>{
    const unit=units.find(candidate=>candidate.id===entry.unitId);
    if(!unit)return[];
    const notes=connectionNotesForEntry(entry,unit,roster,units,enhancements);
    return notes.length?[{entry,unit,notes}]:[];
  }),[roster,units,enhancements]);

  return <>
    <details className='panel detachmentPanel' open={detachmentOpen} onToggle={event=>setDetachmentOpen(event.currentTarget.open)}>
      <summary className='panelSummary'><span>Detachments</span><small>{totalDP}/3 DP</small></summary>
      <div className='row panelIntro'><p className='muted'>Select detachments while their combined cost remains at or below 3 DP. UNIQUE tags are enforced.</p><a href={CORE_RULES_URL} target='_blank' rel='noreferrer'>Core rules <ExternalLink size={14}/></a></div>
      <div className='detGrid'>{detachments.map(detachment=>{
        const picked=selected.includes(detachment.name),disabled=!picked&&totalDP+detachment.dp>3;
        return <button key={detachment.name} disabled={disabled} className={`det ${picked?'picked':''}`} onClick={()=>props.onToggleDetachment(detachment)}><div className='row'><strong>{detachment.name}</strong><span>{detachment.dp} DP</span></div><small>{detachment.objective}</small><p>{detachment.ruleText||detachment.summary}</p></button>;
      })}</div>
    </details>

    <section className='validation panel'><div className='eyebrow'>ARMY VALIDATION</div>{!issues.length?<p className='validLine'><CheckCircle2 size={16}/> Army passes every configured legality check.</p>:<ul>{issues.map((issue,index)=><li className={issue.level} key={index}>{issue.message}</li>)}</ul>}</section>

    {!!connectionRows.length&&<section className='panel'><div className='eyebrow'>CONDITIONAL RULE CONNECTIONS</div>{connectionRows.map(({entry,unit,notes})=><div className='rulePanel' key={entry.instanceId}><strong>{unit.name}</strong>{notes.map((note,index)=><p key={index}>{note}</p>)}</div>)}</section>}

    <section className='sectionHead'><div><h2>Your roster</h2><p>Each copy is configured separately, including unit size, loadout, Leader, Support, Retinue, Upgrade, Binding and Enhancement.</p></div></section>
    {!roster.length&&<div className='empty'>Add units from the catalogue below.</div>}
    <div className='stack'>{roster.map((entry,index)=>{
      const unit=units.find(candidate=>candidate.id===entry.unitId);
      if(!unit)return null;
      const detail=details.get(unit.id);
      const bodyguards=compatibleBodyguards(entry,unit,roster,units,enhancements);
      const availableEnhancements=eligibleEnhancementsForUnit(unit,enhancements);
      const requiredBinding=requiredBindingForUnit(unit,enhancements);
      const retinue=retinueConditionFor(unit);
      const role=attachmentRoleFor(unit);
      const attachmentLabel=retinue?.label||role;
      const notes=connectionNotesForEntry(entry,unit,roster,units,enhancements);
      const entryIssues=issuesByInstance.get(entry.instanceId)||[];
      return <article className={`card rosterCard ${entryIssues.length?'cardInvalid':''}`} key={entry.instanceId}>
        <div className='row'><div><div className='eyebrow'>UNIT {index+1}{attachmentLabel?` · ${attachmentLabel.toUpperCase()}`:''}</div><h3>{unit.name}</h3></div><button className='iconButton danger' onClick={()=>props.onRemove(entry.instanceId)} aria-label={`Remove ${unit.name}`}><Trash2 size={17}/></button></div>
        <div className='formGrid'>
          <label>Unit size<select value={entry.models} onChange={event=>props.onSize(entry,Number(event.target.value))}>{availableSizes(unit).map(size=><option key={size} value={size}>{size} models</option>)}</select></label>
          {isCategory(unit,'character')&&<label className='checkLabel'><input type='radio' name='warlord' checked={Boolean(entry.warlord)} onChange={()=>props.onWarlord(entry.instanceId)}/> Warlord</label>}
          {(availableEnhancements.length>0||entry.enhancement)&&<EnhancementToggles name={`enhancement-${entry.instanceId}`} selected={entry.enhancement} enhancements={availableEnhancements} required={Boolean(requiredBinding)} onChange={enhancement=>props.onPatch(entry.instanceId,{enhancement})}/>} 
          {attachmentLabel&&<label>{retinue?`${retinue.label} bodyguard (optional)`:role==='support'?'Support bodyguard (required)':'Leader bodyguard'}<select value={entry.attachedTo||''} onChange={event=>props.onPatch(entry.instanceId,{attachedTo:event.target.value||undefined})}><option value=''>{retinue||role==='leader'?'Not attached':'Select bodyguard'}</option>{bodyguards.map(target=>{const targetUnit=units.find(candidate=>candidate.id===target.unitId);return <option key={target.instanceId} value={target.instanceId}>{targetUnit?.name}</option>})}</select></label>}
        </div>
        <WargearEditor entry={entry} detail={detail} onPatch={props.onPatch}/>
        {!!notes.length&&<div className='rulePanel'><strong>Active connections</strong>{notes.map((note,noteIndex)=><p key={noteIndex}>{note}</p>)}</div>}
        {!!entryIssues.length&&<div className='inlineIssues'>{entryIssues.map((issue,issueIndex)=><span key={issueIndex}>{issue.message}</span>)}</div>}
        <UnitDetails data={detail}/>
      </article>;
    })}</div>

    <section className='sectionHead'><div><h2>Necron unit catalogue</h2><p>Search, then drill into the unit category you want.</p></div></section>
    <div className='search catalogueSearch'><Search size={18}/><input value={catalogueQuery} onChange={event=>setCatalogueQuery(event.target.value)} placeholder='Search this catalogue by unit, role, keyword, weapon…'/></div>
    {!categories.length&&<div className='empty'>No units match that search.</div>}
    <div className='catalogueGroups'>{categories.map(([category,group])=><details className='catalogueGroup' open={Boolean(catalogueQuery)} key={category}><summary><span>{category}</span><small>{group.length} unit{group.length===1?'':'s'}</small></summary><div className='grid'>{group.map(unit=><UnitCard unit={unit} detail={details.get(unit.id)} onAdd={()=>props.onAdd(unit)} key={unit.id}/>)}</div></details>)}</div>
  </>;
}

function catalogueCategory(unit:UnitIndex){
  if(isCategory(unit,'epic hero'))return'Epic Heroes';
  if(isCategory(unit,'character'))return'Characters';
  if(isCategory(unit,'battleline'))return'Battleline';
  if(isCategory(unit,'dedicated transport'))return'Dedicated Transports';
  if(isCategory(unit,'vehicle'))return'Vehicles';
  if(isCategory(unit,'monster'))return'Monsters';
  if(isCategory(unit,'mounted'))return'Mounted';
  if(isCategory(unit,'swarm'))return'Swarms';
  if(isCategory(unit,'infantry'))return'Infantry';
  return unit.role?`${unit.role[0].toUpperCase()}${unit.role.slice(1)} units`:'Other units';
}

function WargearEditor({entry,detail,onPatch}:{entry:RosterUnit;detail?:UnitDetail;onPatch:(id:string,patch:Partial<RosterUnit>)=>void}){
  const{choices,modelGroups}=configurationGroups(detail);
  if(!choices.length&&!modelGroups.length)return null;
  const updateChoices=(groupId:string,optionId:string)=>onPatch(entry.instanceId,{wargear:{...entry.wargear,choices:{...entry.wargear.choices,[groupId]:optionId}}});
  const updateModel=(optionId:string,count:number)=>onPatch(entry.instanceId,{wargear:{...entry.wargear,modelCounts:{...entry.wargear.modelCounts,[optionId]:Math.max(0,count)}}});
  return <details className='config' open><summary>Wargear and model loadouts <ChevronDown size={15}/></summary><div className='formGrid'>{choices.map(group=><label key={group.id}>{group.name}<select value={entry.wargear.choices[group.id]||''} onChange={event=>updateChoices(group.id,event.target.value)}>{group.options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>)}</div>{modelGroups.map(group=><div className='loadoutGroup' key={group.id}><strong>{group.name}</strong><span className='muted'>Assign all {entry.models} models</span>{group.options.map(option=><label key={option.id}><span>{option.name}</span><input type='number' min='0' max={entry.models} value={entry.wargear.modelCounts[option.id]||0} onChange={event=>updateModel(option.id,Number(event.target.value))}/></label>)}</div>)}</details>;
}

function enhancementDescription(enhancement:Enhancement){
  const groups=enhancement.keywordRestrictionGroups?.length?`Requires one of: ${enhancement.keywordRestrictionGroups.map(group=>group.join(' + ')).join(' OR ')}.`:'';
  const restrictions=enhancement.allowedHosts?.length?`Only: ${enhancement.allowedHosts.join(', ')}.`:enhancement.keywordRestrictions?.length?`Requires ${enhancement.keywordRestrictions.filter(value=>value!=='DNU').join(' + ')}.`:'';
  const exclusions=enhancement.exclusionKeywords?.length?`Excludes ${enhancement.exclusionKeywords.join(', ')}.`:'';
  const grants=enhancement.grantKeywords?.length?`Grants ${enhancement.grantKeywords.join(' + ')}.`:'';
  const attachments=enhancement.attachmentBodyguardIds?.length?'Adds conditional bodyguard options.':'';
  return[enhancement.kind==='binding'?'NECRODERMAL BINDING.':enhancement.upgrade?'UPGRADE.':'ENHANCEMENT.',groups||restrictions,exclusions,grants,attachments,enhancement.description||''].filter(Boolean).join(' ');
}

function EnhancementToggles({name,selected,enhancements,required,onChange}:{name:string;selected?:string;enhancements:Enhancement[]|undefined;required?:boolean;onChange:(enhancement?:string)=>void}){
  return <fieldset className='enhancementToggles'><legend>Enhancement / Upgrade / Binding</legend><label className='enhancementToggle'><input type='radio' name={name} checked={!selected} disabled={required} onChange={()=>onChange(undefined)}/><span><strong>None</strong><small>{required?'A mandatory Binding applies to this unit.':'No Enhancement, Upgrade or Binding assigned.'}</small></span></label>{(enhancements||[]).map(enhancement=><label className={`enhancementToggle ${selected===enhancement.name?'selected':''}`} key={enhancement.id||enhancement.name}><input type='radio' name={name} checked={selected===enhancement.name} onChange={()=>onChange(enhancement.name)}/><span><strong>{enhancement.name} <em>+{enhancement.points} pts</em></strong><small>{enhancementDescription(enhancement)}</small></span></label>)}</fieldset>;
}

function UnitCard({unit,detail,onAdd}:{unit:UnitIndex;detail?:UnitDetail;onAdd:()=>void}){
  const retinue=retinueConditionFor(unit),role=attachmentRoleFor(unit),label=retinue?.label||role;
  return <article className='card'><div className='row'><div><h3>{unit.name}</h3><p>{pointsFor(unit,defaultSize(unit))} pts{label?` · ${label.toUpperCase()}`:''}</p></div><button className='addButton' onClick={onAdd}><Plus size={15}/> Add</button></div><Stats stats={unit.stats}/><KeywordChips unit={unit}/>{!!unit.attachTo?.length&&<div className='leader'>Can {role==='support'?'support':'lead'}: {unit.attachTo.join(', ')}</div>}{retinue&&<div className='leader'>{retinue.label}: requires attached {retinue.requiredAttachedKeywords.join(' + ')}</div>}{unit.transportCapacity?.capacity&&<div className='leader'>Transport capacity: {unit.transportCapacity.capacity}</div>}<details><summary>Datasheet details</summary><UnitDetails data={detail}/></details></article>;
}

function configuredLoadout(entry:RosterUnit,detail?:UnitDetail){
  const{choices,modelGroups}=configurationGroups(detail),parts:string[]=[];
  for(const group of choices){const id=entry.wargear.choices[group.id],option=group.options.find(candidate=>candidate.id===id);if(option)parts.push(option.name);}
  for(const group of modelGroups)for(const option of group.options){const count=entry.wargear.modelCounts[option.id]||0;if(count>0)parts.push(`${count}× ${option.name}`);}
  return parts;
}

function BattleView({roster,units,details,selectedDetachments,stratagems,issues,battle,setBattle}:{roster:RosterUnit[];units:UnitIndex[];details:Map<string,UnitDetail>;selectedDetachments:Detachment[];stratagems:Stratagem[];issues:ValidationIssue[];battle:BattleState|null;setBattle:React.Dispatch<React.SetStateAction<BattleState|null>>;}){
  const[expandedUnits,setExpandedUnits]=useState<Set<string>>(new Set());
  useEffect(()=>{
    if(!battle){setExpandedUnits(new Set());return;}
    const activeRoster=battle.rosterSnapshot?.length?battle.rosterSnapshot:roster;
    setExpandedUnits(new Set(activeRoster.map(entry=>entry.instanceId)));
  },[battle?.active,battle?.rosterSnapshot]);

  if(!battle)return <section className='panel battleStart'><Shield size={36}/><h2>Start Battle Mode</h2><p>Your legal army is frozen into a persistent tabletop snapshot for Wounds, models, rules, Command Points and Victory Points.</p>{!!issues.length&&<div className='error'>Resolve the {issues.length} army legality issue{issues.length===1?'':'s'} before starting.</div>}<button disabled={!roster.length||Boolean(issues.length)} onClick={()=>setBattle(createBattleState(roster,selectedDetachments))}>Start battle</button></section>;

  const activeRoster=battle.rosterSnapshot?.length?battle.rosterSnapshot:roster;
  const battleDetachments=battle.detachmentSnapshot?.length?battle.detachmentSnapshot:selectedDetachments;
  const battleEnhancements=battleDetachments.flatMap(detachment=>detachment.enhancements||[]);
  const patch=(change:Partial<BattleState>)=>setBattle(current=>current?{...current,...change}:current);
  const allExpanded=activeRoster.length>0&&activeRoster.every(entry=>expandedUnits.has(entry.instanceId));

  return <>
    <section className='battleDashboard panel'><div className='row'><div><div className='eyebrow'>BATTLE ROUND {battle.round}</div><h2>{totalScore(battle)} VP</h2></div><button className='dangerButton' onClick={()=>setBattle(null)}><RotateCcw size={15}/> Reset battle</button></div><div className='trackerGrid'><Counter label='Command points' value={battle.cp} onChange={cp=>patch({cp:Math.max(0,cp)})}/><label>Battle round<select value={battle.round} onChange={event=>patch({round:Number(event.target.value)})}>{[1,2,3,4,5].map(round=><option value={round} key={round}>Round {round}</option>)}</select></label></div><div className='phaseBar'>{phases.map(phase=><button className={battle.phase===phase?'active':''} aria-pressed={battle.phase===phase} onClick={()=>patch({phase})} key={phase}>{phase}</button>)}</div></section>

    <section className='panel'><div className='eyebrow'>ROUND SCORING</div><div className='scoreGrid'>{[1,2,3,4,5].map(round=><div className={battle.round===round?'currentRound':''} key={round}><strong>R{round}</strong><label>Primary<input type='number' min='0' value={battle.score[round]?.primary||0} onChange={event=>patch({score:{...battle.score,[round]:{...battle.score[round],primary:Number(event.target.value)}}})}/></label><label>Secondary<input type='number' min='0' value={battle.score[round]?.secondary||0} onChange={event=>patch({score:{...battle.score,[round]:{...battle.score[round],secondary:Number(event.target.value)}}})}/></label></div>)}</div></section>

    <section className='panel'><div className='eyebrow'>OBJECTIVE CONTROL</div><div className='objectiveGrid'>{battle.objectives.map(objective=><div className='objective' key={objective.id}><strong>{objective.name}</strong><div>{(['you','opponent','contested'] as const).map(controller=><button className={objective.controller===controller?controller:''} aria-pressed={objective.controller===controller} onClick={()=>patch({objectives:battle.objectives.map(item=>item.id===objective.id?{...item,controller}:item)})} key={controller}>{controller==='you'?'You':controller==='opponent'?'Opponent':'Contested'}</button>)}</div></div>)}</div></section>

    <StratagemPanel phase={battle.phase} stratagems={stratagems} selectedDetachments={battleDetachments} roster={activeRoster} units={units}/>

    <section className='panel'><div className='eyebrow'>ACTIVE DETACHMENT RULES</div>{battleDetachments.map(detachment=><div className='rulePanel' key={detachment.name}><strong>{detachment.name}{detachment.ruleName?` · ${detachment.ruleName}`:''}</strong><p>{detachment.ruleText||detachment.summary||'No local rule text available.'}</p></div>)}</section>

    <div className='row battleArmyHead'><div><div className='eyebrow'>ARMY STATUS</div><h2>Battle units</h2></div><button className='iconButton' onClick={()=>setExpandedUnits(allExpanded?new Set():new Set(activeRoster.map(entry=>entry.instanceId)))}>{allExpanded?'Collapse all':'Expand all'}</button></div>
    <div className='stack'>{activeRoster.map(entry=>{
      const unit=units.find(candidate=>candidate.id===entry.unitId);
      if(!unit)return null;
      const state=battle.units[entry.instanceId]||{modelsRemaining:entry.models,woundsLost:0,destroyed:false};
      const wounds=state.woundsPerModel||unitWounds(unit);
      const startingModels=state.startingModels||entry.models;
      const maximumWounds=totalUnitWounds(startingModels,wounds);
      const woundsRemaining=remainingUnitWounds(state,startingModels,wounds);
      const normalizedState=state.modelWounds?.length===startingModels?state:stateForRemainingWounds(state,startingModels,wounds,woundsRemaining);
      const modelWounds=normalizedState.modelWounds||[];
      const modelsRemaining=modelWounds.length?modelWounds.filter(value=>value>0).length:normalizedState.modelsRemaining;
      const enhancement=battleEnhancements.find(candidate=>candidate.name===entry.enhancement);
      const detail=details.get(unit.id);
      const battleStats=state.stats||entry.stats||unit.stats;
      const battleDetail:UnitDetail=detail?{
        ...detail,
        stats:battleStats,
        weapons:state.weapons||entry.weapons||detail.weapons,
        abilities:state.abilities||entry.abilities||detail.abilities,
      }:{
        ...unit,
        stats:battleStats,
        weapons:state.weapons||entry.weapons||[],
        abilities:state.abilities||entry.abilities||[],
        options:[],
      };
      const loadout=configuredLoadout(entry,detail);
      const notes=connectionNotesForEntry(entry,unit,activeRoster,units,battleEnhancements);
      const update=(change:Partial<typeof state>)=>patch({units:{...battle.units,[entry.instanceId]:{...state,...change}}});
      const setRemaining=(value:number)=>update(stateForRemainingWounds(state,startingModels,wounds,value));
      const setModelWound=(modelIndex:number,value:number)=>{
        const next=[...modelWounds];
        next[modelIndex]=value;
        update(stateForModelWounds(state,startingModels,wounds,next));
      };
      const isExpanded=expandedUnits.has(entry.instanceId);
      return <details className={`card battleUnit ${woundsRemaining===0?'destroyed':''}`} key={entry.instanceId} open={isExpanded} onToggle={event=>{
        const open=event.currentTarget.open;
        setExpandedUnits(current=>{
          if(current.has(entry.instanceId)===open)return current;
          const next=new Set(current);
          if(open)next.add(entry.instanceId);else next.delete(entry.instanceId);
          return next;
        });
      }}>
        <summary><strong>{unit.name}</strong><small>{modelsRemaining}/{startingModels} models · {woundsRemaining}/{maximumWounds} W</small></summary>
        <div className='row'><div><h3>{unit.name}</h3><p>{modelsRemaining}/{startingModels} models · {wounds} Wound{wounds===1?'':'s'} each</p></div><label className='checkLabel'><input type='checkbox' checked={woundsRemaining===0} onChange={event=>setRemaining(event.target.checked?0:Math.min(wounds,maximumWounds))}/> Destroyed</label></div>
        {enhancement&&<div className='assignedEnhancement'><div className='eyebrow'>{enhancement.kind==='binding'?'NECRODERMAL BINDING':enhancement.kind==='upgrade'?'ASSIGNED UPGRADE':'ASSIGNED ENHANCEMENT'}</div><strong>{enhancement.name} <span>+{enhancement.points} pts</span></strong><p>{enhancementDescription(enhancement)}</p></div>}
        <Stats stats={battleStats}/>
        {!!notes.length&&<div className='rulePanel'><strong>Active rule connections</strong>{notes.map((note,index)=><p key={index}>{note}</p>)}</div>}
        {!!loadout.length&&<div className='rulePanel'><strong>Configured loadout</strong><p>{loadout.join(' · ')}</p></div>}
        <div className='trackerGrid'><Counter label={`Wounds remaining (${maximumWounds} starting wounds)`} value={woundsRemaining} max={maximumWounds} onChange={setRemaining}/><div className='counterBox'><span>Models remaining</span><div><b>{modelsRemaining}</b><small>of {startingModels}</small></div></div></div>
        {wounds>1&&modelWounds.length>1&&<ModelWoundTracker values={modelWounds} woundsPerModel={wounds} onChange={setModelWound}/>} 
        <UnitDetails data={battleDetail} phase={battle.phase}/>
        <button className='reanimate compact' disabled={woundsRemaining>=maximumWounds} onClick={()=>setRemaining(woundsRemaining+wounds)}><Plus size={13}/> Reanimation tracker: +{wounds} W</button>
      </details>;
    })}</div>
    <label className='notes panel'>Battle notes<textarea value={battle.notes} onChange={event=>patch({notes:event.target.value})} placeholder='Reserves, once-per-battle abilities, target priorities…'/></label>
  </>;
}

function ModelWoundTracker({values,woundsPerModel,onChange}:{values:number[];woundsPerModel:number;onChange:(index:number,value:number)=>void}){
  return <div className='modelWoundPanel'><div className='row'><strong>Per-model wounds</strong><small className='muted'>Exact current wounds</small></div><div className='modelWoundGrid'>{values.map((value,index)=><div className={`modelWound ${value===0?'destroyedModel':''}`} key={index}><span>M{index+1}</span><div><button aria-label={`Remove a wound from model ${index+1}`} onClick={()=>onChange(index,Math.max(0,value-1))}><Minus size={13}/></button><b>{value}/{woundsPerModel}</b><button aria-label={`Restore a wound to model ${index+1}`} onClick={()=>onChange(index,Math.min(woundsPerModel,value+1))}><Plus size={13}/></button></div></div>)}</div></div>;
}

function StratagemPanel({phase,stratagems,selectedDetachments,roster,units}:{phase:Phase;stratagems:Stratagem[];selectedDetachments:Detachment[];roster:RosterUnit[];units:UnitIndex[]}){
  const enhancements=useMemo(()=>selectedDetachments.flatMap(detachment=>detachment.enhancements||[]),[selectedDetachments]);
  const available=useMemo(()=>stratagems.filter(stratagem=>stratagemAvailable(stratagem,phase,selectedDetachments,roster,units)),[stratagems,phase,selectedDetachments,roster,units]);
  return <section className='panel stratagemPanel'><div className='row'><div><div className='eyebrow'>AVAILABLE STRATAGEMS</div><h2>{phase[0].toUpperCase()+phase.slice(1)} phase</h2></div><span className='muted'>{available.length} available</span></div>{!available.length?<p className='muted'>No Stratagems match this phase, selected detachments and your roster’s eligible targets.</p>:<div className='stratagemList'>{available.map(stratagem=>{const targets=eligibleStratagemTargets(stratagem,roster,units,enhancements);return <details className='stratagem' key={stratagem.id}><summary><span>{stratagem.name}{stratagem.type?` · ${stratagem.type}`:''}</span><small>{Number.isFinite(stratagem.cp)?`${stratagem.cp} CP`:'CP varies'}</small></summary>{stratagem.playerTurn&&<p className='muted'>Turn: {stratagem.playerTurn}</p>}{stratagem.when&&<div className='rulePanel'><strong>WHEN</strong><p>{stratagem.when}</p></div>}{stratagem.target&&<div className='rulePanel'><strong>TARGET</strong><p>{stratagem.target}</p></div>}{stratagem.effect&&<div className='rulePanel'><strong>EFFECT</strong><p>{stratagem.effect}</p></div>}{!stratagem.when&&stratagem.timing&&<p>{stratagem.timing}</p>}{stratagem.description&&<p className='muted'>{stratagem.description}</p>}{!!targets.length&&<div className='synergy'><span>Eligible now: {Array.from(new Set(targets.map(({unit})=>unit.name))).join(', ')}</span></div>}</details>;})}</div>}</section>;
}

function Counter({label,value,onChange,max=99}:{label:string;value:number;onChange:(value:number)=>void;max?:number}){
  return <div className='counterBox'><span>{label}</span><div><button aria-label={`Decrease ${label}`} onClick={()=>onChange(Math.max(0,value-1))}><Minus size={15}/></button><b>{value}</b><button aria-label={`Increase ${label}`} onClick={()=>onChange(Math.min(max,value+1))}><Plus size={15}/></button></div></div>;
}

function SearchView({query,setQuery,units,details,onAdd}:{query:string;setQuery:(value:string)=>void;units:UnitIndex[];details:Map<string,UnitDetail>;onAdd:(unit:UnitIndex)=>void}){
  return <><div className='search'><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder='Search units, keywords, roles, weapons…'/></div><div className='stack'>{units.map(unit=>{const label=retinueConditionFor(unit)?.label||attachmentRoleFor(unit);return <article className='card' key={unit.id}><div className='row'><div><h3>{unit.name}</h3><p>{pointsFor(unit)} pts · {unit.role||'unit'}{label?` · ${label}`:''}</p></div><button className='addButton' onClick={()=>onAdd(unit)}><Plus size={15}/> Add</button></div><UnitDetails data={details.get(unit.id)}/></article>;})}</div></>;
}

function Stats({stats}:{stats:Record<string,string>}){
  const keys:[string,string][]=[['M','M'],['T','T'],['Sv','Sv'],['W','W'],['Ld','LD'],['LD','LD'],['OC','OC'],['InSv','Inv']];
  const seen=new Set<string>();
  return <div className='stats'>{keys.map(([key,label])=>{if(!stats[key]||seen.has(label))return null;seen.add(label);return <div key={key}><span>{label}</span><b>{stats[key]}</b></div>;})}</div>;
}

function KeywordChips({unit}:{unit:UnitIndex}){
  const factionKeywords=unit.categories.filter(category=>category.toLowerCase().startsWith('faction:'));
  const keywords=unit.categories.filter(category=>!category.toLowerCase().startsWith('faction:'));
  const subfaction=subfactionKeyword(unit);
  return <div className='keywordChips'>{subfaction?<p><span>SUBFACTION</span><b>{subfaction}</b></p>:!!factionKeywords.length&&<p><span>FACTION KEYWORDS</span>{factionKeywords.map(keyword=><b key={keyword}>{keyword.replace(/^Faction:\s*/i,'')}</b>)}</p>}{!!keywords.length&&<p><span>KEYWORDS</span>{keywords.map(keyword=><b key={keyword}>{keyword}</b>)}</p>}</div>;
}

function UnitDetails({data,phase}:{data?:UnitDetail;phase?:Phase}){
  if(!data)return <p className='muted'>Loading datasheet…</p>;
  const retinue=retinueConditionFor(data),role=attachmentRoleFor(data);
  const weapons=(data.weapons||[]).filter(weapon=>!phase||(phase==='shooting'&&weapon.type==='Ranged Weapons')||(phase==='fight'&&weapon.type==='Melee Weapons'));
  const abilities=(data.abilities||[]).filter(ability=>{
    if(retinue&&ability.name.toLowerCase()==='leader')return false;
    if(role==='support'&&ability.name.toLowerCase()==='leader')return false;
    if(!phase)return true;
    const structured=ability.rule?.phases||[ability.rule?.phase].filter(Boolean);
    if(structured.length)return structured.includes('any')||structured.includes(phase);
    const text=`${ability.name} ${Object.values(ability.characteristics).join(' ')}`.toLowerCase();
    return text.includes(phase)||phase==='command'||!/(movement|shooting|charge|fight) phase/.test(text);
  });
  return <div className='details'><KeywordChips unit={data}/>{retinue?<div className='ability'><strong>{retinue.label.toUpperCase()}</strong><p>May join a Bodyguard unit only when it already contains an attached {retinue.requiredAttachedKeywords.join(' + ')} model.{retinue.forbiddenCompanionNames?.length?` Cannot share that Bodyguard with ${retinue.forbiddenCompanionNames.join(', ')}.`:''}</p></div>:role&&<div className='ability'><strong>{role.toUpperCase()}</strong><p>{role==='support'?'This unit must be attached during army construction and can share its bodyguard with one Leader.':'This unit can attach as a Leader and can share its bodyguard with one Support.'}</p></div>}{data.transportCapacity?.capacity&&<div className='ability'><strong>TRANSPORT CAPACITY</strong><p>{data.transportCapacity.capacity}{data.transportCapacity.keywordRestrictions?.length?` · Requires ${data.transportCapacity.keywordRestrictions.join(' + ')}`:''}{data.transportCapacity.exclusionKeywords?.length?` · Excludes ${data.transportCapacity.exclusionKeywords.join(', ')}`:''}</p></div>}{abilities.map(ability=><div className='ability' key={ability.id||ability.name}><strong>{ability.name}</strong><p>{ability.description||Object.values(ability.characteristics).filter(Boolean).join(' ')}</p>{ability.rule&&<small className='muted'>{[ability.rule.behavior,ruleMetaLine(ability.rule.usage),ruleMetaLine(ability.rule.scope),ability.rule.quality].filter(Boolean).join(' · ')}</small>}</div>)}{weapons.map(weapon=><div className='weapon' key={weapon.id||weapon.name}><strong>{weapon.name}</strong><div className='weaponGrid'>{Object.entries(weapon.characteristics).map(([key,value])=><div key={key}><span>{key}</span><b>{value||'—'}</b></div>)}</div></div>)}</div>;
}
