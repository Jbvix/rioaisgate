const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(apiKey) {
  const sockets = [], timeouts = new Map(), intervals = new Map(); let id = 0;
  class Socket extends EventEmitter {
    constructor(url, options) { super(); this.options = options; this.pings = 0; sockets.push(this); }
    send(message) { this.subscription = JSON.parse(message); }
    ping() { this.pings++; }
    terminate() { this.terminated = true; this.emit('close', 1006); }
  }
  const env = { AISSTREAM_API_KEY: apiKey, AIS_FEED_START_HOUR: '8', AIS_FEED_END_HOUR: '18', AIS_FEED_TIMEZONE: 'invalid/zone' };
  const context = {
    module: { exports: {} }, process: { env }, Date,
    require(name) {
      if (name === 'ws') return Socket;
      if (name === './geofence') return { AISSTREAM_BBOX: [] };
      if (name === './vesselTracker') return { updatePosition() {}, updateStaticData() {} };
      if (name === './logger') return { info() {}, warn() {}, error() {} };
      throw Error(name);
    },
    setTimeout(fn, delay) { const handle = ++id; timeouts.set(handle, { fn, delay }); return handle; },
    clearTimeout(handle) { timeouts.delete(handle); },
    setInterval(fn, delay) { const handle = ++id; intervals.set(handle, { fn, delay }); return handle; },
    clearInterval(handle) { intervals.delete(handle); },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/aisstream'), 'utf8'), context);
  const retry = () => { const [handle, timer] = [...timeouts][0]; timeouts.delete(handle); timer.fn(); };
  return { feed: context.module.exports, sockets, timeouts, intervals, env, retry };
}

test('always-on ignores former schedule and repeated start does not duplicate subscriptions', () => {
  const f = fixture('test-only'); f.feed.start(); f.feed.start();
  assert.equal(f.sockets.length, 1); assert.equal(f.feed.getStatus().always_on, true);
  assert.equal(f.feed.getStatus().within_window, true); assert.equal(f.feed.getStatus().enabled, true);
  assert.equal(typeof f.feed.setEnabled, 'function');
  assert.equal(f.sockets[0].options.handshakeTimeout, 30000);
  f.sockets[0].emit('open'); assert.equal(f.feed.isConnected(), true);
  assert.equal(f.sockets[0].subscription.APIKey, 'test-only');
  f.sockets[0].emit('close', 1006); assert.equal(f.feed.isConnected(), false);
  assert.equal(f.intervals.size, 0); assert.equal([...f.timeouts.values()][0].delay, 5000);
  f.retry(); assert.equal(f.sockets.length, 2);
  f.sockets[1].emit('open'); assert.equal(f.feed.isConnected(), true);
});

test('heartbeat detects an unresponsive socket, while pong or data keep it alive', () => {
  const f = fixture('test-only'); f.feed.start(); const socket = f.sockets[0]; socket.emit('open');
  const tick = [...f.intervals.values()][0].fn;
  tick(); socket.emit('pong'); tick(); assert.equal(socket.terminated, undefined);
  socket.emit('message', Buffer.from('{}')); tick(); assert.equal(socket.terminated, undefined);
  assert.ok(f.feed.getStatus().last_message_at);
  tick(); assert.equal(socket.terminated, true); assert.equal(f.feed.isConnected(), false);
  assert.equal(f.timeouts.size, 1); assert.equal(f.intervals.size, 0);
  f.retry(); assert.equal(f.sockets.length, 2);
});

test('socket errors reconnect and a missing key never reports a live feed', () => {
  const f = fixture(''); f.feed.start(); assert.equal(f.sockets.length, 0);
  assert.equal(f.feed.isConnected(), false); assert.equal(f.feed.getStatus().enabled, false);
  f.env.AISSTREAM_API_KEY = 'test-only'; f.feed.start();
  f.sockets[0].emit('error', Error('connection failed')); assert.equal(f.timeouts.size, 1);
  f.retry(); assert.equal(f.sockets.length, 2);
});

test('PIN-authorized pause closes the socket, cancels retries, and can be resumed', () => {
  const f = fixture('test-only'); f.feed.start(); const first=f.sockets[0]; first.emit('open');
  f.feed.setEnabled(false);
  assert.equal(first.terminated,true); assert.equal(f.feed.isConnected(),false);
  assert.equal(f.feed.getStatus().manual_enabled,false); assert.equal(f.feed.getStatus().enabled,false);
  assert.equal(f.timeouts.size,0); assert.equal(f.intervals.size,0);
  f.feed.start(); assert.equal(f.sockets.length,1,'start must not undo a manual pause');
  f.feed.setEnabled(true); assert.equal(f.sockets.length,2); assert.equal(f.feed.getStatus().manual_enabled,true);
  f.sockets[1].emit('close',1006); assert.equal(f.timeouts.size,1);
  f.feed.setEnabled(false); assert.equal(f.timeouts.size,0,'pending reconnection must be cancelled');
});
