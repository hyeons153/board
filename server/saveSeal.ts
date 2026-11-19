import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { GameError } from '../src/game/career.js';

export const MAX_SAVE_REQUEST=4_000_000;
type Purpose='career'|'archive';

export function saveSeal(secret:string){
  const key=createHash('sha256').update('longboard-browser-save-v1\0').update(secret).digest();
  const context=(purpose:Purpose)=>Buffer.from('longboard:v1:'+purpose);
  return {
    encode(purpose:Purpose,value:unknown){
      const iv=randomBytes(12);
      const cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(context(purpose));
      const encrypted=Buffer.concat([cipher.update(gzipSync(JSON.stringify(value))),cipher.final()]);
      return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
    },
    decode<T>(purpose:Purpose,token:string):T{
      try{
        const value=Buffer.from(token,'base64url');
        if(value.length<=28||value.toString('base64url')!==token)throw new Error('Invalid token');
        const decipher=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));
        decipher.setAAD(context(purpose));
        decipher.setAuthTag(value.subarray(12,28));
        const payload=Buffer.concat([decipher.update(value.subarray(28)),decipher.final()]);
        return JSON.parse(gunzipSync(payload,{maxOutputLength:48*1024*1024}).toString('utf8')) as T;
      }catch{
        throw new GameError('저장 기록을 확인할 수 없어요.');
      }
    },
  };
}
