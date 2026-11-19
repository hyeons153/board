import type { Archive, BrowserArchive, BrowserSaveResponse } from './game/types';

type StoredArchive=BrowserArchive&{position:number};
let opening:Promise<IDBDatabase>|undefined;
function database(){
  return opening??=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('longboarder-tycoon',1);
    request.onupgradeneeded=()=>{
      request.result.createObjectStore('save');
      request.result.createObjectStore('archives',{keyPath:'archive.id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('브라우저 저장소를 열지 못했어요.'));
  }).catch(error=>{opening=undefined;throw error;});
}

async function read<T>(store:'save'|'archives',pick:(store:IDBObjectStore)=>IDBRequest<T>){
  const db=await database();
  return new Promise<T>((resolve,reject)=>{
    const request=pick(db.transaction(store).objectStore(store));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('브라우저 저장 기록을 읽지 못했어요.'));
  });
}
export const readCheckpoint=()=>read<string|undefined>('save',store=>store.get('career'));
export const readArchives=():Promise<Archive[]>=>read<StoredArchive[]>('archives',store=>store.getAll()).then(rows=>
  rows.sort((a,b)=>a.position-b.position).map(row=>row.archive));
export const readArchiveTicket=async(id:string)=>(await read<BrowserArchive|undefined>('archives',store=>store.get(id)))?.ticket;

export async function commitSave(expected:string|undefined,response:BrowserSaveResponse){
  if(!response.checkpoint)throw new Error('저장할 커리어 기록이 없어요.');
  const db=await database();
  return new Promise<boolean>((resolve,reject)=>{
    const tx=db.transaction(['save','archives'],'readwrite');
    const saves=tx.objectStore('save'),stored=saves.get('career');
    let committed=false;
    tx.oncomplete=()=>resolve(committed);
    tx.onabort=()=>reject(new Error('브라우저에 저장할 수 없어요. 저장 공간을 확인해 주세요.'));
    stored.onsuccess=()=>{
      if(stored.result!==expected)return;
      saves.put(response.checkpoint,'career');
      if(response.archives?.length){
        const archives=tx.objectStore('archives'),count=archives.count();
        count.onsuccess=()=>{
          response.archives!.forEach((row,index)=>archives.put({...row,position:count.result+index}));
        };
      }
      committed=true;
    };
  });
}
