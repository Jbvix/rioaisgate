import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playPortalSound } from '../src/utils/portalSound.mjs';

test('portal audio gracefully handles unsupported audio and denied permission', async () => {
  const original = globalThis.window;
  try {
    delete globalThis.window;
    assert.equal(await playPortalSound(), false);
    globalThis.window = {};
    assert.equal(await playPortalSound(), false);
    globalThis.window = { AudioContext: class { constructor() { throw new Error('Unavailable'); } } };
    assert.equal(await playPortalSound(), false);
  } finally {
    if (original === undefined) delete globalThis.window; else globalThis.window = original;
  }
});
