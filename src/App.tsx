import React,{useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,ChevronDown,Database,ExternalLink,Minus,Plus,RotateCcw,Search,Shield,Trash2} from 'lucide-react';
import {createBattleState,phases,syncBattleUnits,totalScore,unitWounds} from './battle';
import {availableSizes,defaultSize,isCategory,loadNecrons,pointsFor,synergy} from './data';
import {compatibleBodyguards,configurationGroups,createRosterUnit,defaultWargear,rosterPoints,validateRoster} from './roster';
import type {BattleState,Detachment,Phase,RosterUnit,UnitDetail,UnitIndex,ValidationIssue} from './types';

const CORE_RULES_URL='https://www.warhammer-community.com/en-gb/downloads/warhammer-40000/';
const ROSTER_KEY='field-companion-roster-v2';
const DETACHMENT_KEY='field-companion-detachments-v1';
const BATTLE_KEY='field-companion-battle-v1';
const POINTS_LIMIT=2000;

function readStored<T>(key:string,fallback:T):T{
  try{return JSON.parse(localStorage.getItem(key)||'') as T}catch{return fallback}
}

export function App(){
  const[units,setUnits]=useState<UnitIndex[]>([]);
  const[details,setDetails]=useState<Map<string,UnitDetail>>(new Map());
  const[detachments,setDetachments]=useState<Detachment[]>([]);
  const[selected,setSelected]=useState<string[]>(()=>readStored(DETACHMENT_KEY,['Cursed Legion']));
  const[roster,setRoster]=useState<RosterUnit[]>(()=>readStored(ROSTER_KEY,[]));
  const[battle,setBattle]=useState<BattleState|null>(()=>readStored(BATTLE_KEY,null));
  const[tab,setTab]=useState<'build'|'battle'|'search'>('build');
  const[query,setQuery]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    loadNecrons()
      .then(data=>{
        setUnits(data.index);
        setDetails(data.detailMap);
        setDetachments(data.detachments);
      })
      .catch(cause=>setError(String(cause)))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>localStorage.setItem(ROSTER_KEY,JSON.stringify(roster)),[roster]);
  useEffect(()=>localStorage.setItem(DETACHMENT_KEY,JSON.stringify(selected)),[selected]);
  useEffect(()=>{
    if(battle)localStorage.setItem(BATTLE_KEY,JSON.stringify(battle));
    else localStorage.removeItem(BATTLE_KEY);
  },[battle]);
  useEffect(()=>{
    if(battle)setBattle(current=>current?syncBattleUnits(current,roster):current);
  },[roster.length]);

  const selectedDetachments=detachments.filter(detachment=>selected.includes(detachment.name));
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
    if(selected.includes(detachment.name))setSelected(selected.filter(name=>name!==detachment.name));
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
      {(['build','battle','search'] as const).map(name=>
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
  </main>;
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
  const selectedDetachments=detachments.filter(detachment=>selected.includes(detachment.name));
  const enhancements=selectedDetachments.flatMap(detachment=>detachment.enhancements||[]);
  const instanceIssues=(id:string)=>issues.filter(issue=>issue.unitInstanceId===id);

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
            {eligibleEnhancement&&<label>Enhancement
              <select value={entry.enhancement||''} onChange={event=>props.onPatch(entry.instanceId,{enhancement:event.target.value||undefined})}>
                <option value=''>None</option>
                {enhancements.map(enhancement=><option key={enhancement.name} value={enhancement.name}>{enhancement.name} (+{enhancement.points})</option>)}
              </select>
            </label>}
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

    <section className='sectionHead'><div><h2>Necron unit catalogue</h2><p>Add another individual unit instance to the roster.</p></div></section>
    <div className='grid'>
      {units.filter(unit=>!unit.legends).map(unit=><UnitCard unit={unit} detail={details.get(unit.id)} selected={selected} onAdd={()=>props.onAdd(unit)} key={unit.id}/>)}
    </div>
  </>;
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

function UnitCard({unit,detail,selected,onAdd}:{unit:UnitIndex;detail?:UnitDetail;selected:string[];onAdd:()=>void}){
  const tags=synergy(selected,unit);
  return <article className='card'>
    <div className='row'>
      <div><h3>{unit.name}</h3><p>{pointsFor(unit,defaultSize(unit))} pts</p></div>
      <button className='addButton' onClick={onAdd}><Plus size={15}/> Add</button>
    </div>
    {!!tags.length&&<div className='synergy'>{tags.map(tag=><span key={tag}>{tag}</span>)}</div>}
    <Stats unit={unit}/>
    <div className='chips'>{unit.categories.slice(0,8).map(category=><span key={category}>{category}</span>)}</div>
    {!!unit.attachTo?.length&&<div className='leader'>Can lead: {unit.attachTo.join(', ')}</div>}
    <details><summary>Datasheet details</summary><UnitDetails data={detail}/></details>
  </article>;
}

function BattleView({roster,units,details,selectedDetachments,issues,battle,setBattle}:{
  roster:RosterUnit[];
  units:UnitIndex[];
  details:Map<string,UnitDetail>;
  selectedDetachments:Detachment[];
  issues:ValidationIssue[];
  battle:BattleState|null;
  setBattle:React.Dispatch<React.SetStateAction<BattleState|null>>;
}){
  if(!battle)return <section className='panel battleStart'>
    <Shield size={36}/><h2>Start Battle Mode</h2>
    <p>Your configured roster becomes a persistent tabletop tracker for wounds, models, reanimation, CP, scoring and objective control.</p>
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

    <section className='panel'>
      <div className='eyebrow'>OBJECTIVE CONTROL</div>
      <div className='objectiveGrid'>
        {battle.objectives.map(objective=><div className='objective' key={objective.id}>
          <input value={objective.name} onChange={event=>patch({objectives:battle.objectives.map(item=>item.id===objective.id?{...item,name:event.target.value}:item)})}/>
          <div>{(['you','contested','opponent'] as const).map(controller=><button className={objective.controller===controller?controller:''} onClick={()=>patch({objectives:battle.objectives.map(item=>item.id===objective.id?{...item,controller}:item)})} key={controller}>{controller}</button>)}</div>
        </div>)}
      </div>
    </section>

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
        const update=(change:Partial<typeof state>)=>patch({units:{...battle.units,[entry.instanceId]:{...state,...change}}});
        return <article className={`card battleUnit ${state.destroyed?'destroyed':''}`} key={entry.instanceId}>
          <div className='row'>
            <div><h3>{unit.name}</h3><p>{entry.models} models · {wounds} wound{wounds===1?'':'s'} each</p></div>
            <label className='checkLabel'><input type='checkbox' checked={state.destroyed} onChange={event=>update({destroyed:event.target.checked,modelsRemaining:event.target.checked?0:Math.max(1,state.modelsRemaining)})}/> Destroyed</label>
          </div>
          <div className='trackerGrid'>
            <Counter label='Models remaining' value={state.modelsRemaining} max={entry.models} onChange={modelsRemaining=>update({modelsRemaining,destroyed:modelsRemaining===0})}/>
            <Counter label='Wounds on damaged model' value={state.woundsLost} max={Math.max(0,wounds-1)} onChange={woundsLost=>update({woundsLost})}/>
          </div>
          <button className='reanimate' disabled={state.modelsRemaining>=entry.models} onClick={()=>update({modelsRemaining:Math.min(entry.models,state.modelsRemaining+1),destroyed:false})}><Plus size={14}/> Reanimate one model</button>
          <UnitDetails data={details.get(unit.id)} phase={battle.phase}/>
        </article>;
      })}
    </div>
    <label className='notes panel'>Battle notes<textarea value={battle.notes} onChange={event=>patch({notes:event.target.value})} placeholder='Reserves, once-per-battle abilities, target priorities…'/></label>
  </>;
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

function UnitDetails({data,phase}:{data?:UnitDetail;phase?:Phase}){
  if(!data)return <p className='muted'>Loading datasheet…</p>;
  const weapons=(data.weapons||[]).filter(weapon=>!phase||(phase==='shooting'&&weapon.type==='Ranged Weapons')||(phase==='fight'&&weapon.type==='Melee Weapons'));
  const abilities=(data.abilities||[]).filter(ability=>{
    if(!phase)return true;
    const text=`${ability.name} ${Object.values(ability.characteristics).join(' ')}`.toLowerCase();
    return text.includes(phase)||phase==='command'||!/(movement|shooting|charge|fight) phase/.test(text);
  });
  return <div className='details'>
    {abilities.map(ability=><div className='ability' key={ability.id||ability.name}><strong>{ability.name}</strong><p>{Object.values(ability.characteristics).filter(Boolean).join(' ')}</p></div>)}
    {weapons.map(weapon=><div className='weapon' key={weapon.id||weapon.name}><strong>{weapon.name}</strong><div className='weaponGrid'>{Object.entries(weapon.characteristics).map(([key,value])=><div key={key}><span>{key}</span><b>{value||'—'}</b></div>)}</div></div>)}
  </div>;
}
