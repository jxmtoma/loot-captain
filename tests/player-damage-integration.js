'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

const read = (file) => fs.readFileSync(file, 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  const profile = { id: 'p', cls: 'Beastlord', level: 100, items: [
    { id: '101', name: 'Primary', slot: 'primary', stats: { Damage: 100, Delay: 20, ATK: 100 }, effectsKnown: true, effects: [] },
    { id: '102', name: 'Secondary', slot: 'secondary', stats: { Damage: 70, Delay: 20 }, effectsKnown: true, effects: [] },
    { id: '103', name: 'Old Helm', slot: 'head', stats: { STR: 10, DEX: 10 }, effectsKnown: true, effects: [] },
  ] };
  const candidate = { id: '104', name: 'New Helm', slot: 'head', stats: { STR: 30, DEX: 20 }, effectsKnown: true, effects: [] };
  const scenario = {
    version: 2, revision: 0, layout: 'dual-wield', hastePercent: 100,
    primary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 10, attacksPerRound: 1 },
    secondary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 0, attacksPerRound: .5 },
    combat: { baseStrength: 100, baseDexterity: 100, strengthCap: 730, dexterityCap: 730, offenseBase: 400, attackScale: 1,
      attackCap: 610, targetMitigation: 1000, criticalDifficulty: 8900, otherCriticalBonusPct: 100,
      criticalDamageMultiplier: 2, doubleAttackSkill: 0, grantedDoubleAttackPct: 30, otherDoubleAttackBonusPct: 0 },
    procs: { primaryPpm: 2, secondaryPpm: 1, landingMultiplier: 1 },
  };
  const scenarioV3 = { ...scenario, version: 3, spells: { rank: 1, cycleSeconds: 32, landingMultiplier: 1,
    criticalChance: 0, criticalMultiplier: 2, manaPerSecond: 100, meleeDuringCast: 0 } };
  let handler;
  const storage = { consentVersion: 1, profiles: { p: clone(profile) }, dpsScenariosByProfile: { p: scenario } };
  const worker = vm.createContext({ console, TextEncoder, URL, URLSearchParams, crypto,
    chrome: { runtime: { id: 'test', getURL: (value) => 'chrome-extension://test/' + value,
      onMessage: { addListener: (fn) => { handler = fn; } } },
      storage: { local: { get: async () => clone(storage), set: async (values) => Object.assign(storage, clone(values)) } } },
    importScripts: (...files) => files.forEach((file) => vm.runInContext(read(path.join('background', file)), worker)),
  });
  vm.runInContext(read('background/service-worker.js'), worker);
  const expectedEquipment = profile.items.map((item, index) => ({ index, id: item.id, name: item.name, slot: item.slot, isAugment: false }));
  const send = (extra = {}) => new Promise((resolve) => handler({ type: 'GET_CHARACTER_PROJECTION', mode: 'dps-reference', profileId: 'p', targetIndex: 2,
    expected: { id: '103', name: 'Old Helm', slot: 'head' }, item: candidate, classes: ['BST'], requiredLevel: 100,
    expectedWeapons: [{ index: 0, id: '101', name: 'Primary', slot: 'primary' }, { index: 1, id: '102', name: 'Secondary', slot: 'secondary' }],
    expectedEquipment, ...extra }, { url: 'https://www.raidloot.com/items/new-helm' }, resolve));
  const sendWorker = (message) => new Promise((resolve) => handler(message, { url: 'chrome-extension://test/options/options.html' }, resolve));
  const first = await send();
  assert.equal(first.ok, true);
  assert.equal(storage.dpsScenariosByProfile.p.version, 2, 'saved v2 scenario stays v2 until explicit save');
  assert.equal(first.projection.upgradeScenario.version, 3, 'backend exposes latest v3 upgrade draft');
  const stats = first.projection.outputs.find((output) => output.metric === 'Melee stats DPS');
  assert.equal(stats.available, true);
  assert.ok(stats.delta > 0);
  assert.ok(first.projection.comparisonBinding, 'reference response must provide a comparison binding');
  const confirmed = await send({ confirmation: { effectsComplete: true, weaponProcsComplete: true, spellFocusComplete: true, binding: first.projection.comparisonBinding } });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.projection.outputs.find((output) => output.metric === 'Melee DPS').available, true);
  const proc = confirmed.projection.outputs.find((output) => output.metric === 'Weapon proc DPS');
  assert.equal(proc.available, true);
  const savedV3 = await sendWorker({ type: 'SET_DPS_SCENARIO', profileId: 'p', scenario: scenarioV3, expectedRevision: 0 });
  assert.equal(savedV3.ok, true);
  assert.equal(savedV3.scenario.version, 3);
  assert.equal(savedV3.scenario.revision, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(savedV3.scenario, 'confirmation'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(storage.dpsScenariosByProfile.p, 'confirmation'), false);
  const savedStorage = clone(storage);
  const v3 = await send();
  const spell = v3.projection.outputs.find((output) => output.metric === 'Spell DPS');
  const player = v3.projection.outputs.find((output) => output.metric === 'Player DPS');
  assert.equal(spell.available, true);
  assert.equal(player.available, true);
  assert.ok(Array.isArray(player.includedComponents));
  assert.ok(Array.isArray(player.excludedComponents));
  assert.equal(player.partial, false);
  storage.profiles.p.items[2] = { ...storage.profiles.p.items[2], effectsKnown: true, effects: [{ type: 'worn', key: 'effect:changed', name: 'Changed Effect' }] };
  assert.equal((await send({ confirmation: { effectsComplete: true, weaponProcsComplete: true, binding: first.projection.comparisonBinding } })).ok, false);
  storage.profiles.p = clone(profile);
  storage.profiles.p.items[2] = { ...storage.profiles.p.items[2], effectsKnown: false };
  assert.equal((await send({ confirmation: { effectsComplete: true, weaponProcsComplete: true, binding: first.projection.comparisonBinding } })).ok, false);
  storage.profiles.p = clone(profile);
  assert.equal((await send({ item: { ...candidate, stats: { STR: 31, DEX: 20 } }, confirmation: { spellFocusComplete: true, binding: v3.projection.comparisonBinding } })).ok, false);
  storage.dpsScenariosByProfile.p = { ...scenarioV3, spells: { ...scenarioV3.spells, cycleSeconds: 33 } };
  assert.equal((await send({ confirmation: { spellFocusComplete: true, binding: v3.projection.comparisonBinding } })).ok, false);
  storage.dpsScenariosByProfile.p = clone(savedV3.scenario);
  storage.profiles.p = clone(profile);
  storage.profiles.p.items = storage.profiles.p.items.map((item) => ({ ...item, effectsKnown: false }));
  const incomplete = await send();
  const focusOnly = await send({ confirmation: { spellFocusComplete: true, binding: incomplete.projection.comparisonBinding } });
  assert.equal(focusOnly.ok, true, 'focus-only confirmation accepts the fresh binding');
  assert.equal(focusOnly.projection.outputs.find((output) => output.metric === 'Melee DPS').available, false);
  assert.equal(focusOnly.projection.outputs.find((output) => output.metric === 'Weapon proc DPS').available, false);
  assert.equal(focusOnly.projection.outputs.find((output) => output.metric === 'Spell stats DPS').available, true);
  storage.profiles.p = clone(profile);
  storage.profiles.p.items[2] = { ...storage.profiles.p.items[2], effects: [{ type: 'focus', key: 'unknown-focus', name: 'Unknown Focus' }] };
  const unknownFocus = await send();
  const unknownConfirmed = await send({ confirmation: { effectsComplete: true, weaponProcsComplete: true, spellFocusComplete: true, binding: unknownFocus.projection.comparisonBinding } });
  assert.equal(unknownConfirmed.ok, true);
  assert.equal(unknownConfirmed.projection.outputs.find((output) => output.metric === 'Spell DPS').available, false);
  assert.equal(unknownConfirmed.projection.outputs.find((output) => output.metric === 'Spell stats DPS').available, true);
  storage.profiles.p = clone(profile);
  assert.equal((await send({ expectedEquipment: expectedEquipment.map((entry) => entry.index === 0 ? { ...entry, id: 'changed' } : entry) })).ok, false);
  assert.deepEqual(storage, savedStorage);
  storage.profiles.p.cls = 'Warrior';
  const tankRequest = { mode: 'tank-reference', classes: ['WAR'], item: { ...candidate, stats: { HP: 100, AC: 100 } } };
  const tank = await send(tankRequest);
  assert.equal(tank.ok, true);
  assert.equal(tank.projection.scenarioDefault, true);
  assert.equal(storage.tankScenariosByProfile, undefined, 'reading defaults does not save a tank scenario');
  assert.ok(tank.projection.outputs.find((row) => row.metric === 'Survival seconds').delta > 0);
  const tankSave = { type: 'SET_TANK_SCENARIO', profileId: 'p', scenario: { ...tank.projection.scenario, landingChance: .6 }, expectedRevision: 0 };
  const tankSaved = await sendWorker(tankSave);
  assert.equal(tankSaved.ok, true);
  assert.equal(tankSaved.scenario.revision, 1);
  assert.equal((await sendWorker(tankSave)).ok, false, 'stale scenario saves are rejected');
  const tankReloaded = await send(tankRequest);
  assert.equal(tankReloaded.projection.scenario.landingChance, .6);
  assert.equal(tankReloaded.projection.scenarioDefault, false);
  assert.deepEqual(storage.dpsScenariosByProfile, savedStorage.dpsScenariosByProfile);
  assert.equal((await send({ ...tankRequest, expectedEquipment: [] })).ok, false);
  assert.equal((await sendWorker({ ...tankSave, expectedRevision: 1, scenario: { ...tankSaved.scenario, landingChance: 0 } })).ok, false);
  const blockedTankSave = await new Promise((resolve) => handler(tankSave, { url: 'https://example.com/' }, resolve));
  assert.equal(blockedTankSave.ok, false);
  for (const [cls, model] of [['CLR', 'cleric'], ['DRU', 'druid'], ['SHM', 'shaman']]) for (const n of [1, 2]) {
    const id = cls + n;
    storage.profiles[id] = { ...clone(profile), id, cls };
    const request = { mode: 'healer-reference', profileId: id, classes: [cls], item: { ...candidate, stats: { 'Heal Amount': 100, MANA: 1000 } } };
    const firstHeal = await send(request);
    assert.equal(firstHeal.ok, true);
    assert.equal(firstHeal.projection.scenarioDefault, true);
    assert.equal(firstHeal.projection.scenario.spellModel, model);
    assert.ok(firstHeal.projection.outputs.find((row) => row.metric === 'Encounter HPS').delta > 0);
    const save = { type: 'SET_HEALER_SCENARIO', profileId: id, expectedRevision: 0,
      scenario: { ...firstHeal.projection.scenario, baseManaPerSecond: n * 10 } };
    assert.equal((await sendWorker(save)).ok, true);
    assert.equal((await sendWorker(save)).ok, false, 'stale healer save rejected');
    const reloaded = await send(request);
    assert.equal(reloaded.projection.scenario.baseManaPerSecond, n * 10);
    assert.equal(reloaded.projection.scenarioDefault, false);
    assert.equal((await send({ ...request, expectedEquipment: [] })).ok, false);
    assert.equal((await sendWorker({ ...save, expectedRevision: 1, scenario: { ...reloaded.projection.scenario, spellModel: model === 'cleric' ? 'druid' : 'cleric' } })).ok, false);
  }
  assert.equal(storage.healerScenariosByProfile.CLR1.baseManaPerSecond, 10);
  assert.equal(storage.healerScenariosByProfile.CLR2.baseManaPerSecond, 20);
  assert.equal(storage.tankScenariosByProfile.p.landingChance, .6);
  assert.deepEqual(storage.dpsScenariosByProfile, savedStorage.dpsScenariosByProfile);
  await vm.runInContext("saveProfiles({}, ['CLR1'])", worker);
  assert.equal(storage.healerScenariosByProfile.CLR1, undefined);
  assert.equal(storage.healerScenariosByProfile.CLR2.baseManaPerSecond, 20);
  await vm.runInContext("saveProfiles({}, ['p'])", worker);
  assert.equal(storage.tankScenariosByProfile.p, undefined);
  assert.equal(storage.dpsScenariosByProfile.p, undefined);
  for (const [cls, mode] of [['WAR', 'tank-reference'], ['SHD', 'tank-reference'], ['PAL', 'tank-reference'],
    ['CLR', 'healer-reference'], ['DRU', 'healer-reference'], ['SHM', 'healer-reference'],
    ...['BST', 'BER', 'MNK', 'ROG', 'WIZ', 'MAG', 'ENC', 'NEC'].map((cls) => [cls, 'dps-reference'])]) {
    const id = 'faycite-' + cls;
    const ordinary = { id: 'ordinary', name: 'Ordinary augment', slot: 'head', isAugment: true,
      stats: { HP: 100, AC: 10, 'Spell Dmg': 50, 'Heal Amount': 50 }, effectsKnown: true, effects: [] };
    const base = { ...clone(profile), id, cls, items: [...clone(profile.items), ordinary] };
    storage.profiles[id] = base;
    const equipment = () => storage.profiles[id].items.map((item, index) => ({ index, id: item.id, name: item.name, slot: item.slot, isAugment: !!item.isAugment }));
    const request = () => send({ profileId: id, mode, classes: [cls], expectedEquipment: equipment() });
    const before = await request();
    assert.equal(before.ok, true);
    const shards = [
      { id: 'faycite-empty', name: 'Irae Faycite Shard: Example', slot: 'ear', isAugment: true, stats: {}, effectsKnown: false, effects: [] },
      { id: 'faycite-effect', name: 'SALUS FAYCITE SHARD: Example', slot: 'head', isAugment: true,
        stats: { HP: 90000, AC: 9000, 'Heal Amount': 9000, 'Spell Dmg': 9000 }, effectsKnown: true,
        effects: [{ type: 'focus', name: 'Unknown focus that would block spell estimates' }] },
    ];
    storage.profiles[id] = { ...base, items: [...base.items, ...shards] };
    const original = clone(storage.profiles[id]);
    const after = await request();
    assert.equal(after.ok, true);
    assert.deepEqual(after.projection.outputs, before.projection.outputs, cls + ' ignores both Faycite stats and effects');
    assert.ok(after.projection.assumptions.some((text) => text.includes('Faycite augments are excluded')));
    assert.deepEqual(storage.profiles[id], original, 'Estimates never delete imported augments');
    const filtered = vm.runInContext('profileForEstimate(' + JSON.stringify(original) + ', "test")', worker);
    assert.ok(filtered.items.some((item) => item.id === 'ordinary'));
    assert.equal(filtered.items.length, base.items.length);
  }
  console.log('Player damage integration checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
