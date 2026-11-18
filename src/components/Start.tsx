import { useState } from 'react';
import { ArrowRight, ArrowUpRight, CircleHelp, Flag, Footprints, MapPin, Radio, Trophy, Zap } from 'lucide-react';
import { DEFAULT_LOOK } from '../game/data';
import type { Look } from '../game/types';
import Scene from './Scene';
import { Brand, ENGLISH_GAME_NAME, Tag } from './Brand';
import { LookFields, LookPreview } from './Appearance';
export default function Start({onCreate,onHall,onOnline,onAccount,username,hasHall,saving}:{onCreate:(name:string,look:Look)=>Promise<boolean>;onHall:()=>void;onOnline:()=>void;onAccount:()=>void;username?:string;hasHall:boolean;saving:boolean}){
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState('');
  const [look,setLook]=useState<Look>(DEFAULT_LOOK);
  return <div className="start-page">
    <header className="start-header"><Brand/><div className="start-top">
      {hasHall&&<button className="button quiet small" onClick={onHall}><Trophy size={15}/> 내 명예의 전당</button>}
      <button className="button quiet small" onClick={onOnline}>온라인 명예의 전당</button>
      <button className="button secondary small" onClick={onAccount}>{username?'내 계정':'계정·로그인'}</button>
    </div></header>
    <main className="start-main">
      <div className={`title-hero ${creating?'creating':''}`}>
        <Scene spot="river" look={look} variant="title"/>
        <div className="title-shade"/>
        <div className="hero-location"><MapPin size={13}/> 01 / RIVERSIDE BANK</div>
        <div className="title-content">
          <div className="title-kicker"><span/> <span>{ENGLISH_GAME_NAME}</span></div>
          <h1>롱보더 <br/><em>키우기</em></h1>
          <p className="title-ko">퇴근 후, 우리의 시즌이 시작된다.</p>
          <p className="title-desc">강변의 첫 푸시부터 마지막 페스티벌까지.<br/>나만의 라이더로 8년의 롱보드 커리어를 써 내려가세요.</p>
          {!creating&&<button className="button primary large" onClick={()=>setCreating(true)}>새 커리어 시작 <ArrowRight size={19}/></button>}
        </div>
        {creating&&<form className="create-form" onSubmit={e=>{e.preventDefault();void onCreate(name,look);}}>
          <div className="form-head"><Tag kind="lime">NEW RIDER</Tag><button type="button" className="button quiet small" onClick={()=>setCreating(false)}>닫기</button></div>
          <div className="create-preview"><h2>라이더 등록</h2><LookPreview look={look} label="라이더 외형 미리보기"/></div>
          <label className="name-field">라이더 이름<input autoFocus maxLength={16} required value={name} onChange={e=>setName(e.target.value)} placeholder="예: 리버 김" autoComplete="off"/></label>
          <LookFields look={look} onChange={setLook}/>
          <button className="button primary" disabled={saving||!name.trim()}>등록하고 첫 주 시작 <ArrowRight size={17}/></button>
        </form>}
      </div>
      <div className="start-features">
        <div><Footprints size={22}/><span><b>01 / TRAIN</b><strong>내 페이스로 훈련</strong><small>직접 계획하거나 자동 육성에 맡기세요.</small></span></div>
        <div><Zap size={22}/><span><b>02 / BUILD</b><strong>29개의 기술과 라인</strong><small>배운 기술을 이어 60초의 무대를 만드세요.</small></span></div>
        <div><Flag size={22}/><span><b>03 / COMPETE</b><strong>한 시즌, 여섯 번의 대회</strong><small>뉴비부에서 시작해 오픈부로 올라가세요.</small></span></div>
      </div>
      <footer className="start-footer"><span><CircleHelp size={14}/> 행동 확인 후 2초 수행</span><span>ORIGINAL PIXEL CAREER SIM <ArrowUpRight size={13}/></span></footer>
    </main>
  </div>;
}
