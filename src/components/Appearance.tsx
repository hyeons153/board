import { useEffect, useRef } from 'react';
import { BOARDS, HAIR_COLORS, PANTS, SHIRTS, SHOES, SKINS } from '../game/data';
import type { Look } from '../game/types';
import { paintRider } from '../scene/landscape';

const fields=[
  ['hair','헤어스타일',['짧은 머리','옆머리','긴 머리','캡']],
  ['hairColor','머리 색상',HAIR_COLORS],
  ['skin','피부색',SKINS],
  ['shirt','상의',SHIRTS],
  ['pants','하의',PANTS],
  ['shoes','신발',SHOES],
  ['board','데크 색상',BOARDS],
  ['deckDesign','데크 디자인',['기본','라인','스탬프','도트']],
] as const;

export function LookFields({look,onChange}:{look:Look;onChange:(look:Look)=>void}){
  return <div className="swatch-grid">
    {fields.map(([field,label,values])=>
      <fieldset key={field}>
        <legend>{label}</legend>
        {field==='hair'||field==='deckDesign'
          ? <select aria-label={label} value={look[field]??0} onChange={event=>onChange({...look,[field]:Number(event.target.value)})}>
              {values.map((name,index)=><option value={index} key={name}>{name}</option>)}
            </select>
          : <div>{values.map((color,index)=>{
              const picked=(look[field]??(field==='hairColor'?look.hair:0))===index;
              return <button key={color} type="button" className={'swatch'+(picked?' picked':'')} style={{backgroundColor:color}}
                aria-pressed={picked} aria-label={label+' '+(index+1)} onClick={()=>onChange({...look,[field]:index})}/>;
            })}</div>
        }
      </fieldset>
    )}
  </div>;
}

export function PixelRider({look,label}:{look:Look;label?:string}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const context=ref.current?.getContext('2d');
    if(context) paintRider(context,look,'rest',0);
  },[look]);
  return <canvas ref={ref} className="pixel-rider" width={64} height={65} role={label?'img':undefined} aria-label={label} aria-hidden={!label}/>;
}
