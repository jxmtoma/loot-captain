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
  console.log('Player damage integration checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
