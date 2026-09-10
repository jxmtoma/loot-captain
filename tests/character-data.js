'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const read = (file) => fs.readFileSync(file, 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));
(async () => {
  let storage = { consentVersion: 1, profiles: { p: { id: 'p', name: 'Test', cls: 'Beastlord', level: '100', server: 'Oakwynd',
    items: [{ id: '1', name: 'Old Helm', slot: 'head', stats: { HP: 100 }, effects: [] }], wishlist: [] } } };
  let listener, failWrite = false;
  const context = vm.createContext({ console, crypto, TextEncoder, URL,
    chrome: { runtime: { id: 'test', getURL: (value) => 'chrome-extension://test/' + value,
      onMessage: { addListener: (fn) => { listener = fn; } } },
      storage: { local: { get: async () => clone(storage), set: async (values) => {
        if (failWrite) throw new Error('Storage full'); Object.assign(storage, clone(values));
      } } } },
    importScripts: (...files) => files.forEach((file) => vm.runInContext(read(path.join('background', file)), context)),
  });
  vm.runInContext(read('background/service-worker.js'), context);
  const model = context.LootCaptain.characterData;
  const send = (msg, url = 'chrome-extension://test/options/options.html') => new Promise((resolve) => listener(msg, { url }, resolve));
  const message = async (action, value) => ({ type: 'SAVE_CHARACTER_DATA', profileId: 'p', action, value,
    expectedBinding: await model.fingerprint(storage.profiles.p), expectedRevision: storage.profiles.p.characterData?.revision || 0 });
  const now = new Date(Date.now() - 1000).toISOString();
  const input = { observedAt: now, observer: 'Tester', expansion: 'Recorded test era', patch: 'Recorded test build',
    includesHeroics: 'unknown', unbuffed: true, gearConfirmed: true, conditions: 'Conditions fixed for synthetic test',
    readings: { HP: '10000', STA: '500', STACap: '500', HSTA: '0' } };
  assert.equal(model.number('').num, null); assert.equal(model.number('0').num, 0);
  assert.throws(() => model.number('12oops'));
  assert.equal(model.aaRanks([{ name: 'Default', rank: '10', assumed: true }])[0].assumed, true);
  assert.equal(model.aaRanks([{ name: 'Unknown', rank: '', assumed: true }])[0].assumed, undefined);
  assert.equal(model.aaRanks([{ name: 'Owned', rank: '0' }])[0].assumed, undefined);
  assert.throws(() => model.aaRanks([{ name: 'Test AA', rank: '1.5' }]));
  assert.equal((await send(await message('aa', [{ name: 'Known zero', rank: '0' }, { name: 'Unknown rank', rank: '' }]))).ok, true);
  assert.equal(storage.profiles.p.characterData.aaRanks[0].rank.num, 0);
  assert.equal(storage.profiles.p.characterData.aaRanks[1].rank.num, null);
  const snapRequest = await message('snapshot', input);
  const snap = await send(snapRequest); assert.equal(snap.ok, true);
  assert.equal(snap.characterData.snapshot.server, 'Oakwynd');
  assert.equal(snap.characterData.snapshot.readings.MANA.num, null);
  assert.equal(snap.characterData.snapshot.readings.HSTA.num, 0);
  assert.equal(snap.characterData.snapshot.aaRanks.length, 2);
  assert.equal((await model.status(storage.profiles.p)).state, 'partial');
  assert.equal((await send(snapRequest)).ok, false); // stale revision
  const preserved = clone(storage);
  failWrite = true;
  assert.equal((await send(await message('snapshot', { ...input, readings: { HP: '12000' } }))).ok, false);
  assert.deepEqual(storage, preserved); failWrite = false;
  assert.equal((await send(await message('snapshot', input), 'https://guild.opendkp.com/')).ok, false);
  assert.equal((await send({ ...await message('snapshot', input), profileId: 'deleted' })).ok, false);
  assert.equal((await send({ ...await message('snapshot', input), expectedBinding: 'wrong' })).ok, false);
  assert.deepEqual(storage, preserved);

  // Wishlist, formula, name, and parser provenance changes are not physical changes.
  const baselineBinding = await model.fingerprint(storage.profiles.p);
  const cosmetic = clone(storage.profiles.p); cosmetic.name = 'Renamed'; cosmetic.scoreFormula = { key: 'mana', version: 1 };
  cosmetic.items[0].stats.HP = { raw: '100 HP', num: 100, source: 'raidloot' };
  assert.equal(await model.fingerprint(cosmetic), baselineBinding);
  await send({ type: 'MUTATE_WISHLIST', profileId: 'p', action: 'toggle', item: { raidlootId: '2', name: 'Wanted', slot: 'head' } });
  assert.equal(storage.profiles.p.characterData.snapshot.invalidatedAt, null);
  await send({ type: 'SET_PROFILE_FORMULA', profileId: 'p', formula: { key: 'mana', version: 1 } });
  assert.equal(storage.profiles.p.characterData.snapshot.invalidatedAt, null);
  const observation = { observedAt: now, observer: 'Tester', slot: 'head', oldItem: 'Old', newItem: 'New',
    itemChanges: 'Synthetic +100 item HP; other contributions held fixed', conditionsUnchanged: true,
    before: { HP: '10000' }, after: { HP: '10100' }, restored: { HP: '10000' } };
  assert.equal((await send(await message('observation', observation))).ok, true);
  assert.equal(storage.profiles.p.characterData.observations[0].reviewStatus, 'pending');
  assert.equal((await send(await message('observation', { ...observation, restored: { HP: '9999' } }))).ok, true);
  assert.equal(storage.profiles.p.characterData.observations[1].reviewStatus, 'inconsistent');
  assert.equal((await send(await message('observation', { ...observation, restored: {} }))).ok, true);
  assert.equal(storage.profiles.p.characterData.observations[2].reviewStatus, 'incomplete');
  const oldCapture = clone(storage.profiles.p.characterData.observations[0].baselineSnapshot);
  const oldEditor = clone(storage.profiles.p);
  await send(await message('aa', [{ name: 'Known zero', rank: '1' }]));
  assert.ok(storage.profiles.p.characterData.snapshot.invalidatedAt);
  const currentRevision = storage.profiles.p.characterData.revision;
  // Ordinary profile saves cannot overwrite newer inputs.
  await send({ type: 'SAVE_PROFILES', profiles: { p: oldEditor }, deletedIds: [] });
  assert.equal(storage.profiles.p.characterData.revision, currentRevision);
  assert.equal(storage.profiles.p.characterData.aaRanks[0].rank.num, 1);
  assert.deepEqual(storage.profiles.p.characterData.observations[0].baselineSnapshot, oldCapture);
  assert.equal((await send(await message('observation', observation))).ok, false);
  await send(await message('snapshot', { ...input, includesHeroics: 'yes' }));
  assert.equal((await model.status(storage.profiles.p)).state, 'recorded');
  await send({ type: 'EQUIP_ITEM', profileId: 'p', targetIndex: 0, expected: { id: '1', name: 'Old Helm', slot: 'head' },
    item: { id: '2', name: 'New Helm', slot: 'head', stats: { HP: 200 } }, slot: 'head' });
  assert.ok(storage.profiles.p.characterData.snapshot.invalidatedAt);
  await send({ type: 'UNDO_EQUIP', profileId: 'p' });
  assert.equal(storage.profiles.p.items[0].id, '1');
  assert.equal((await model.status(storage.profiles.p)).state, 'stale');
  // Recapture is explicit; switching server then invalidates the fresh capture.
  await send(await message('snapshot', { ...input, includesHeroics: 'yes' }));
  const changedServer = { ...clone(storage.profiles.p), server: 'Other server' };
  await send({ type: 'SAVE_PROFILES', profiles: { p: changedServer }, deletedIds: [] });
  assert.equal((await model.status(storage.profiles.p)).state, 'stale');
  const observationId = storage.profiles.p.characterData.observations[0].id;
  assert.equal((await send(await message('removeObservation', observationId))).ok, true);
  assert.equal(storage.profiles.p.characterData.observations.length, 2);
  assert.throws(() => model.aaRanks([{ name: 'Duplicate', rank: '1' }, { name: 'duplicate', rank: '2' }]));
  storage.profiles.p.characterData.version = 99;
  assert.equal((await model.status(storage.profiles.p)).state, 'unsupported');
  assert.equal((await send(await message('aa', []))).ok, false);
  console.log('character-data checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
