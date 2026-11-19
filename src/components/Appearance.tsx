import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BOARD_COLOR_NAMES, BOARDS, BOTTOMS, EYE_COLORS, FOOTWEAR, HAIR_COLORS, HAIR_STYLES, LOOK_PRESETS, OUTFITS, PANTS, SHIRTS, SHOES, SKINS } from '../game/data';
import type { Look } from '../game/types';
import { paintRider } from '../scene/landscape';
import { ACTOR_HEIGHT } from '../scene/techniques';
import {loadCharacterSprites} from '../scene/spriteCharacter';

const fields=[
  ['hair','헤어스타일',HAIR_STYLES],
  ['hairColor','머리 색상',HAIR_COLORS],
  ['eyes','눈 색상',EYE_COLORS],
  ['skin','피부색',SKINS],
  ['outfit','상의 디자인',OUTFITS],
  ['shirt','상의 색상',SHIRTS],
  ['bottom','하의 디자인',BOTTOMS],
  ['pants','하의 색상',PANTS],
  ['footwear','신발 디자인',FOOTWEAR],
  ['shoes','신발 색상',SHOES],
  ['board','데크 색상',BOARDS],
  ['deckDesign','데크 디자인',['기본','라인','스탬프','도트']],
] as const;
const selectFields=new Set(['hair','outfit','bottom','footwear','deckDesign']);

export function LookFields({look,onChange,children}:{look:Look;onChange:(look:Look)=>void;children?:ReactNode}){
  const fieldsRoot=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!matchMedia('(max-width:760px)').matches)return;
    fieldsRoot.current?.querySelectorAll<HTMLElement>('.swatch-palette').forEach(row=>{
      const button=row.querySelector<HTMLElement>('button[aria-pressed=true]');
      if(!button||row.scrollWidth<=row.clientWidth)return;
      const left=button.offsetLeft-4,right=button.offsetLeft+button.offsetWidth+4;
      if(left<row.scrollLeft)row.scrollLeft=left;
      else if(right>row.scrollLeft+row.clientWidth)row.scrollLeft=right-row.clientWidth;
    });
  },[look]);
  return <div className="swatch-grid" ref={fieldsRoot}>
    {children}
    <fieldset className="look-gender"><legend>성별</legend><div className="gender-options" aria-label="성별">
      {(['male','female'] as const).map(gender=><button key={gender} type="button" aria-pressed={(look.gender??'male')===gender} onClick={()=>onChange({...look,gender})}>{gender==='male'?'남성':'여성'}</button>)}
    </div></fieldset>
    <fieldset className="look-presets"><legend>추천 코디</legend><div>
      {LOOK_PRESETS[look.gender??'male'].map((preset,index)=><button type="button" key={index} aria-label={'추천 코디 '+(index+1)} onClick={()=>onChange({...preset,skin:look.skin,board:look.board,deckDesign:look.deckDesign})}>
        <PixelRider look={preset}/><span>{index+1}</span>
      </button>)}
    </div></fieldset>
    {fields.map(([field,label,values])=>
      <fieldset key={field}>
        <legend>{label}</legend>
        {selectFields.has(field)
          ? <select aria-label={label} value={look[field]??0} onChange={event=>onChange({...look,...(field==='hair'?{hairColor:look.hairColor??(look.hair<4?look.hair:0)}:{}),[field]:Number(event.target.value)})}>
              {values.map((name,index)=><option value={index} key={name}>{name}</option>)}
            </select>
          : <div className="swatch-palette">{values.map((color,index)=>{
              const picked=(look[field]??(field==='hairColor'&&look.hair<4?look.hair:0))===index;
              const name=label+' '+(field==='board'?BOARD_COLOR_NAMES[index]:index+1);
              return <button key={color} type="button" className={'swatch'+(picked?' picked':'')} style={{backgroundColor:color}} title={name}
                aria-pressed={picked} aria-label={name} onClick={()=>onChange({...look,[field]:index})}/>;
            })}</div>
        }
      </fieldset>
    )}
  </div>;
}

export function PixelRider({look,label,heading=0}:{look:Look;label?:string;heading?:number}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let cancelled=false;
    void loadCharacterSprites().then(()=>{const context=ref.current?.getContext('2d');if(context&&!cancelled)paintRider(context,look,'rest',0,heading?{id:'peter-pan',progress:0,bodyHeading:heading,boardHeading:heading}:undefined);}).catch(()=>{});
    return ()=>{cancelled=true;};
  },[look,heading]);
  return <canvas ref={ref} className="pixel-rider" width={256} height={ACTOR_HEIGHT*2} role={label?'img':undefined} aria-label={label} aria-hidden={!label}/>;
}

export function LookPreview({look,label}:{look:Look;label:string}){
  const [heading,setHeading]=useState(0);
  return <div className="look-preview"><PixelRider look={look} label={label} heading={heading}/><div className="look-views" aria-label="외형 미리보기 방향">
    {['정면','오른쪽','뒤','왼쪽'].map((name,index)=>{
      const angle=[0,Math.PI/2,Math.PI,-Math.PI/2][index];
      return <button key={name} type="button" aria-pressed={heading===angle} onClick={()=>setHeading(angle)}>{name}</button>;
    })}
  </div></div>;
}
