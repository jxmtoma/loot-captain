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
const preset = (key) => LC.diff.SCORE_FORMULAS.find((formula) => formula.key === key);
assert.equal(JSON.stringify(preset('role-tank').terms), JSON.stringify({ HP: 1, AC: 4 }));
assert.equal(LC.diff.diffItems({ stats: { HP: 104, AC: 9 } }, { stats: { HP: 100, AC: 10 } }, preset('role-tank')).score, 0);
assert.equal(JSON.stringify(preset('role-melee').terms), JSON.stringify({ HP: 1, ATK: 5, HDex: 20 }));
assert.equal(JSON.stringify(preset('role-caster').terms), JSON.stringify({ MANA: 1, 'Spell Dmg': 10 }));
assert.equal(preset('role-melee').label, 'Melee stat preference');
assert.equal(preset('role-caster').label, 'Caster stat preference');
assert.equal(JSON.stringify(preset('role-healer').terms), JSON.stringify({ MANA: 1, 'Heal Amount': 10 }));
assert.equal(JSON.stringify(preset('role-raw').terms), '{}');
assert.equal(LC.diff.suggestedFormula({ cls: 'Beastlord' }).key, 'role-melee');
assert.equal(LC.diff.suggestedFormula({ cls: 'BST' }).key, 'role-melee');
assert.equal(LC.diff.suggestedFormula({ cls: 'Bard' }).key, 'role-raw');
const melee = preset('role-melee');
const meleeDiff = LC.diff.diffItems(
  { stats: { HP: 130, ATK: 40, HDex: 3 } },
  { stats: { HP: 100, ATK: 10, HDex: 2 } }, melee);
assert.equal(meleeDiff.score, 200);
assert.deepEqual(Array.from(meleeDiff.breakdown, (row) => [row.key, row.delta, row.weight, row.contribution]), [
  ['HP', 30, 1, 30],
  ['ATK', 30, 5, 150],
  ['HDex', 1, 20, 20],
]);
const incompleteMelee = LC.diff.diffItems({ stats: { HP: 130, ATK: 40 } }, { stats: { HP: 100, ATK: 10 } }, melee);
assert.equal(incompleteMelee.score, null);
assert.equal(incompleteMelee.breakdown.find((row) => row.key === 'ATK').contribution, 150);
assert.equal(incompleteMelee.breakdown.find((row) => row.key === 'HDex').contribution, null);
const negativeMelee = LC.diff.diffItems({ stats: { HP: 100, ATK: 0, HDex: 2 } }, { stats: { HP: 100, ATK: 10, HDex: 2 } }, melee);
assert.equal(negativeMelee.score, -50);
assert.equal(negativeMelee.breakdown.find((row) => row.key === 'ATK').contribution, -50);
for (const key of ['role-tank', 'role-melee', 'role-caster', 'role-healer', 'role-raw']) {
  assert.equal(LC.diff.resolveFormula({ scoreFormula: choice(key) }, 'hp').key, key);
}
const rawDiff = LC.diff.diffItems({ stats: { HP: 130 } }, { stats: { HP: 100 } }, preset('role-raw'));
assert.equal(rawDiff.score, null);
assert.equal(rawDiff.numericScoreAvailable, false);
const legacyFormula = preset('netpos');
assert.equal(LC.diff.wishlistComparisonDirection(
  { stats: { HP: 150 } }, [{ stats: { HP: 100 } }], legacyFormula), 0);
const neutralMulti = LC.diff.compareCandidateMulti([
  { id: 'legacy', cls: 'Warrior', items: [{ name: 'Old', slot: 'Head', stats: { HP: 100, AC: 10 } }] },
], { name: 'New', slot: 'Head', slotKey: LC.slots.canonicalSlot('Head'), stats: { HP: 150, AC: 20 } }, legacyFormula);
assert.equal(neutralMulti.best, null);
assert.equal(neutralMulti.results[0].summary.recommendationAvailable, false);
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
  for (const key of ['role-tank', 'role-melee', 'role-caster', 'role-healer', 'role-raw']) {
    assert.equal((await send({ type: 'SET_PROFILE_FORMULA', profileId: 'hp', formula: choice(key) })).ok, true);
    assert.equal(storage.profiles.hp.scoreFormula.key, key);
  }
  assert.equal((await send({ type: 'SET_PROFILE_FORMULA', profileId: 'hp', formula: choice('mana') })).ok, true);
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
    isConnected: true,
    attributes: {},
    _text: '', classList: { toggle() {}, remove() {}, add() {} },
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); },
    appendChild(child) { this.children.push(child); return child; },
    insertBefore(child, before) { const index = this.children.indexOf(before); if (index < 0) this.children.push(child); else this.children.splice(index, 0, child); return child; },
    replaceChildren(...children) { this.children = children; this._text = ''; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || null; },
    querySelector() { return null; },
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
  let dpsProjectionCalls = 0;
  LC.state = { getCharacterProjection: async () => {
    dpsProjectionCalls += 1;
    return { ok: true, projection: { outputs: [
      { metric: 'Weapon melee DPS', available: true, current: 88, candidate: 69.33, delta: -18.67 },
    ] } };
  } };
  const dpsWorn = { name: 'Worn Claw', slot: 'Primary', slotKey: { key: 'primary', keys: ['primary'] }, stats: { Damage: 100, Delay: 20, HP: 100, ATK: 10, HDex: 2 } };
  const dpsCandidate = { name: 'Candidate Claw', slot: 'Primary', slotKey: { key: 'primary', keys: ['primary'] }, stats: { Damage: 120, Delay: 30, HP: 100, ATK: 10, HDex: 2 } };
  const dpsProfile = { id: 'bst100', name: 'bst100', cls: 'Beastlord', level: 100, scoreFormula: choice('role-melee'), items: [dpsWorn] };
  const dpsDiff = LC.diff.diffItems(dpsCandidate, dpsWorn, melee);
  const dpsBadge = LC.ui.buildComparisonBadge({ target: dpsWorn, diff: dpsDiff, slotKey: dpsCandidate.slotKey }, melee, false, dpsCandidate, dpsProfile);
  assert.match(dpsBadge.textContent, /^P Stats /);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(dpsBadge.textContent, /Melee DPS est\. -18\.67/);
  assert.equal(dpsProjectionCalls, 1);
  const cachedBadge = LC.ui.buildComparisonBadge({ target: dpsWorn, diff: dpsDiff, slotKey: dpsCandidate.slotKey }, melee, false, dpsCandidate, dpsProfile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(cachedBadge.textContent, /Melee DPS est\. -18\.67/);
  assert.equal(dpsProjectionCalls, 1);
  const perCharacter = LC.ui.buildPerCharacterBadges({ results: [{ profile: dpsProfile, empty: false,
    summary: { comparable: true, numericScoreAvailable: true, score: dpsDiff.score }, comparison: {
      rows: [{ target: dpsWorn, diff: dpsDiff, slotKey: { key: 'primary' } }],
    } }] }, dpsCandidate, melee, false)[0];
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(perCharacter.textContent, /bst100 P Stats .*Melee DPS est\. -18\.67/);
  const casterBadge = LC.ui.buildComparisonBadge({ target: dpsWorn, diff: dpsDiff, slotKey: dpsCandidate.slotKey }, preset('role-caster'), false, dpsCandidate, { ...dpsProfile, scoreFormula: choice('role-caster') });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(casterBadge.textContent, /Melee DPS est/);
  assert.match(casterBadge.title, /Includes known melee stats/);
  const badge = LC.ui.buildMultiComparisonBadges(multi, candidate, LC.diff.SCORE_FORMULAS[0], false)[0];
  assert.equal(badge.textContent, 'Compare');
  assert.equal(badge.tagName, 'BUTTON');
  assert.equal(badge.type, 'button');
  assert.equal(badge.dataset.state, 'nomatch');
  assert.match(badge.title, /different formulas/);
  const effectsDiff = LC.diff.compareItemPair(effects, empty, null, 125, hpProfile);
  const effectRow = { target: empty, diff: effectsDiff, slotKey: { key: 'head' } };
  const combined = LC.ui.buildComparisonBadges(effectRow, LC.diff.SCORE_FORMULAS[0], false);
  assert.equal(combined.filter(badge=>badge.dataset.lcView==='stats').length,1);
  assert.ok(combined.every(badge=>!badge.textContent.includes('other effects')));
  const effectOnly = { ...effectRow, diff: { ...effectsDiff, numericScoreAvailable:false, hasData:false } };
  assert.equal(LC.ui.buildComparisonBadges(effectOnly, LC.diff.SCORE_FORMULAS[0], false).filter(badge=>badge.dataset.lcView==='stats').length,1);
  const procOnlyCandidate = LC.parser.parseOpenDkpJson({ name: 'Proc only', slot: 'Primary', effects: [{ type: 'proc', name: 'Fire Strike', raw: 'Fire Strike' }] });
  const procOnlyWorn = LC.parser.parseOpenDkpJson({ name: 'Old proc', slot: 'Primary', effects: [] });
  const procOnlyDiff = LC.diff.compareItemPair(procOnlyCandidate, procOnlyWorn, null, 100, { items: [procOnlyWorn] });
  const procOnlyBadges = LC.ui.buildComparisonBadges({ target: procOnlyWorn, diff: procOnlyDiff, slotKey: { key: 'primary' } }, preset('role-melee'), false);
  assert.equal(procOnlyBadges.length, 1);
  assert.equal(procOnlyBadges[0].textContent, 'Compare primary');
  assert.equal(procOnlyBadges[0].tagName, 'BUTTON');
  const focusOnlyCandidate = LC.parser.parseOpenDkpJson({ name: 'Focus only', slot: 'Head', effects: [{ type: 'focus', name: 'Ferocity 10 L100', raw: 'Ferocity 10 L100' }] });
  const focusOnlyWorn = LC.parser.parseOpenDkpJson({ name: 'Old focus', slot: 'Head', effects: [] });
  const focusOnlyDiff = LC.diff.compareItemPair(focusOnlyCandidate, focusOnlyWorn, null, 100, { items: [focusOnlyWorn] });
  const focusOnlyBadges = LC.ui.buildComparisonBadges({ target: focusOnlyWorn, diff: focusOnlyDiff, slotKey: { key: 'head' } }, preset('role-melee'), false);
  assert.equal(focusOnlyBadges.length, 1);
  assert.equal(focusOnlyBadges[0].textContent, 'Compare');
  assert.equal(focusOnlyBadges[0].tagName, 'BUTTON');
  assert.match(LC.ui.buildComparePanel(procOnlyCandidate, procOnlyWorn, procOnlyDiff, 'primary').textContent, /Effects.*Proc/);
  assert.match(LC.ui.buildComparePanel(focusOnlyCandidate, focusOnlyWorn, focusOnlyDiff, 'head').textContent, /Effects.*Spell focus/);
  const panel = LC.ui.buildComparePanel(effects, empty, effectsDiff, 'head');
  assert.match(panel.textContent, /head: Empty → Effect Helm/);
  assert.match(panel.textContent, /All item stats/);
  assert.match(panel.textContent, /Effects/);
  assert.match(panel.textContent, /informational; not scored/);
  assert.match(panel.textContent, /hp v1/);
  assert.match(panel.textContent, /Strange Aura|Unknown stacking/);
  const rawPanel = LC.ui.buildComparePanel({ name: 'Raw candidate', stats: { HP: 150 } },
    { name: 'Raw worn', stats: { HP: 100 } }, rawDiff, 'head');
  assert.match(rawPanel.textContent, /no aggregate score/);
  const breakdownPanel = LC.ui.buildComparePanel({ name: 'Melee candidate', stats: { HP: 130, ATK: 40, HDex: 3 } },
    { name: 'Melee worn', stats: { HP: 100, ATK: 10, HDex: 2 } }, meleeDiff, 'head');
  assert.match(breakdownPanel.textContent, /Preference score \(not DPS\)/);
  assert.match(breakdownPanel.textContent, /Melee stat preference.*role-melee v1/);
  assert.match(breakdownPanel.textContent, /ATK.*150/);
  const weaponWorn = { name: 'Fearbrand', slot: 'Primary', slotKey: { key: 'primary', keys: ['primary'] }, stats: { Damage: 116, Delay: 18, HP: 100, ATK: 10, HDex: 2 } };
  const weaponCandidate = { name: 'Tolvak', slot: 'Primary', slotKey: { key: 'primary', keys: ['primary'] }, stats: { Damage: 110, Delay: 19, HP: 115, ATK: 10, HDex: 3 } };
  const weaponDiff = LC.diff.diffItems(weaponCandidate, weaponWorn, melee);
  assert.equal(weaponDiff.score, 35);
  const weaponRow = { target: weaponWorn, diff: weaponDiff, slotKey: weaponCandidate.slotKey };
  const weaponBadge = LC.ui.buildComparisonBadges(weaponRow, melee, false)[0];
  assert.equal(weaponBadge.textContent, 'P Stats +35');
  assert.equal(weaponBadge.dataset.state, 'upgrade');
  assert.match(weaponBadge.title, /Higher stat preference score; not a DPS estimate/);
  assert.match(weaponBadge.getAttribute('aria-label'), /Higher stat preference score/);
  assert.equal(weaponBadge.tagName, 'BUTTON');
  const weaponPanel = LC.ui.buildComparePanel(weaponCandidate, weaponWorn, weaponDiff, 'primary');
  assert.match(weaponPanel.textContent, /Stats \+35/);
  assert.match(weaponPanel.textContent, /Preference score \(not DPS\)/);
  const ownerButton = LC.ui.buildWishlistCompareButton(candidate, [
    { target: hpProfile.items[0], profile: hpProfile },
    { target: manaProfile.items[0], profile: manaProfile },
  ], null);
  assert.doesNotMatch(ownerButton.textContent, /↑|↓/);
  const mixedOwnerButton = LC.ui.buildWishlistCompareButton(candidate, [
    { target: { ...hpProfile.items[0], stats: { HP: 100, MANA: 100 } }, profile: { ...hpProfile, scoreFormula: choice('hp') } },
    { target: { ...hpProfile.items[0], stats: { HP: 100, MANA: 100 } }, profile: { ...hpProfile, scoreFormula: choice('mana') } },
  ], null);
  assert.equal(mixedOwnerButton.dataset.state, 'nomatch');
  assert.doesNotMatch(mixedOwnerButton.textContent, /↑|↓/);
  const positiveMixedButton = LC.ui.buildWishlistCompareButton(
    { name: 'Positive candidate', stats: { HP: 150, MANA: 150 } }, [
      { target: { name: 'HP target', stats: { HP: 100, MANA: 100 } }, profile: { ...hpProfile, scoreFormula: choice('hp') } },
      { target: { name: 'Mana target', stats: { HP: 100, MANA: 100 } }, profile: { ...manaProfile, scoreFormula: choice('mana') } },
    ], null);
  assert.equal(positiveMixedButton.dataset.state, 'nomatch');
  assert.doesNotMatch(positiveMixedButton.textContent, /↑|↓/);
  const unsupportedButton = LC.ui.buildWishlistCompareButton(
    { name: 'Unsupported candidate', stats: { HP: 150, AC: 2 } }, [
      { target: { name: 'Supported target', stats: { HP: 100, AC: 1 } }, profile: { ...hpProfile, scoreFormula: choice('hp', 99) } },
    ], null);
  assert.equal(unsupportedButton.dataset.state, 'nomatch');
  assert.doesNotMatch(unsupportedButton.textContent, /↑|↓/);

  const verdictRow = (score, extra = {}) => ({ target: weaponWorn, slotKey: weaponCandidate.slotKey,
    diff: { numericScoreAvailable: true, score, formula: melee, comparable: true, hasData: true, ...extra } });
  assert.equal(LC.ui.buildComparisonBadge(verdictRow(1), melee, false).dataset.state, 'upgrade');
  assert.equal(LC.ui.buildComparisonBadge(verdictRow(-1), melee, false).dataset.state, 'downgrade');
  assert.equal(LC.ui.buildComparisonBadge(verdictRow(0), melee, false).dataset.state, 'sidegrade');
  for (const score of [NaN, Infinity, -Infinity]) {
    const unknown = LC.ui.buildComparisonBadge(verdictRow(score), melee, false);
    assert.equal(unknown.dataset.state, 'nomatch');
    assert.match(unknown.title, /score is unavailable/);
  }
  assert.equal(LC.ui.buildComparisonBadge(verdictRow(1, { numericScoreAvailable: false }), melee, false).dataset.state, 'nomatch');
  assert.equal(LC.ui.buildComparisonBadge(verdictRow(1, { formula: preset('role-raw') }), preset('role-raw'), false).dataset.state, 'nomatch');
  assert.equal(LC.ui.buildComparisonBadge(verdictRow(1, { formula: { ...melee, warning: 'unsupported' } }), melee, false).dataset.state, 'nomatch');

  const mixedRows = {
    results: [{ profile: hpProfile, empty: false, summary: { numericScoreAvailable: false, recommendationAvailable: true, score: null }, comparison: {
      rows: [verdictRow(1), verdictRow(null, { numericScoreAvailable: false })],
    } }],
    mixedFormulas: false,
  };
  assert.equal(LC.ui.buildMultiComparisonBadges(mixedRows, candidate, melee, false)[0].dataset.state, 'nomatch');
  const uiSource = read('content/shared/ui.js');
  assert.match(uiSource, /\.lc-badge\{[^}]*background:#16212b/);
  assert.match(uiSource, /\.lc-dps-metric\[data-state="upgrade"\][^}]*color:#86d99a/);
  assert.match(uiSource, /\.lc-dps-metric\[data-state="downgrade"\][^}]*color:#ffaaa0/);
  assert.doesNotMatch(uiSource, /\.lc-(?:badge|wishlist-compare|compare-chip)\[data-state="(?:upgrade|downgrade|sidegrade)"\]\{background:linear-gradient/);
  console.log('profile scoring and informational effects: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
