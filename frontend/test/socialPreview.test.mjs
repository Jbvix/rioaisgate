import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('WhatsApp preview metadata and the public JPEG are available without JavaScript',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const property of ['og:title','og:description','og:url','og:image','og:image:width','og:image:height','og:image:alt']) {
  assert.match(html,new RegExp(`<meta property="${property}" content="[^"]+"`),property);
 }
 const image=new URL(html.match(/property="og:image" content="([^"]+)"/)[1]);
 assert.equal(image.origin,'https://riogateais.netlify.app');
 const bytes=fs.readFileSync(path.join(root,'public',image.pathname));
 assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 assert(bytes.length<300_000,'keep link preview lightweight');
 assert.match(html,/name="twitter:card" content="summary_large_image"/);
});
