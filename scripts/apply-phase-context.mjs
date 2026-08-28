import fs from 'node:fs';

const path='src/App.tsx';
let source=fs.readFileSync(path,'utf8');

const helpers=`
const phaseLabels:Record<Phase,string>={command:'Command',movement:'Movement',shooting:'Shooting',charge:'Charge',fight:'Fight'};

function profileText(profile:{name:string;description?:string;characteristics:Record<string,string>}){
  return \`${'${profile.name}'} ${'${profile.description||\'\'}'} ${'${Object.values(profile.characteristics||{}).join(\' \')}'}\`.toLowerCase();
}

function phaseAbilityRelevant(ability:UnitDetail['abilities'] extends (infer T)[]|undefined?T:never,phase:Phase){
  if(!ability)return false;
  const structured=ability.rule?.phases||[ability.rule?.phase].filter(Boolean);
  if(structured.length)return structured.includes('any')||structured.includes(phase);
  const text=profileText(ability);
  const explicit:Record<Phase,RegExp>={
    command:/\\b(command phase|start of (?:your |the )?turn|battle-shock|objective control|leadership)\\b/,
    movement:/\\b(movement phase|normal move|advance|fall back|remain stationary|deep strike|reserves?|reinforcements?|scout|move characteristic)\\b/,
    shooting:/\\b(shooting phase|shoot|ranged attack|ranged weapon|overwatch)\\b/,
    charge:/\\b(charge phase|charge roll|charge move|declare a charge)\\b/,
    fight:/\\b(fight phase|melee attack|melee weapon|pile in|consolidat|fight first|end of (?:your |the )?turn)\\b/,
  };
  if(explicit[phase].test(text))return true;
  return !Object.values(explicit).some(pattern=>pattern.test(text))&&phase==='command';
}

function phaseStatEntries(stats:Record<string,string>,phase:Phase){
  const keys:Record<Phase,string[]>={
    command:['Ld','LD','OC'],
    movement:['M'],
    shooting:['M'],
    charge:['M'],
    fight:['M'],
  };
  const labels:Record<string,string>={M:'M',Ld:'LD',LD:'LD',OC:'OC'};
  const seen=new Set<string>();
  return keys[phase].flatMap(key=>{
    const value=stats[key],label=labels[key]||key;
    if(!value||seen.has(label))return[];
    seen.add(label);
    return[{label,value}];
  });
}

function PhaseStats({stats,phase}:{stats:Record<string,string>;phase:Phase}){
  const entries=phaseStatEntries(stats,phase);
  if(!entries.length)return null;
  return <div className='stats'>{entries.map(({label,value})=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}

function PhaseRosterSummary({phase,roster,units,battle}:{phase:Phase;roster:RosterUnit[];units:UnitIndex[];battle:BattleState}){
  const rows=roster.flatMap(entry=>{
    const unit=units.find(candidate=>candidate.id===entry.unitId);
    if(!unit)return[];
    const state=battle.units[entry.instanceId];
    if(state?.destroyed)return[];
    const stats=state?.stats||entry.stats||unit.stats;
    const abilities=(state?.abilities||entry.abilities||[]).filter(ability=>phaseAbilityRelevant(ability,phase));
    const values=phaseStatEntries(stats,phase).map(({label,value})=>\`${'${label}'} ${'${value}'}\`);
    return[{entry,unit,abilities,values}];
  });
  return <section className='panel'><div className='row'><div><div className='eyebrow'>PHASE AT A GLANCE</div><h2>{phaseLabels[phase]} phase</h2></div><span className='muted'>{rows.length} active unit{rows.length===1?'':'s'}</span></div><div className='stack'>{rows.map(({entry,unit,abilities,values})=><div className='rulePanel' key={entry.instanceId}><strong>{unit.name}{values.length?\` · ${'${values.join(\' · \')}'}\`:''}</strong>{abilities.length?<p>{abilities.map(ability=>ability.name).join(' · ')}</p>:<p className='muted'>No unit-specific {phaseLabels[phase].toLowerCase()}-phase ability.</p>}</div>)}</div></section>;
}

`;

if(!source.includes('function PhaseRosterSummary(')){
  source=source.replace('function BattleView(',helpers+'function BattleView(');
}

const dashboardNeedle="    <section className='panel'><div className='eyebrow'>ROUND SCORING</div>";
if(source.includes(dashboardNeedle)&&!source.includes("<PhaseRosterSummary phase={battle.phase}")){
  source=source.replace(dashboardNeedle,"    <PhaseRosterSummary phase={battle.phase} roster={activeRoster} units={units} battle={battle}/>\n\n"+dashboardNeedle);
}

source=source.replace("        <Stats stats={battleStats}/>","        <PhaseStats stats={battleStats} phase={battle.phase}/>");

const oldAbilityFilter=`  const abilities=(data.abilities||[]).filter(ability=>{\n    if(retinue&&ability.name.toLowerCase()==='leader')return false;\n    if(role==='support'&&ability.name.toLowerCase()==='leader')return false;\n    if(!phase)return true;\n    const structured=ability.rule?.phases||[ability.rule?.phase].filter(Boolean);\n    if(structured.length)return structured.includes('any')||structured.includes(phase);\n    const text=\`${'${ability.name}'} ${'${Object.values(ability.characteristics).join(\' \')}'}\`.toLowerCase();\n    return text.includes(phase)||phase==='command'||!/(movement|shooting|charge|fight) phase/.test(text);\n  });`;
const newAbilityFilter=`  const abilities=(data.abilities||[]).filter(ability=>{\n    if(retinue&&ability.name.toLowerCase()==='leader')return false;\n    if(role==='support'&&ability.name.toLowerCase()==='leader')return false;\n    return !phase||phaseAbilityRelevant(ability,phase);\n  });`;
if(source.includes(oldAbilityFilter))source=source.replace(oldAbilityFilter,newAbilityFilter);

if(!source.includes('function PhaseRosterSummary('))throw new Error('Phase roster summary helper was not injected.');
if(!source.includes('<PhaseRosterSummary phase={battle.phase}'))throw new Error('Phase roster summary was not mounted in Battle Mode.');
if(!source.includes('<PhaseStats stats={battleStats} phase={battle.phase}/>'))throw new Error('Battle unit stats were not converted to phase-specific stats.');
if(!source.includes('phaseAbilityRelevant(ability,phase)'))throw new Error('Unit ability filtering was not converted to the shared phase relevance helper.');

fs.writeFileSync(path,source);
console.log('Applied shared phase-context Battle Mode standard.');
