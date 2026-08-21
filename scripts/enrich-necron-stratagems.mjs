import fs from 'node:fs';

const path='public/data/necrons/stratagems.json';
const doc=JSON.parse(fs.readFileSync(path,'utf8'));

const rules={
  'masks-of-death-annihilation-legion':{
    when:"Your opponent's Shooting phase or the Fight phase, just after an enemy unit has selected its targets.",
    target:"One Destroyer Cult or Flayed Ones unit from your army that was selected as the target of one or more of the attacking unit's attacks.",
    effect:'Until the end of the phase, each time an attack targets your unit, subtract 1 from the Hit roll.',
    targetRestrictions:{anyKeywords:['Destroyer Cult','Flayed Ones']},restrictionConfidence:'exact'
  },
  'the-spoor-of-frailty-annihilation-legion':{
    when:'Your Shooting phase or the Fight phase.',
    target:'One Destroyer Cult or Flayed Ones unit from your army that has not been selected to shoot or fight this phase.',
    effect:'Until the end of the phase, each time a model from your unit makes an attack that targets a unit below Starting Strength, add 1 to the Hit roll. If the target is Below Half-strength, add 1 to the Wound roll as well.',
    targetRestrictions:{anyKeywords:['Destroyer Cult','Flayed Ones']},restrictionConfidence:'exact'
  },
  'murderous-reanimation-annihilation-legion':{
    when:'Fight phase.',
    target:'One Destroyer Cult or Flayed Ones unit from your army that has just destroyed an enemy unit, or just caused an enemy unit that was not Below Half-strength to become Below Half-strength.',
    effect:"Your unit's Reanimation Protocols activate.",
    targetRestrictions:{anyKeywords:['Destroyer Cult','Flayed Ones']},restrictionConfidence:'exact'
  },
  'pitiless-hunters-annihilation-legion':{
    when:'Fight phase.',
    target:'One Destroyer Cult or Flayed Ones unit from your army that has not been selected to fight this phase.',
    effect:'Until the end of the phase, each time a model in your unit makes a Pile-in or Consolidation move, it can move up to 6\", instead of up to 3\".',
    targetRestrictions:{anyKeywords:['Destroyer Cult','Flayed Ones']},restrictionConfidence:'exact'
  },
  'blood-fuelled-cruelty-annihilation-legion':{
    when:"Your opponent's Movement phase, just after an enemy unit ends a Fall Back move.",
    target:'One Destroyer Cult or Flayed Ones unit from your army that started the phase within Engagement Range of that enemy unit.',
    effect:'Roll one D6: on a 2-5, that enemy unit suffers D3 mortal wounds; on a 6, that enemy unit suffers 3 mortal wounds. Your unit can then make a Normal move, but must end that move as close as possible to that enemy unit.',
    targetRestrictions:{anyKeywords:['Destroyer Cult','Flayed Ones']},restrictionConfidence:'exact'
  },
  'insanitys-ire-annihilation-legion':{
    when:"Your opponent’s Shooting phase, when an enemy unit that targeted a friendly unengaged Destroyer Cult/Flayed Ones unit this phase has shot.",
    target:'That Destroyer Cult/Flayed Ones unit.',
    effect:'Your unit can make a surge move of up to D6\".',
    targetRestrictions:{anyKeywords:['Destroyer Cult','Flayed Ones']},restrictionConfidence:'exact'
  },
  'dominance-protocols-hand-of-the-dynasty':{
    when:'Command phase.',
    target:'One friendly Immortals unit.',
    effect:'Your unit has +1 OC until the end of the turn.',
    targetRestrictions:{unitNames:['Immortals']},restrictionConfidence:'exact'
  },
  'will-of-the-conqueror-hand-of-the-dynasty':{
    when:'End of your Movement phase.',
    target:'One friendly Immortals/Necron Warriors unit.',
    effect:'Select one objective your unit is controlling. That objective is secured.',
    targetRestrictions:{unitNames:['Immortals','Necron Warriors']},restrictionConfidence:'exact'
  },
  'nanosaturation-hand-of-the-dynasty':{
    when:"Your opponent’s Shooting phase, when an enemy unit that targeted a friendly Immortals/Necron Warriors unit has shot.",
    target:'That Immortals/Necron Warriors unit.',
    effect:'Your unit shoots using snap shooting, but while doing so your unit can only target that enemy unit.',
    targetRestrictions:{unitNames:['Immortals','Necron Warriors']},restrictionConfidence:'exact'
  }
};

let changed=0;
for(const record of doc.records||[]){
  const patch=rules[record.id];
  if(!patch)continue;
  Object.assign(record,patch,{description:`${patch.when} ${patch.target} ${patch.effect}`.trim()});
  changed++;
}

const missing=Object.keys(rules).filter(id=>!(doc.records||[]).some(record=>record.id===id));
if(missing.length)throw new Error(`Missing expected Necron stratagem records: ${missing.join(', ')}`);
if(changed!==Object.keys(rules).length)throw new Error(`Expected to enrich ${Object.keys(rules).length} stratagems, enriched ${changed}`);

fs.writeFileSync(path,JSON.stringify(doc));
console.log(`Enriched ${changed} Necron stratagems from the frozen rules set`);
