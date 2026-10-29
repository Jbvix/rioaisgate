const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isInsideBay}=require('../src/geofence');
test('crossings require confirmation, respect warmup/cooldown and avoid duplicates', async()=>{
  const realNow=Date.now; const realInterval=global.setInterval;
  let now=1_000_000; Date.now=()=>now; global.setInterval=()=>({unref(){}});
  const events=[];
  for(const [path,exports] of [['../src/db',{recordEvent:async e=>{events.push(e);return e;}}],['../src/db/writeQueue',{enqueuePosition(){},enqueueUpsert(){}}],['../src/notifications',{notifyGeofenceEvent(){}}]]) {
    require.cache[require.resolve(path)]={id:require.resolve(path),filename:require.resolve(path),loaded:true,exports};
  }
  try {
    const tracker=require('../src/vesselTracker');
    const inside={lat:-22.85,lon:-43.15}; const outside={lat:-23.04,lon:-43.20};
    assert.equal(isInsideBay(inside.lat,inside.lon),true); assert.equal(isInsideBay(outside.lat,outside.lon),false);
    const position=p=>tracker.updatePosition('710123456',{...p,speed:10,heading:0});
    position(outside);position(inside);position(inside); assert.equal(events.length,0,'warmup');
    now+=120_001;position(outside);position(inside); assert.equal(events.length,0,'single jitter');
    position(outside);position(outside); await new Promise(setImmediate);
    assert.deepEqual(events.map(e=>e.event_type),['EXIT']);
    position(outside);position(outside); assert.equal(events.length,1,'no duplicates');
    position(inside);position(inside); assert.equal(events.length,1,'cooldown');
    now+=120_001;position(outside);position(outside); await new Promise(setImmediate);
    now+=120_001;position(inside);position(inside);await new Promise(setImmediate);
    assert.deepEqual(events.map(e=>e.event_type),['EXIT','EXIT','ENTRY']);
  } finally {Date.now=realNow;global.setInterval=realInterval;}
});
