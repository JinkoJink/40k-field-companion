export type Phase = 'command'|'movement'|'shooting'|'charge'|'fight';
export type AttachmentRole = 'leader'|'support';
export type EnhancementKind = 'enhancement'|'upgrade'|'binding';
export type Pricing = {models:number;points:number};
export type PriceTier = {range?:string;label?:string;costs:Pricing[]};
export type Constraint = {type:'min'|'max'|string;value:number;scope?:string;childId?:string};

export type RuleSource = 'bsdata'|'40kdc'|'faction-pack'|'official-app-transcription'|'derived';
export type RuleMeta = {
  source?:RuleSource;
  quality?:'official'|'structured'|'provisional'|'derived';
  phase?:Phase|'any';
  phases?:(Phase|'any')[];
  playerTurn?:'your-turn'|'opponent-turn'|'either'|string;
  behavior?:string;
  scope?:unknown;
  usage?:unknown;
  effect?:unknown;
  gameVersion?:{edition?:string;dataslate?:string};
};

export type Profile = {
  id?:string;
  name:string;
  type?:string;
  characteristics:Record<string,string>;
  description?:string;
  rule?:RuleMeta;
};

export type OptionNode = {
  id:string;
  name:string;
  kind:'entry'|'group';
  type?:string;
  hidden:boolean;
  costs:{name:string;type:string;value:number}[];
  constraints:Constraint[];
  profiles:Profile[];
  options:OptionNode[];
};

export type Enhancement = {
  id?:string;
  name:string;
  points:number;
  description?:string;
  supportTo?:string[];
  detachmentId?:string;
  keywordRestrictions?:string[];
  /** OR between groups; AND between keywords in one group. */
  keywordRestrictionGroups?:string[][];
  exclusionKeywords?:string[];
  allowedHosts?:string[];
  /** Extra bodyguards unlocked while the bearer has this Enhancement. */
  attachmentBodyguardIds?:string[];
  /** Keywords granted to the bearer while this rule is active. */
  grantKeywords?:string[];
  upgrade?:boolean;
  kind?:EnhancementKind;
  countsTowardLimit?:boolean;
  mandatory?:boolean;
  maxTargets?:number;
  abilityId?:string|null;
  gameModes?:string[];
  gameVersion?:{edition?:string;dataslate?:string};
  rule?:RuleMeta;
};

export type Detachment = {
  id?:string;
  name:string;
  dp:number;
  objective:string;
  unique?:string;
  tags?:string[];
  enhancements?:Enhancement[];
  stratagemIds?:string[];
  ruleName?:string;
  summary?:string;
  ruleText?:string;
};

export type TargetRestrictions = {
  requiredKeywords?:string[];
  anyKeywords?:string[];
  excludedKeywords?:string[];
  unitNames?:string[];
};

export type Stratagem = {
  id:string;
  name:string;
  phases:('command'|'movement'|'shooting'|'charge'|'fight'|'any')[];
  cp?:number;
  type?:string;
  timing?:string;
  when?:string;
  target?:string;
  effect?:string;
  description?:string;
  playerTurn?:string;
  detachmentId?:string;
  targetRestrictions?:TargetRestrictions|null;
  restrictionConfidence?:'exact'|'structured'|'text-derived'|'unknown';
  gameVersion?:{edition?:string;dataslate?:string};
};

export type UnitIndex = {
  id:string;
  /** Stable upstream 40kdc unit ID when available. */
  externalId?:string;
  name:string;
  legends:boolean;
  categories:string[];
  stats:Record<string,string>;
  pricing?:PriceTier[]|null;
  role?:string|null;
  attachmentRole?:AttachmentRole|null;
  attachTo?:string[];
  transportCapacity?:{capacity?:number;[key:string]:unknown}|null;
  weaponCount:number;
  abilityCount:number;
  sourceVersion?:{edition?:string;dataslate?:string};
};

export type UnitDetail = UnitIndex & {
  abilities?:Profile[];
  weapons?:Profile[];
  rules?:{name:string;type:string;targetId?:string}[];
  options?:OptionNode[];
};

export type WargearConfig = {
  choices:Record<string,string>;
  modelCounts:Record<string,number>;
};

export type RosterUnit = {
  instanceId:string;
  unitId:string;
  models:number;
  enhancement?:string;
  attachedTo?:string;
  warlord?:boolean;
  wargear:WargearConfig;
  /** Datasheet snapshot captured when this configured roster instance is created. */
  stats?:Record<string,string>;
  weapons?:Profile[];
  abilities?:Profile[];
};

export type ValidationIssue = {
  level:'error'|'warning';
  message:string;
  unitInstanceId?:string;
};

export type BattleUnitState = {
  modelsRemaining:number;
  woundsLost:number;
  woundsRemaining?:number;
  destroyed:boolean;
  /** Exact current wounds for each model in this unit, in stable model order. */
  modelWounds?:number[];
  /** Frozen build-time datasheet values for this battle snapshot. */
  stats?:Record<string,string>;
  weapons?:Profile[];
  abilities?:Profile[];
  startingModels?:number;
  woundsPerModel?:number;
};

export type RoundScore = {primary:number;secondary:number};
export type ObjectiveState = {id:string;name:string;controller:'you'|'opponent'|'contested'};
export type BattleState = {
  active:boolean;
  round:number;
  phase:Phase;
  cp:number;
  score:Record<number,RoundScore>;
  objectives:ObjectiveState[];
  units:Record<string,BattleUnitState>;
  notes:string;
};

export type PackageManifest={file:string;hash:string};
export type RulesManifest={datasetVersion:string;schemaVersion:number;factions:{necrons:{packages:Record<string,PackageManifest>}}};
