import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('WebSocket retries disconnects and never reconnects after unmount',()=>{
 const source=fs.readFileSync(new URL('../src/hooks/useWebSocket.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function useWebSocket','function useWebSocket');
 let effect;let pending;const sockets=[];
 class Socket {constructor(){sockets.push(this);} close(){this.onclose?.();}}
 const sandbox={WebSocket:Socket, WS_URL:'ws://localhost', console:{log(){},warn(){}},useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>{effect=fn;},setTimeout:fn=>{pending=fn;return 1;},clearTimeout:()=>{pending=null;}};
 vm.createContext(sandbox);vm.runInContext(source+';useWebSocket(()=>{});',sandbox);
 const cleanup=effect();assert.equal(sockets.length,1);
 sockets[0].onclose();assert.equal(typeof pending,'function');pending();assert.equal(sockets.length,2);
 cleanup();assert.equal(pending,null);assert.equal(sockets[1].onclose,null);
});
