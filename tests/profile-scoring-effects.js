'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(file, 'utf8');
const core = { console }; core.window = core;
for (const file of ['slots', 'parser', 'diff']) vm.runInNewContext(read('content/shared/' + file + '.js'), core);
const LC = core.LootCaptain;
const choice = (key, version = 1) => ({ key, version });
const hpProfile = { id: 'hp', cls: 'Warrior', scoreFormula: choice('hp'), items: [
  { name: 'Old Helm', slot: 'Head', stats: { HP: 100, MANA: 100, AC: 10 } },
] };
const manaProfile = { ...hpProfile, id: 'mana', scoreFormula: choice('mana') };
const candidate = LC.parser.parseOpenDkpJson({ name: 'New Helm', slot: 'Head', hp: 150, mana: 50, ac: 10 });
assert.equal(LC.diff.resolveFormula(hpProfile, 'mana').key, 'hp');
assert.equal(LC.diff.resolveFormula({}, 'mana').key, 'mana');
assert.equal(LC.diff.resolveFormula({}, 'invalid').key, 'ac10hp');
const future = LC.diff.resolveFormula({ scoreFormula: choice('hp', 99) }, 'mana');
assert.equal(future.key, 'mana'); assert.match(future.warning, /hp v99/);
const multi = LC.diff.compareCandidateMulti([hpProfile, manaProfile], candidate, LC.diff.SCORE_FORMULAS[0]);
assert.equal(multi.mixedFormulas, true); assert.equal(multi.best, null);
assert.deepEqual(Array.from(multi.results, (entry) => entry.summary.score), [50, -50]);
const same = LC.diff.compareCandidateMulti([hpProfile, { ...hpProfile, id: 'hp2' }], candidate);
assert.equal(same.mixedFormulas, false); assert.ok(same.best);
assert.equal(LC.diff.compareItemPair(candidate, hpProfile.items[0], null, 125, manaProfile).score, -50);
assert.equal(LC.diff.compareItemPair(candidate, hpProfile.items[0], null, 125, hpProfile).score, 50);
assert.equal(LC.diff.compareCandidate({ ...manaProfile, items: [] }, candidate).rows[0].diff.score, 50);
assert.match(read('content/raidloot.js'), /const emptyDiff = comparison.rows\[0\].diff/);
const legacy = { ...hpProfile }; delete legacy.scoreFormula;
assert.equal(LC.diff.compareCandidate(legacy, candidate, LC.diff.SCORE_FORMULAS.find((entry) => entry.key === 'hp')).rows[0].diff.score, 50);

const effects = LC.parser.parseOpenDkpJson({ name: 'Effect Helm', slot: 'Head', hp: 150, effects: [
  { type: 'worn', name: 'Enduring Vigor', rank: 'II', raw: 'Enduring Vigor II' },
  { type: 'click', name: 'Gate', raw: 'Gate' },
  { type: 'aura', name: 'Strange Aura', raw: 'Unknown stacking' },
] });
assert.equal(effects.effectsKnown, true);
assert.deepEqual(Array.from(effects.effects, (effect) => effect.type), ['worn', 'click', 'unknown']);
assert.equal(effects.effects[2].kind, 'aura');
assert.equal(effects.effects[2].provenance, 'opendkp');
assert.equal(LC.parser.normalizeEffects(effects.effects)[2].kind, 'aura');
const absent = LC.parser.parseOpenDkpJson({ name: 'Empty', slot: 'Head' });
const empty = LC.parser.parseOpenDkpJson({ name: 'Empty', slot: 'Head', effects: [] });
assert.equal(LC.parser.parseOpenDkpJson({ metadata: { type: 'armor', name: 'Not an effect' } }).effects.length, 0);
assert.equal(absent.effectsKnown, false); assert.equal(empty.effectsKnown, true);
assert.equal(LC.parser.parseOpenDkpJson({ effects: [null] }).effectsKnown, false);
assert.equal(LC.diff.compareEffects({}, effects, absent).other.rows[0].status, 'unresolved');
assert.equal(LC.diff.compareEffects({}, effects, empty).other.rows[0].status, 'added');
assert.equal(LC.diff.compareEffects({}, empty, effects).other.rows[0].status, 'removed');
assert.equal(LC.diff.compareEffects({}, absent, effects).other.rows[0].status, 'unresolved');
const ranked = { ...effects, effects: effects.effects.map((effect) => ({ ...effect, rank: 'III' })) };
assert.equal(LC.diff.compareEffects({}, ranked, effects).other.rows[0].status, 'changed');
assert.ok(LC.diff.compareEffects({}, ranked, effects).other.rows.every((row) => row.direction === undefined));
assert.equal(LC.diff.compareItemPair(effects, { stats: { HP: 100 } }, null, 125, hpProfile).score, 50);

(async () => {
  let storage = { consentVersion: 1, profiles: { hp: structuredClone(hpProfile), mana: structuredClone(manaProfile) } };
  storage.profiles.hp.wishlist = [{ name: 'Keep wishlist' }];
  let listener; let failWrite = false;
  const worker = vm.createContext({ console, URL, TextEncoder,
    chrome: {
      runtime: { id: 'test', getURL: (value) => 'chrome-extension://test/' + value,
        onMessage: { addListener: (fn) => { listener = fn; } } },
      storage: { local: {
        get: async () => structuredClone(storage),
        set: async (values) => { if (failWrite) throw new Error('disk full'); Object.assign(storage, structuredClone(values)); },
      } },
    },
    importScripts: (...files) => files.forEach((file) => vm.runInContext(read(path.join('background', file)), worker)),
  });
  vm.runInContext(read('background/service-worker.js'), worker);
  const send = (message, url = 'chrome-extension://test/popup/popup.html') =>
    new Promise((resolve) => listener(message, { url }, resolve));
  const before = structuredClone(storage.profiles.hp);
  assert.equal((await send({ type: 'SET_PROFILE_FORMULA', profileId: 'hp', formula: choice('mana') })).ok, true);
  assert.equal(storage.profiles.hp.scoreFormula.key, 'mana');
  assert.deepEqual(storage.profiles.hp.items, before.items);
  assert.deepEqual(storage.profiles.hp.wishlist, before.wishlist);
  // An editor opened before the popup mutation must not restore its stale preference.
  assert.equal((await send({ type: 'SAVE_PROFILES', profiles: { hp: before }, deletedIds: [] })).ok, true);
  assert.equal(storage.profiles.hp.scoreFormula.key, 'mana');
  const snapshot = structuredClone(storage);
  failWrite = true;
  assert.equal((await send({ type: 'SET_PROFILE_FORMULA', profileId: 'hp', formula: choice('hp') })).ok, false);
  assert.deepEqual(storage, snapshot); failWrite = false;
  for (const message of [
    { type: 'SET_PROFILE_FORMULA', profileId: 'deleted', formula: choice('hp') },
    { type: 'SET_PROFILE_FORMULA', profileId: 'hp', formula: choice('hp', 99) },
  ]) assert.equal((await send(message)).ok, false);
  assert.equal((await send({ type: 'SET_PROFILE_FORMULA', profileId: 'hp', formula: choice('hp') }, 'https://guild.opendkp.com/')).ok, false);
  assert.deepEqual(storage, snapshot);

  // New effect types survive the worker trust boundary and a stored wishlist round trip.
  const normalized = worker.sanitizeWishlistItem({ ...effects, raidlootId: '123' });
  assert.deepEqual(Array.from(normalized.effects, (effect) => effect.type), ['worn', 'click', 'unknown']);
  assert.equal(normalized.effectsKnown, true);
  assert.equal(worker.sanitizeWishlistItem({ name: 'Missing', raidlootId: '123', effectsKnown: true }).effectsKnown, false);
  const equipped = worker.sanitizeProfileItem({ ...effects, id: '123' });
  assert.equal(equipped.effectsKnown, true); assert.equal(equipped.effects[2].provenance, 'opendkp');
  const cleared = worker.mergeWishlistItem(worker.sanitizeWishlistItem({ ...empty, raidlootId: '123' }), normalized);
  assert.equal(cleared.effects.length, 0); assert.equal(cleared.effectsKnown, true);
  const retained = worker.mergeWishlistItem(worker.sanitizeWishlistItem({ ...absent, raidlootId: '123' }), normalized);
  assert.equal(retained.effects.length, 3);
  assert.equal(worker.parserParseEffectLines('Worn: Enduring Vigor\nClick: Gate\nEffect: Strange Aura').length, 3);
  // Run the popup event handlers against the real mutation handler.
  const element = (tag = 'div') => ({
    tagName: tag.toUpperCase(), children: [], dataset: {}, listeners: {}, value: '', title: '',
    _text: '', classList: { toggle() {}, remove() {}, add() {} },
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; this._text = ''; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute() {}, querySelector() { return null; },
  });
  const controls = Object.fromEntries(['btn-options', 'compare-list', 'layout-select', 'formula-character',
    'formula-select', 'formula-status', 'status'].map((id) => ['#' + id, element()]));
  let initPopup;
  const popup = { console, document: {
    createElement: element, querySelector: (key) => controls[key],
    addEventListener: (event, callback) => { initPopup = callback; },
  }, chrome: {
    runtime: { sendMessage: send, openOptionsPage() {} },
    storage: { local: { get: async () => structuredClone(storage), set: async (values) => Object.assign(storage, values) },
      onChanged: { addListener() {} } },
  } }; popup.window = popup;
  storage.compareProfileIds = ['hp'];
  vm.runInNewContext(read('content/shared/diff.js') + '\n' + read('popup/popup.js'), popup);
  await initPopup();
  controls['#formula-character'].value = 'mana';
  await controls['#formula-character'].listeners.change({ target: controls['#formula-character'] });
  controls['#formula-select'].value = 'hp';
  await controls['#formula-select'].listeners.change({ target: controls['#formula-select'] });
  assert.equal(storage.profiles.mana.scoreFormula.key, 'hp');
  assert.equal(storage.profiles.hp.scoreFormula.key, 'mana');
  assert.deepEqual(storage.compareProfileIds, ['hp']);
  storage.profiles.mana.scoreFormula = choice('hp', 99);
  await popup.load();
  assert.match(controls['#formula-status'].textContent, /Unsupported character formula hp v99/);
  delete storage.profiles.mana;
  controls['#formula-select'].value = 'hp';
  await controls['#formula-select'].listeners.change({ target: controls['#formula-select'] });
  assert.match(controls['#formula-status'].textContent, /no longer exists/);
  assert.equal(storage.profiles.mana, undefined);

  core.document = { createElement: element, createTextNode: (text) => ({ textContent: text }) };
  vm.runInNewContext(read('content/shared/ui.js'), core);
  const badge = LC.ui.buildMultiComparisonBadges(multi, candidate, LC.diff.SCORE_FORMULAS[0], false)[0];
  assert.match(badge.textContent, /Different formulas/);
  assert.equal(badge.dataset.state, 'nomatch');
  const effectsDiff = LC.diff.compareItemPair(effects, empty, null, 125, hpProfile);
  const effectRow = { target: empty, diff: effectsDiff, slotKey: { key: 'head' } };
  const combined = LC.ui.buildComparisonBadges(effectRow, LC.diff.SCORE_FORMULAS[0], false);
  assert.equal(combined.filter(badge=>badge.dataset.lcView==='stats').length,1);
  assert.ok(combined.every(badge=>!badge.textContent.includes('other effects')));
  const effectOnly = { ...effectRow, diff: { ...effectsDiff, numericScoreAvailable:false, hasData:false } };
  assert.equal(LC.ui.buildComparisonBadges(effectOnly, LC.diff.SCORE_FORMULAS[0], false).filter(badge=>badge.dataset.lcView==='stats').length,1);
  const panel = LC.ui.buildComparePanel(effects, empty, effectsDiff, 'head');
  assert.match(panel.textContent, /informational; not scored/);
  assert.match(panel.textContent, /hp v1/);
  assert.match(panel.textContent, /Strange Aura|Unknown stacking/);
  const ownerButton = LC.ui.buildWishlistCompareButton(candidate, [
    { target: hpProfile.items[0], profile: hpProfile },
    { target: manaProfile.items[0], profile: manaProfile },
  ], null);
  assert.doesNotMatch(ownerButton.textContent, /↑|↓/);
  console.log('profile scoring and informational effects: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
