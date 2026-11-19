import { ArrowRight, DoorOpen, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../game/accountPolicy';
import { formatCareerDate } from '../game/data';
import type { View } from '../game/types';
import { PixelRider } from './Appearance';
import { SectionTitle, Tag } from './Brand';
import type { Submit } from './Overview';

export async function service<T>(area:'account'|'public',request?:Record<string,unknown>,scope?:string,query?:URLSearchParams):Promise<T>{
  const params=new URLSearchParams(query);
  params.set('area',area);
  const response=await fetch('/api/game?'+params.toString(),request?{
    method:'POST',headers:{'Content-Type':'application/json',...(scope?{'X-Game-Scope':scope}:{})},body:JSON.stringify(request),cache:'no-store',
  }:{cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||'요청을 처리하지 못했어요.');
  return data as T;
}

export default function Account({view,send,onSwitch,onSessionChange}:{view:View;send:Submit;onSwitch:()=>void;onSessionChange?:()=>Promise<void>}){
  const [form,setForm]=useState<'register'|'login'>('register');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const call=async(action:Record<string,unknown>)=>{
    setBusy(true);
    setError('');
    try{
      await service('account',action,view.scope);
      if(onSessionChange){await onSessionChange();setBusy(false);setPassword('');}
      else window.location.reload();
    }catch(error){
      setError(error instanceof Error?error.message:'계정에 연결하지 못했어요.');
      setBusy(false);
    }
  };
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    void call({type:deleting?'delete':form,username,password});
  };
  return <div className="stack account-page">
    <section className="panel content-panel">
      <SectionTitle code="RIDER ACCOUNT" title={view.username?'계정 관리':'계정·게스트 플레이'}/>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {view.username?<div className="account-identity">
        <ShieldCheck size={28}/><div><strong>{view.username}</strong><p>은퇴 선수 {view.career.hall.length}명 보관</p></div>
        <button className="button secondary" disabled={busy} onClick={()=>void call({type:'logout'})}><DoorOpen size={16}/> 로그아웃</button>
      </div>:<>
        <div className="pill-row account-tabs">
          <button className={'pill'+(form==='register'?' active':'')} aria-pressed={form==='register'} onClick={()=>setForm('register')}>계정 만들기</button>
          <button className={'pill'+(form==='login'?' active':'')} aria-pressed={form==='login'} onClick={()=>setForm('login')}>로그인</button>
        </div>
        <p>가입하거나 로그인하면 이 브라우저의 게스트 커리어가 계정에 연결됩니다. 양쪽에 육성 중인 선수가 있으면 기존 계정 선수를 먼저 표시하고 다른 선수는 보관함에 둡니다.</p>
        <form className="account-form" onSubmit={submit}>
          <label>아이디<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9][a-zA-Z0-9_\-]{2,23}" placeholder="예: riverside_01"/></label>
          <label>비밀번호<input value={password} onChange={e=>setPassword(e.target.value)} type="password"
            autoComplete={form==='register'?'new-password':'current-password'} required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH}/></label>
          <button className="button primary" disabled={busy}><KeyRound size={16}/> {form==='register'?'계정 만들고 기록 연결':'로그인하고 기록 불러오기'} <ArrowRight size={16}/></button>
        </form>
      </>}
    </section>
    {view.username&&<section className="panel content-panel">
      <SectionTitle code="MY CAREERS" title="보유 선수"/>
      {view.career.rider&&<div className="account-identity">
        <PixelRider look={view.career.rider.look}/><div><strong>{view.career.rider.name}</strong><p>{formatCareerDate(view.career.rider)}</p></div>
        <Tag kind="lime">{view.career.rider.phase==='retired'?'은퇴':'현재 육성'}</Tag>
      </div>}
      {view.career.parked?.map(rider=><div className="account-identity" key={rider.id}>
        <PixelRider look={rider.look}/><div><strong>{rider.name}</strong><p>{formatCareerDate(rider)} · 보관 중</p></div>
        <button className="button secondary" disabled={busy} onClick={async()=>{
          setBusy(true);
          try { if(await send({type:'switch-rider',id:rider.id})) onSwitch(); }
          finally {setBusy(false);}
        }}>이 선수로 전환</button>
      </div>)}
      {!view.career.rider&&!view.career.parked?.length&&<p>아직 등록한 선수가 없어요.</p>}
    </section>}
    <section className="panel content-panel">
      <SectionTitle code="DATA POLICY" title="계정과 공개 정보"/>
      <p>비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다. 로그인 아이디, 비밀번호 검증값과 세션을 서버에 보관합니다. 이메일은 수집하지 않아 이메일로 비밀번호를 복구할 수 없습니다. 선수 기록은 직접 공개 설정한 은퇴 프로필에 한해 다른 이용자가 볼 수 있습니다.</p>
      <p>공개를 취소하면 프로필과 공식 순위가 숨겨집니다. 계정을 삭제하면 해당 계정의 선수, 세션, 공개 프로필과 순위가 서비스에서 삭제됩니다.</p>
      {view.username&&(deleting?<form onSubmit={submit} className="account-form">
        <p className="form-error">삭제를 확인하려면 현재 아이디와 비밀번호를 다시 입력하세요. 삭제한 기록은 게임에서 되돌릴 수 없습니다.</p>
        <label>삭제할 아이디<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required/></label>
        <label>현재 비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"
          minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required/></label>
        <div className="pill-row"><button type="button" className="button quiet" onClick={()=>{setDeleting(false);setPassword('');}}>취소</button>
          <button className="button danger" disabled={busy||username!==view.username}>계정과 기록 영구 삭제</button></div>
      </form>:<div className="bottom-actions"><button className="button quiet" onClick={()=>{setDeleting(true);setError('');}}>계정 삭제</button></div>)}
    </section>
  </div>;
}
