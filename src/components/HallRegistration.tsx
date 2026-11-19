import { useCallback, useEffect, useRef, useState } from 'react';
import { readArchiveTicket } from '../browserSaves';
import type { Publication } from '../game/public';
import type { Archive, View } from '../game/types';
import { service } from './Account';
import { Tag } from './Brand';

type Snapshot={scope:string;rows:Publication[];loading:boolean;error?:string};
const errorText=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback;

export function useHallPublications(scope:string|undefined,screen:string|undefined){
  const [snapshot,setSnapshot]=useState<Snapshot>();
  const [working,setWorking]=useState<string>();
  const [failure,setFailure]=useState<{scope:string;archiveId:string;message:string}>();
  const request=useRef(0);
  const inFlight=useRef(false);
  const activeScope=useRef<string|undefined>(undefined);
  const refresh=useCallback(async()=>{
    if(!scope)return;
    const token=++request.current;
    setSnapshot(previous=>({scope,rows:previous?.scope===scope?previous.rows:[],loading:true}));
    try{
      const rows=await service<Publication[]>('public',{type:'mine'},scope);
      if(token===request.current)setSnapshot({scope,rows,loading:false});
    }catch(error){
      if(token===request.current)setSnapshot({scope,rows:[],loading:false,error:errorText(error,'등록 상태를 읽지 못했어요.')});
    }
  },[scope]);
  useEffect(()=>{
    activeScope.current=screen?scope:undefined;
    if(screen)void refresh();
    return ()=>{request.current++;activeScope.current=undefined;};
  },[screen,scope,refresh]);

  const current=snapshot?.scope===scope?snapshot:undefined;
  const ready=!!current&&!current.loading&&!current.error;
  const change=async(archiveId:string,active:boolean,storage:View['storage'])=>{
    if(!scope||!ready||inFlight.current)return;
    inFlight.current=true;
    setWorking(archiveId);setFailure(undefined);
    const token=request.current;
    try{
      const ticket=storage==='browser'&&active?await readArchiveTicket(archiveId):undefined;
      if(storage==='browser'&&active&&!ticket)throw new Error('이 은퇴 기록의 서버 검증 자료가 없어 글로벌 랭킹에 등록할 수 없어요.');
      if(token!==request.current)return;
      const row=await service<Publication>('public',{type:'publish',archiveId,active,ticket},scope);
      if(token!==request.current&&activeScope.current===scope)void refresh();
      else setSnapshot(previous=>previous?.scope===scope?{...previous,rows:[...previous.rows.filter(item=>item.archiveId!==archiveId),row]}:previous);
      return row;
    }catch(error){
      setFailure({scope,archiveId,message:errorText(error,'등록 상태를 저장하지 못했어요.')});
    }finally{
      inFlight.current=false;
      setWorking(undefined);
    }
  };
  return {rows:current?.rows??[],ready,working,error:current?.error,refresh,change,
    failure:failure?.scope===scope?failure:undefined};
}

export const rankStatusNote=(status:Publication['rankStatus'])=>status==='no-points'?'공개 프로필은 볼 수 있어요. 공식 경기에서 획득한 RP가 없어 글로벌 순위는 표시되지 않아요.':
  status==='unverified'?'공개 프로필은 볼 수 있어요. 서버에서 통산 RP 전체를 검증할 수 없어 글로벌 순위에는 포함되지 않아요.':undefined;

export function PublicationStatus({publication}:{publication?:Publication}){
  if(!publication)return null;
  if(publication.moderated)return <Tag kind="orange">운영 검토로 비공개</Tag>;
  if(!publication.active)return <Tag kind="muted">랭킹 등록 취소됨</Tag>;
  const note=rankStatusNote(publication.rankStatus);
  return <div className="hall-publication-status">
    <Tag kind={note?'muted':'lime'}>{publication.rankStatus==='unverified'?'검증 불가':note?'공개 프로필 등록 완료':'글로벌 등록 완료'}</Tag>
    {note&&<p>{note}</p>}
  </div>;
}

export type RegistrationActions={
  rows:Publication[];ready:boolean;working?:string;loadError?:string;retry:()=>void;
  failure?:{archiveId:string;message:string};
  onRegister:(archive:Archive)=>void;onRank:(archive:Archive,publication:Publication)=>void;onWithdraw:(archive:Archive)=>void;
};

export function RegistrationError({registration,archiveId}:{registration:RegistrationActions;archiveId?:string}){
  const failed=registration.failure;
  return <>
    {registration.loadError&&<div className="form-error" role="alert"><p>{registration.loadError}</p><button className="button quiet small" onClick={registration.retry}>다시 불러오기</button></div>}
    {failed&&failed.archiveId===archiveId&&<p className="form-error" role="alert">{failed.message}</p>}
  </>;
}
