const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
let feedEnabled = true;
const db = { isConfigured: () => true, ping: async () => {}, getRecentEvents: async () => [], getDailyStats: async () => [], getDailyStatsMeta: async () => ({}), getVesselHistory: async () => [] };
for (const [path, exports] of [['../src/db', db], ['../src/vesselTracker', { getActiveVessels: () => [], shipTypeLabel: () => '' }], ['../src/aisstream', { isConnected: () => false, getStatus: () => ({manual_enabled: feedEnabled}), setEnabled: (enabled) => { feedEnabled = enabled; } }], ['../src/db/retention', { EVENT_RETENTION_DAYS: 7 }]]) {
  require.cache[require.resolve(path)] = { id: require.resolve(path), filename: require.resolve(path), loaded: true, exports };
}
let server, base;
before(async () => {
  const app = express(); app.use(express.json()); app.use('/api', require('../src/api'));
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise(r => server.close(r)));
test('PIN control fails closed, pauses/reactivates and limits invalid attempts', async () => {
  const post = (pin, enabled = false) => fetch(base+'/aisstream/toggle', {method:'POST',headers:{'content-type':'application/json',...(pin ? {'X-AIS-Control-PIN':pin} : {})},body:JSON.stringify({enabled})});
  delete process.env.AIS_CONTROL_PIN;
  assert.equal((await post('123456')).status,503);
  process.env.AIS_CONTROL_PIN = '123456';
  assert.equal((await post()).status,401);
  assert.equal((await post('654321')).status,401);
  assert.equal(feedEnabled,true);
  const paused = await post('123456'); assert.equal(paused.status,200); assert.equal(feedEnabled,false);
  assert.equal((await paused.json()).manual_enabled,false);
  assert.equal((await post('123456','false')).status,400);
  delete process.env.AISSTREAM_API_KEY;
  assert.equal((await post('123456',true)).status,503); assert.equal(feedEnabled,false);
  process.env.AISSTREAM_API_KEY = 'test-only';
  assert.equal((await post('123456',true)).status,200); assert.equal(feedEnabled,true);
  for(let i=0;i<5;i++) assert.equal((await post('654321')).status,401);
  const blocked=await post('123456'); assert.equal(blocked.status,429); assert.ok(Number(blocked.headers.get('retry-after'))>0);
  assert.equal(feedEnabled,true);
  delete process.env.AIS_CONTROL_PIN; delete process.env.AISSTREAM_API_KEY;
});
test('invalid pagination is rejected before database access', async () => {
  for (const route of ['/events?limit=-1','/events?limit=1.5','/events?limit=501','/events?limit=NaN','/events?limit=1&limit=2','/events?limit=','/stats/daily?days=0','/stats/daily?days=91','/vessels/710123456/history?limit=201']) {
    assert.equal((await fetch(base+route)).status,400,route);
  }
  assert.equal((await fetch(base+'/events?limit=500')).status,200);
  assert.equal((await fetch(base+'/vessels/invalid/history')).status,400);
  const d=await (await fetch(base+'/stats/daily')).json(); assert.equal(d.meta.retentionDays,7);
});
test('readiness fails on a database outage, liveness stays available, internals stay private', async () => {
  db.ping=async()=>{throw Error('sensitive database host');};
  const health=await fetch(base+'/health'); assert.equal(health.status,503);
  const body=await health.json(); assert.equal(body.ok,false); assert.equal(body.db,false); assert.doesNotMatch(JSON.stringify(body),/sensitive/);
  assert.equal((await fetch(base+'/health/live')).status,200);
  db.ping=async()=>{}; assert.equal((await fetch(base+'/health')).status,200);
  db.getRecentEvents=async()=>{throw Error('sensitive query');};
  const error=await fetch(base+'/events'); assert.equal(error.status,500); assert.doesNotMatch(await error.text(),/sensitive/);
});
