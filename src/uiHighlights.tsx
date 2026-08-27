import React,{useId,useState} from 'react';

export type HighlightTone='modified'|'reminder'|'warning'|'benefit';

export type ModifiedValue={
  value:React.ReactNode;
  baseValue?:React.ReactNode;
  modified?:boolean;
  label?:string;
  explanation?:React.ReactNode;
};

/** Shared 40K Field Companion primitive for any value changed by an active rule. */
export function HighlightedValue({value,baseValue,modified=false,label,explanation}:ModifiedValue){
  const content=<span className={`uiHighlightedValue ${modified?'isModified':''}`} aria-label={label}>
    {baseValue!==undefined&&modified&&<span className='uiBaseValue'>{baseValue}</span>}
    <span className='uiCurrentValue'>{value}</span>
  </span>;
  if(!explanation)return content;
  return <span className='uiInlineHighlight'>
    {content}
    <RuleReminder title={label||'Modified value'} tone='modified'>{explanation}</RuleReminder>
  </span>;
}

export function ModifiedStat({label,value,baseValue,explanation}:{label:string;value:React.ReactNode;baseValue?:React.ReactNode;explanation?:React.ReactNode}){
  const modified=baseValue!==undefined&&String(baseValue)!==String(value);
  return <span className={`uiStat ${modified?'isModified':''}`}>
    <small>{label}</small>
    <HighlightedValue value={value} baseValue={baseValue} modified={modified} label={`${label}${modified?' modified':''}`} explanation={explanation}/>
  </span>;
}

/** Highlighted, tappable reminder shared by faction, detachment and battle UIs. */
export function RuleReminder({title,children,tone='reminder',active=true,defaultOpen=false}:React.PropsWithChildren<{title:string;tone?:HighlightTone;active?:boolean;defaultOpen?:boolean}>){
  const[open,setOpen]=useState(defaultOpen);
  const bodyId=useId();
  if(!active)return null;
  return <span className={`uiRuleReminder tone-${tone} ${open?'isOpen':''}`}>
    <button type='button' className='uiRuleReminderButton' aria-expanded={open} aria-controls={bodyId} onClick={()=>setOpen(current=>!current)}>
      <span className='uiRuleReminderMark' aria-hidden='true'>!</span>
      <span>{title}</span>
      <span className='uiRuleReminderChevron' aria-hidden='true'>▾</span>
    </button>
    {open&&<span id={bodyId} className='uiRuleReminderBody'>{children}</span>}
  </span>;
}

/** Convenience helper for rule engines before rendering. */
export function modifiedValue(baseValue:React.ReactNode,value:React.ReactNode,explanation?:React.ReactNode):ModifiedValue{
  return{baseValue,value,modified:String(baseValue)!==String(value),explanation};
}
