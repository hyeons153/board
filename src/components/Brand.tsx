import { ArrowUpRight, Zap } from 'lucide-react';

export const ENGLISH_GAME_NAME = 'Longboarder Tycoon';

export function Mark({size=36}:{size?:number}){
  return <span className="mark" style={{width:size,height:size}} aria-hidden="true"><Zap size={size*.56} strokeWidth={2.8} fill="currentColor"/></span>;
}
export function Brand(){
  return <div className="brand"><Mark/><span>롱보더 <br/><b>키우기</b></span></div>;
}
export function Tag({children,kind='muted'}:{children:React.ReactNode;kind?:'muted'|'lime'|'orange'|'lilac'}){
  return <span className={`tag ${kind}`}>{children}</span>;
}
export function SectionTitle({code,title,detail}:{code:string;title:string;detail?:string}){
  return <header className="section-title"><div><span className="eyebrow">{code}</span><h2>{title}</h2>{detail&&<p>{detail}</p>}</div><ArrowUpRight aria-hidden="true" size={21}/></header>;
}
