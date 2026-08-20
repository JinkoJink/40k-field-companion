import React,{useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,ChevronDown,Database,ExternalLink,Minus,Plus,RotateCcw,Search,Shield,Trash2,Settings} from 'lucide-react';
import {checkForUpdates,migrateLegacy,readBattle,readUser,system,writeBattle,writeUser} from './db';
import {createBattleState,phases,remainingUnitWounds,stateForRemainingWounds,syncBattleUnits,totalScore,totalUnitWounds,unitWounds} from './battle';
import {availableSizes,defaultSize,isCategory,loadNecrons,pointsFor,subfactionKeyword,synergy} from './data';
import {compatibleBodyguards,configurationGroups,createRosterUnit,defaultWargear,removeUnavailableEnhancements,rosterPoints,validateRoster} from './roster';
import type {BattleState,Detachment,Phase,RosterUnit,Stratagem,UnitDetail,UnitIndex,ValidationIssue} from './types';

const CORE_RULES_URL='https://www.warhammer-community.com/en-gb/downloads/warhammer-40000/';
const POINTS_LIMIT=2000;

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
  const[installed,setInstalled]=useState<any>(null);
  const[updateMessage,setUpdateMessage]=useState('');
  const[settings,setSettings]=useState({automatic:true,wifiOnly:false,manualOnly:false});

  useEffect(()=>{
    Promise.all([migrateLegacy(),loadNecrons(),readUser<string[]>('detachments',['Cursed Legion']),readUser<RosterUnit[]>('roster',[]),readBattle(),readUser('settings',{automatic:true,wifiOnly:false,manualOnly:false})])
      .then(([,data,storedDetachments,storedRoster,storedBattle,storedSettings])=>{
        setUnits(data.index);
        setDetails(data.detailMap);
        setDetachments(data.detachments);
        setStratagems(data.stratagems);
        setSelected(storedDetachments);setRoster(storedRoster);setBattle(storedBattle);setSettings(storedSettings);return system('installed',null);
      })
      .then(setInstalled)
      .catch(cause=>setError(String(cause)))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{if(!loading)void writeUser('roster',roster)},[roster,loading]);
  useEffect(()=>{if(!loading)void writeUser('detachments',selected)},[selected,loading]);
  useEffect(()=>{if(!loading)void writeBattle(battle)},[battle,loading]);
  useEffect(()=>{if(!loading)void writeUser('settings',settings)},[settings,loading]);
  useEffect(()=>{const connection=(navigator as Navigator&{connection?:{type?:string}}).connection;const wifiBlocked=settings.wifiOnly&&(!connection||connection.type!=='wifi');if(!loading&&settings.automatic&&!settings.manualOnly&&navigator.onLine&&!battle&&!wifiBlocked){void checkForUpdates().then(async result=>{if(result.status==='updated'){setUpdateMessage(`Background update installed: ${result.changed.join(', ')}`);setInstalled(await system('installed',null));}}).catch(()=>{/* startup stays usable if the optional check fails */})}},[loading,settings.automatic,settings.manualOnly,settings.wifiOnly,battle]);
  useEffect(()=>{
    if(battle)setBattle(current=>current?syncBattleUnits(current,roster):current);
  },[roster.length]);

  const selectedDetachments=detachments.filter(detachment=>selected.includes(detachment.name));
  const selectedEnhancements=selectedDetachments.flatMap(detachment=>detachment.enhancements||[]);
  const totalDP=selectedDetachments.reduce((sum,detachment)=>sum+detachment.dp,0);
  const totalPoints=useMemo(()=>rosterPoints(roster,units,selectedDetachments),[roster,units,selectedDetachments]);
  const issues=useMemo(()=>validateRoster({
    roster,units,details,detachments,selectedDetachments:selected,pointsLimit:POINTS_LIMIT,
  }),[roster,units,details,detachments,selected]);
  const errors=issues.filter(issue=>issue.level==='error');
  const filtered=units.filter(unit=>!unit.legends&&(!query||JSON.stringify({
    ...unit,
    details:details.get(unit.id),
  }).toLowerCase().includes(query.toLowerCase())));

  function toggleDetachment(detachment:Detachment){
    if(selected.includes(detachment.name)){
      const nextSelected=selected.filter(name=>name!==detachment.name);
      setSelected(nextSelected);
      setRoster(current=>removeUnavailableEnhancements(current,detachments.filter(candidate=>nextSelected.includes(candidate.name))));
    }
    else if(totalDP+detachment.dp<=3)setSelected([...selected,detachment.name]);
  }

  function addUnit(unit:UnitIndex){
    setRoster(current=>[...current,createRosterUnit(unit,details.get(unit.id))]);
  }

  function patchEntry(instanceId:string,patch:Partial<RosterUnit>){
    setRoster(current=>current.map(entry=>entry.instanceId===instanceId?{...entry,...patch}:entry));
  }

  function changeSize(entry:RosterUnit,models:number){
    patchEntry(entry.instanceId,{
      models,
      wargear:defaultWargear(details.get(entry.unitId),models),
    });
  }

  function setWarlord(instanceId:string){
    setRoster(current=>current.map(entry=>({...entry,warlord:entry.instanceId===instanceId})));
  }

  return <main className='app'>
    <header className='top'>
      <div>
        <div className='eyebrow'>40K FIELD COMPANION</div>
        <h1>Necrons — Strike Force</h1>
        <p>Configure the army, validate it, then carry the same roster into battle.</p>
      </div>
      <div className={`points ${totalPoints>POINTS_LIMIT?'over':''}`}>
        <b>{totalPoints}</b><span>/ {POINTS_LIMIT} pts</span>
      </div>
    </header>

    <div className='status'>
      <span><Database size={14}/>{loading?'Loading rules data…':error?'Rules data unavailable':'Rules data ready'}</span>
      <span>{totalDP}/3 DP selected</span>
      <span className={errors.length?'invalid':'valid'}>
        {errors.length?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}
        {errors.length?`${errors.length} legality issue${errors.length===1?'':'s'}`:'Army legal'}
      </span>
    </div>
    {error&&<div className='error'>{error}</div>}

    <nav className='tabs'>
      {(['build','battle','search','settings'] as const).map(name=>
        <button className={tab===name?'active':''} onClick={()=>setTab(name)} key={name}>
          {name[0].toUpperCase()+name.slice(1)}
        </button>
      )}
    </nav>

    {tab==='build'&&<BuildView
      units={units}
      details={details}
      detachments={detachments}
      selected={selected}
      totalDP={totalDP}
      roster={roster}
      issues={issues}
      onToggleDetachment={toggleDetachment}
      onAdd={addUnit}
      onPatch={patchEntry}
      onSize={changeSize}
      onWarlord={setWarlord}
      onRemove={instanceId=>setRoster(current=>current.filter(entry=>entry.instanceId!==instanceId))}
    />}
    {tab==='battle'&&<BattleView
      roster={roster}
      units={units}
      details={details}
      selectedDetachments={selectedDetachments}
      enhancements={selectedEnhancements}
      stratagems={stratagems}
      issues={errors}
      battle={battle}
      setBattle={setBattle}
    />}
    {tab==='search'&&<SearchView
      query={query}
      setQuery={setQuery}
      units={filtered}
      details={details}
      onAdd={addUnit}
    />}
    {tab==='settings'&&<SettingsView
      installed={installed} settings={settings} setSettings={setSettings} updateMessage={updateMessage}
      onCheck={async()=>{try{setUpdateMessage('Checking…');const result=await checkForUpdates(true);setUpdateMessage(result.status==='updated'?`Installed: ${result.changed.join(', ')}`:result.status==='current'?'Local rules are current.':'Offline — local rules remain active.');setInstalled(await system('installed',null));}catch(cause){setUpdateMessage(`Update rejected: ${String(cause)}`)}}}
    />}
  </main>;
}

function SettingsView({installed,settings,setSettings,updateMessage,onCheck}:{installed:any;settings:{automatic:boolean;wifiOnly:boolean;manualOnly:boolean};setSettings:React.Dispatch<React.SetStateAction<{automatic:boolean;wifiOnly:boolean;manualOnly:boolean}>>;updateMessage:string;onCheck:()=>Promise<void>}){
  const patch=(change:Partial<typeof settings>)=>setSettings(current=>({...current,...change}));
  return <section className='panel'><div className='row'><div><div className='eyebrow'>LOCAL RULES DATABASE</div><h2>Offline settings</h2></div><Settings size={22}/></div>
    <p className='muted'>Rules, rosters and active battles live on this phone. Network checks only fetch a tiny manifest, then only changed packages.</p>
    <div className='formGrid'><label className='checkLabel'><input type='checkbox' checked={settings.automatic} onChange={e=>patch({automatic:e.target.checked,manualOnly:!e.target.checked})}/> Automatic update checks</label><label className='checkLabel'><input type='checkbox' checked={settings.manualOnly} onChange={e=>patch({manualOnly:e.target.checked,automatic:!e.target.checked})}/> Manual updates only</label><label className='checkLabel'><input type='checkbox' checked={settings.wifiOnly} onChange={e=>patch({wifiOnly:e.target.checked})}/> Wi‑Fi only (automatic checks pause when detection is unavailable)</label></div>
    <div className='rulePanel'><strong>Installed dataset: {installed?.datasetVersion||'initializing'}</strong><p>Schema {installed?.schemaVersion||1} · Last successful update: {installed?.lastSuccessfulUpdate?new Date(installed.lastSuccessfulUpdate).toLocaleString():'—'} · {navigator.onLine?'Online':'Offline'}</p></div>
    <button className='addButton' onClick={()=>void onCheck()}>Check for updates now</button>{updateMessage&&<p className='muted'>{updateMessage}</p>}
  </section>;
}

function BuildView(props:{
  units:UnitIndex[];
  details:Map<string,UnitDetail>;
  detachments:Detachment[];
  selected:string[];
  totalDP:number;
  roster:RosterUnit[];
  issues:ValidationIssue[];
  onToggleDetachment:(detachment:Detachment)=>void;
  onAdd:(unit:UnitIndex)=>void;
  onPatch:(instanceId:string,patch:Partial<RosterUnit>)=>void;
  onSize:(entry:RosterUnit,models:number)=>void;
  onWarlord:(instanceId:string)=>void;
  onRemove:(instanceId:string)=>void;
}){
  const{units,details,detachments,selected,totalDP,roster,issues}=props;
  const[catalogueQuery,setCatalogueQuery]=useState('');
  const selectedDetachments=detachments.filter(detachment=>selected.includes(detachment.name));
  const enhancements=selectedDetachments.flatMap(detachment=>detachment.enhancements||[]);
  const instanceIssues=(id:string)=>issues.filter(issue=>issue.unitInstanceId===id);
  const catalogue=units.filter(unit=>!unit.legends&&(!catalogueQuery||JSON.stringify({...unit,details:details.get(unit.id)}).toLowerCase().includes(catalogueQuery.toLowerCase())));
  const categories=Array.from(catalogue.reduce((groups,unit)=>{
    const category=catalogueCategory(unit);groups.set(category,[...(groups.get(category)||[]),unit]);return groups;
  },new Map<string,UnitIndex[]>()).entries()).sort(([a],[b])=>a.localeCompare(b));

  return <>
    <section className='panel'>
      <div className='row'>
        <div><div className='eyebrow'>DETACHMENTS</div><h2>{totalDP}/3 DP</h2></div>
        <a href={CORE_RULES_URL} target='_blank' rel='noreferrer'>Core rules <ExternalLink size={14}/></a>
      </div>
      <p className='muted'>Select multiple detachments while their combined cost remains at or below 3 DP.</p>
      <div className='detGrid'>
        {detachments.map(detachment=>{
          const picked=selected.includes(detachment.name);
          const disabled=!picked&&totalDP+detachment.dp>3;
          return <button key={detachment.name} disabled={disabled} className={`det ${picked?'picked':''}`} onClick={()=>props.onToggleDetachment(detachment)}>
            <div className='row'><strong>{detachment.name}</strong><span>{detachment.dp} DP</span></div>
            <small>{detachment.objective}</small><p>{detachment.summary}</p>
          </button>;
        })}
      </div>
    </section>

    <section className='validation panel'>
      <div className='eyebrow'>ARMY VALIDATION</div>
      {!issues.length?<p className='validLine'><CheckCircle2 size={16}/> Army passes every configured legality check.</p>:
        <ul>{issues.map((issue,index)=><li className={issue.level} key={index}>{issue.message}</li>)}</ul>}
    </section>

    <section className='sectionHead'><div><h2>Your roster</h2><p>Each copy is configured separately, including unit size, loadout, leader and Enhancement.</p></div></section>
    {!roster.length&&<div className='empty'>Add units from the catalogue below.</div>}
    <div className='stack'>
      {roster.map((entry,index)=>{
        const unit=units.find(candidate=>candidate.id===entry.unitId);
        if(!unit)return null;
        const detail=details.get(unit.id);
        const bodyguards=compatibleBodyguards(unit,roster,units).filter(candidate=>candidate.instanceId!==entry.instanceId);
        const eligibleEnhancement=isCategory(unit,'character')&&!isCategory(unit,'epic hero');
        return <article className={`card rosterCard ${instanceIssues(entry.instanceId).length?'cardInvalid':''}`} key={entry.instanceId}>
          <div className='row'>
            <div><div className='eyebrow'>UNIT {index+1}</div><h3>{unit.name}</h3></div>
            <button className='iconButton danger' onClick={()=>props.onRemove(entry.instanceId)} aria-label={`Remove ${unit.name}`}><Trash2 size={17}/></button>
          </div>
          <div className='formGrid'>
            <label>Unit size
              <select value={entry.models} onChange={event=>props.onSize(entry,Number(event.target.value))}>
                {availableSizes(unit).map(size=><option key={size} value={size}>{size} models</option>)}
              </select>
            </label>
            {isCategory(unit,'character')&&<label className='checkLabel'>
              <input type='radio' name='warlord' checked={Boolean(entry.warlord)} onChange={()=>props.onWarlord(entry.instanceId)}/>
              Warlord
            </label>}
            {eligibleEnhancement&&<EnhancementToggles name={`enhancement-${entry.instanceId}`} selected={entry.enhancement} enhancements={enhancements} onChange={enhancement=>props.onPatch(entry.instanceId,{enhancement})}/>}
            {!!unit.attachTo?.length&&<label>Lead bodyguard
              <select value={entry.attachedTo||''} onChange={event=>props.onPatch(entry.instanceId,{attachedTo:event.target.value||undefined})}>
                <option value=''>Not attached</option>
                {bodyguards.map(target=>{
                  const targetUnit=units.find(candidate=>candidate.id===target.unitId);
                  return <option key={target.instanceId} value={target.instanceId}>{targetUnit?.name}</option>;
                })}
              </select>
            </label>}
          </div>
          <WargearEditor entry={entry} detail={detail} onPatch={props.onPatch}/>
          {!!instanceIssues(entry.instanceId).length&&<div className='inlineIssues'>{instanceIssues(entry.instanceId).map((issue,i)=><span key={i}>{issue.message}</span>)}</div>}
          <UnitDetails data={detail}/>
        </article>;
      })}
    </div>

    <section className='sectionHead'><div><h2>Necron unit catalogue</h2><p>Search, then drill into the unit category you want.</p></div></section>
    <div className='search catalogueSearch'><Search size={18}/><input value={catalogueQuery} onChange={event=>setCatalogueQuery(event.target.value)} placeholder='Search this catalogue by unit, role, keyword, weapon…'/></div>
    {!categories.length&&<div className='empty'>No units match that search.</div>}
    <div className='catalogueGroups'>{categories.map(([category,group])=><details className='catalogueGroup' open={Boolean(catalogueQuery)} key={category}>
      <summary><span>{category}</span><small>{group.length} unit{group.length===1?'':'s'}</small></summary>
      <div className='grid'>{group.map(unit=><UnitCard unit={unit} detail={details.get(unit.id)} selected={selected} onAdd={()=>props.onAdd(unit)} key={unit.id}/>)}</div>
    </details>)}</div>
  </>;
}

function catalogueCategory(unit:UnitIndex){
  if(isCategory(unit,'epic hero'))return 'Epic Heroes';
  if(isCategory(unit,'character'))return 'Characters';
  if(isCategory(unit,'battleline'))return 'Battleline';
  if(isCategory(unit,'dedicated transport'))return 'Dedicated Transports';
  if(isCategory(unit,'vehicle'))return 'Vehicles';
  if(isCategory(unit,'monster'))return 'Monsters';
  if(isCategory(unit,'mounted'))return 'Mounted';
  if(isCategory(unit,'swarm'))return 'Swarms';
  if(isCategory(unit,'infantry'))return 'Infantry';
  return unit.role?`${unit.role[0].toUpperCase()}${unit.role.slice(1)} units`:'Other units';
}

function WargearEditor({entry,detail,onPatch}:{entry:RosterUnit;detail?:UnitDetail;onPatch:(id:string,patch:Partial<RosterUnit>)=>void}){
  const{choices,modelGroups}=configurationGroups(detail);
  if(!choices.length&&!modelGroups.length)return null;
  function updateChoices(groupId:string,optionId:string){
    onPatch(entry.instanceId,{wargear:{...entry.wargear,choices:{...entry.wargear.choices,[groupId]:optionId}}});
  }
  function updateModel(optionId:string,count:number){
    onPatch(entry.instanceId,{wargear:{...entry.wargear,modelCounts:{...entry.wargear.modelCounts,[optionId]:Math.max(0,count)}}});
  }
  return <details className='config' open>
    <summary>Wargear and model loadouts <ChevronDown size={15}/></summary>
    <div className='formGrid'>
      {choices.map(group=><label key={group.id}>{group.name}
        <select value={entry.wargear.choices[group.id]||''} onChange={event=>updateChoices(group.id,event.target.value)}>
          {group.options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>)}
    </div>
    {modelGroups.map(group=><div className='loadoutGroup' key={group.id}>
      <strong>{group.name}</strong><span className='muted'>Assign all {entry.models} models</span>
      {group.options.map(option=><label key={option.id}><span>{option.name}</span>
        <input type='number' min='0' max={entry.models} value={entry.wargear.modelCounts[option.id]||0} onChange={event=>updateModel(option.id,Number(event.target.value))}/>
      </label>)}
    </div>)}
  </details>;
}

function enhancementDescription(enhancement:{description?:string;supportTo?:string[]}){
  if(enhancement.description)return enhancement.description;
  if(enhancement.supportTo?.length)return `Bearer can support: ${enhancement.supportTo.join(', ')}.`;
  return 'Enhancement rules text is not installed locally. Consult the current Codex: Necrons.';
}

function EnhancementToggles({name,selected,enhancements,onChange}:{name:string;selected?:string;enhancements:Detachment['enhancements'];onChange:(enhancement?:string)=>void}){
  return <fieldset className='enhancementToggles'><legend>Enhancement</legend>
    <label className='enhancementToggle'>
      <input type='radio' name={name} checked={!selected} onChange={()=>onChange(undefined)}/>
      <span><strong>None</strong><small>No Enhancement assigned.</small></span>
    </label>
    {(enhancements||[]).map(enhancement=><label className={`enhancementToggle ${selected===enhancement.name?'selected':''}`} key={enhancement.id||enhancement.name}>
      <input type='radio' name={name} checked={selected===enhancement.name} onChange={()=>onChange(enhancement.name)}/>
      <span><strong>{enhancement.name} <em>+{enhancement.points} pts</em></strong><small>{enhancementDescription(enhancement)}</small></span>
    </label>)}
    {!enhancements?.length&&<p className='muted'>Select a detachment to make its Enhancements available.</p>}
  </fieldset>;
}

function UnitCard({unit,detail,selected,onAdd}:{unit:UnitIndex;detail?:UnitDetail;selected:string[];onAdd:()=>void}){
  const tags=synergy(selected,unit);
  return <article className='card'>
    <div className='row'>
      <div><h3>{unit.name}</h3><p>{pointsFor(unit,defaultSize(unit))} pts</p></div>
      <button className='addButton' onClick={onAdd}><Plus size={15}/> Add</button>
    </div>
    {!!tags.length&&<div className='synergy'>{tags.map(tag=><span key={tag}>{tag}</span>)}</div>}
    <Stats unit={unit}/>
    <KeywordChips unit={unit}/>
    {!!unit.attachTo?.length&&<div className='leader'>Can lead: {unit.attachTo.join(', ')}</div>}
    <details><summary>Datasheet details</summary><UnitDetails data={detail}/></details>
  </article>;
}

function BattleView({roster,units,details,selectedDetachments,enhancements,stratagems,issues,battle,setBattle}:{
  roster:RosterUnit[];
  units:UnitIndex[];
  details:Map<string,UnitDetail>;
  selectedDetachments:Detachment[];
  enhancements:Detachment['enhancements'];
  stratagems:Stratagem[];
  issues:ValidationIssue[];
  battle:BattleState|null;
  setBattle:React.Dispatch<React.SetStateAction<BattleState|null>>;
}){
  if(!battle)return <section className='panel battleStart'>
    <Shield size={36}/><h2>Start Battle Mode</h2>
    <p>Your army roster becomes a persistent tabletop tracker for Wounds, models, Reanimation Protocols, CP and Victory Points.</p>
    {!!issues.length&&<div className='error'>Resolve the {issues.length} army legality issue{issues.length===1?'':'s'} before starting.</div>}
    <button disabled={!roster.length||Boolean(issues.length)} onClick={()=>setBattle(createBattleState(roster))}>Start battle</button>
  </section>;

  const patch=(change:Partial<BattleState>)=>setBattle(current=>current?{...current,...change}:current);
  return <>
    <section className='battleDashboard panel'>
      <div className='row'>
        <div><div className='eyebrow'>BATTLE ROUND {battle.round}</div><h2>{totalScore(battle)} VP</h2></div>
        <button className='dangerButton' onClick={()=>setBattle(null)}><RotateCcw size={15}/> Reset battle</button>
      </div>
      <div className='trackerGrid'>
        <Counter label='Command points' value={battle.cp} onChange={cp=>patch({cp:Math.max(0,cp)})}/>
        <label>Battle round
          <select value={battle.round} onChange={event=>patch({round:Number(event.target.value)})}>
            {[1,2,3,4,5].map(round=><option value={round} key={round}>Round {round}</option>)}
          </select>
        </label>
      </div>
      <div className='phaseBar'>
        {phases.map(phase=><button className={battle.phase===phase?'active':''} onClick={()=>patch({phase})} key={phase}>{phase}</button>)}
      </div>
    </section>

    <section className='panel'>
      <div className='eyebrow'>ROUND SCORING</div>
      <div className='scoreGrid'>
        {[1,2,3,4,5].map(round=><div className={battle.round===round?'currentRound':''} key={round}>
          <strong>R{round}</strong>
          <label>Primary<input type='number' min='0' value={battle.score[round]?.primary||0} onChange={event=>patch({score:{...battle.score,[round]:{...battle.score[round],primary:Number(event.target.value)}}})}/></label>
          <label>Secondary<input type='number' min='0' value={battle.score[round]?.secondary||0} onChange={event=>patch({score:{...battle.score,[round]:{...battle.score[round],secondary:Number(event.target.value)}}})}/></label>
        </div>)}
      </div>
    </section>

    <StratagemPanel phase={battle.phase} stratagems={stratagems} selectedDetachments={selectedDetachments}/>

    <section className='panel'>
      <div className='eyebrow'>ACTIVE DETACHMENT RULES</div>
      {selectedDetachments.map(detachment=><div className='rulePanel' key={detachment.name}><strong>{detachment.name} · {detachment.ruleName}</strong><p>{detachment.summary}</p></div>)}
    </section>

    <div className='stack'>
      {roster.map(entry=>{
        const unit=units.find(candidate=>candidate.id===entry.unitId);
        if(!unit)return null;
        const state=battle.units[entry.instanceId]||{modelsRemaining:entry.models,woundsLost:0,destroyed:false};
        const wounds=unitWounds(unit);
        const maximumWounds=totalUnitWounds(entry.models,wounds);
        const woundsRemaining=remainingUnitWounds(state,entry.models,wounds);
        const modelsRemaining=Math.ceil(woundsRemaining/wounds);
        const enhancement=(enhancements||[]).find(candidate=>candidate.name===entry.enhancement);
        const update=(change:Partial<typeof state>)=>patch({units:{...battle.units,[entry.instanceId]:{...state,...change}}});
        const setRemaining=(value:number)=>update(stateForRemainingWounds(state,entry.models,wounds,value));
        return <article className={`card battleUnit ${state.destroyed?'destroyed':''}`} key={entry.instanceId}>
          <div className='row'>
            <div><h3>{unit.name}</h3><p>{modelsRemaining}/{entry.models} models · {wounds} Wound{wounds===1?'':'s'} each</p></div>
            <label className='checkLabel'><input type='checkbox' checked={woundsRemaining===0} onChange={event=>setRemaining(event.target.checked?0:Math.min(wounds,maximumWounds))}/> Destroyed</label>
          </div>
          {enhancement&&<div className='assignedEnhancement'><div className='eyebrow'>ASSIGNED ENHANCEMENT</div><strong>{enhancement.name} <span>+{enhancement.points} pts</span></strong><p>{enhancementDescription(enhancement)}</p></div>}
          <Stats unit={unit}/>
          <div className='trackerGrid'>
            <Counter label={`Wounds remaining (${maximumWounds} Starting Strength)`} value={woundsRemaining} max={maximumWounds} onChange={setRemaining}/>
            <div className='counterBox'><span>Models remaining</span><div><b>{modelsRemaining}</b><small>of {entry.models}</small></div></div>
          </div>
          <UnitDetails data={details.get(unit.id)} phase={battle.phase}/>
          <button className='reanimate compact' disabled={woundsRemaining>=maximumWounds} onClick={()=>setRemaining(woundsRemaining+wounds)}><Plus size={13}/> Reanimation Protocols: return 1 model</button>
        </article>;
      })}
    </div>
    <label className='notes panel'>Battle notes<textarea value={battle.notes} onChange={event=>patch({notes:event.target.value})} placeholder='Reserves, once-per-battle abilities, target priorities…'/></label>
  </>;
}

function StratagemPanel({phase,stratagems,selectedDetachments}:{phase:Phase;stratagems:Stratagem[];selectedDetachments:Detachment[]}){
  const selectedIds=new Set(selectedDetachments.map(detachment=>detachment.id));
  const available=stratagems.filter(stratagem=>(!stratagem.detachmentId||selectedIds.has(stratagem.detachmentId))&&(stratagem.phases.includes('any')||stratagem.phases.includes(phase)));
  return <section className='panel stratagemPanel'><div className='row'><div><div className='eyebrow'>STRATAGEMS</div><h2>{phase[0].toUpperCase()+phase.slice(1)} phase</h2></div><span className='muted'>{available.length} available</span></div>
    {!available.length?<p className='muted'>No phase-tagged Stratagems are installed for this phase and selected detachment set.</p>:<div className='stratagemList'>{available.map(stratagem=><details className='stratagem' key={stratagem.id}>
      <summary><span>{stratagem.name}</span><small>{stratagem.cp===undefined?'CP varies':`${stratagem.cp} CP`}</small></summary>
      <p>{stratagem.timing||'Use in the listed phase.'}</p>{stratagem.description&&<p className='muted'>{stratagem.description}</p>}
    </details>)}</div>}
  </section>;
}

function Counter({label,value,onChange,max=99}:{label:string;value:number;onChange:(value:number)=>void;max?:number}){
  return <div className='counterBox'><span>{label}</span><div><button onClick={()=>onChange(Math.max(0,value-1))}><Minus size={15}/></button><b>{value}</b><button onClick={()=>onChange(Math.min(max,value+1))}><Plus size={15}/></button></div></div>;
}

function SearchView({query,setQuery,units,details,onAdd}:{query:string;setQuery:(value:string)=>void;units:UnitIndex[];details:Map<string,UnitDetail>;onAdd:(unit:UnitIndex)=>void}){
  return <>
    <div className='search'><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder='Search units, keywords, roles, weapons…'/></div>
    <div className='stack'>{units.map(unit=><article className='card' key={unit.id}>
      <div className='row'><div><h3>{unit.name}</h3><p>{pointsFor(unit)} pts · {unit.role||'unit'}</p></div><button className='addButton' onClick={()=>onAdd(unit)}><Plus size={15}/> Add</button></div>
      <UnitDetails data={details.get(unit.id)}/>
    </article>)}</div>
  </>;
}

function Stats({unit}:{unit:UnitIndex}){
  return <div className='stats'>{['M','T','Sv','W','LD','OC','InSv'].map(key=>unit.stats[key]?<div key={key}><span>{key}</span><b>{unit.stats[key]}</b></div>:null)}</div>;
}

function KeywordChips({unit}:{unit:UnitIndex}){
  const factionKeywords=unit.categories.filter(category=>category.toLowerCase().startsWith('faction:'));
  const keywords=unit.categories.filter(category=>!category.toLowerCase().startsWith('faction:'));
  const subfaction=subfactionKeyword(unit);
  return <div className='keywordChips'>
    {subfaction?<p><span>SUBFACTION</span><b>{subfaction}</b></p>:!!factionKeywords.length&&<p><span>FACTION KEYWORDS</span>{factionKeywords.map(keyword=><b key={keyword}>{keyword.replace(/^Faction:\s*/i,'')}</b>)}</p>}
    {!!keywords.length&&<p><span>KEYWORDS</span>{keywords.map(keyword=><b key={keyword}>{keyword}</b>)}</p>}
  </div>;
}

function UnitDetails({data,phase}:{data?:UnitDetail;phase?:Phase}){
  if(!data)return <p className='muted'>Loading datasheet…</p>;
  const weapons=(data.weapons||[]).filter(weapon=>!phase||(phase==='shooting'&&weapon.type==='Ranged Weapons')||(phase==='fight'&&weapon.type==='Melee Weapons'));
  const abilities=(data.abilities||[]).filter(ability=>{
    if(!phase)return true;
    const text=`${ability.name} ${Object.values(ability.characteristics).join(' ')}`.toLowerCase();
    return text.includes(phase)||phase==='command'||!/(movement|shooting|charge|fight) phase/.test(text);
  });
  return <div className='details'>
    <KeywordChips unit={data}/>
    {abilities.map(ability=><div className='ability' key={ability.id||ability.name}><strong>{ability.name}</strong><p>{Object.values(ability.characteristics).filter(Boolean).join(' ')}</p></div>)}
    {weapons.map(weapon=><div className='weapon' key={weapon.id||weapon.name}><strong>{weapon.name}</strong><div className='weaponGrid'>{Object.entries(weapon.characteristics).map(([key,value])=><div key={key}><span>{key}</span><b>{value||'—'}</b></div>)}</div></div>)}
  </div>;
}
