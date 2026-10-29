import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from '../src/utils/request.mjs';
test('HTTP failures are never accepted as data and slow responses time out',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({error:'db'})});
  await assert.rejects(requestJson('/api/events'),/HTTP 503/);
  globalThis.fetch=async()=>({ok:true,json:async()=>([{mmsi:'710123456'}])});
  assert.equal((await requestJson('/api/vessels'))[0].mmsi,'710123456');
  globalThis.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  await assert.rejects(requestJson('/api/events',{timeoutMs:10}),/aborted/);
 }finally{globalThis.fetch=original;}
});
