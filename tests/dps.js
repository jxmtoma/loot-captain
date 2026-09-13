'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto').webcrypto;
const read = file => fs.readFileSync(file, 'utf8'), clone = value => JSON.parse(JSON.stringify(value));
(async () => {
  const worn = { id: '1', name: 'Old Claw', slot: 'primary', stats: { Damage: 100, Delay: 20 },
    effectsKnown: true, effects: [{ type: 'proc', key: 'proc:old', name: 'Old Proc' }] };
  const offhand = { id: '3', name: 'Offhand Claw', slot: 'secondary', stats: { Damage: 70, Delay: 20 }, effectsKnown: true, effects: [] };
  const candidate = { id: '2', name: 'New Claw', slot: 'primary', stats: { Damage: 120, Delay: 30 },
    effectsKnown: true, effects: [{ type: 'proc', key: 'proc:new', name: 'New Proc' }] };
  const profile = { id: 'p', cls: 'Beastlord', level: 100, items: [worn, offhand] };
  let handler;
  const storage = { consentVersion: 1, profiles: { p: profile } };
  const worker = vm.createContext({ console, TextEncoder, URL, URLSearchParams, crypto,
    chrome: { runtime: { id: 'test', getURL: x => 'chrome-extension://test/' + x, onMessage: { addListener: fn => handler = fn } },
      storage: { local: { get: async () => clone(storage), set: async values => Object.assign(storage, clone(values)) } } },
    importScripts: (...files) => files.forEach(file => vm.runInContext(read(path.join('background', file)), worker)),
  });
  vm.runInContext(read('background/service-worker.js'), worker);
  const assumptions = { hand: 'primary', layout: 'dual-wield', hastePercent: 100, hitChance: .8,
    mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 10, attacksPerRound: 1,
    procAssumptions: [{ key: 'proc:old', procsPerMinute: 2, damagePerProc: 300 },
      { key: 'proc:new', procsPerMinute: 2, damagePerProc: 600 }] };
  const dps = worker.LootCaptain.dps;
  const upgraded = dps.upgradeScenario({ ...dps.SCENARIO_DEFAULTS_V1, layout: 'dual-wield' });
  assert.equal(upgraded.version, 3); assert.equal(upgraded.revision, 0); assert.equal(upgraded.combat.attackCap, 610);
  const result = dps.project(profile, candidate, worn, assumptions);
  assert.equal(result.mode, 'dps');
  assert.deepEqual(Array.from(result.outputs, output => output.metric), ['Melee DPS', 'Proc DPS', 'Selected-hand subtotal']);
  assert.equal(result.outputs[0].current, 88);
  assert.equal(result.outputs[0].candidate, 69.33333333333333);
  assert.equal(result.outputs[1].current, 10);
  assert.equal(result.outputs[1].candidate, 20);
  assert.equal(result.outputs[2].current, 98);
  assert.equal(result.outputs[2].candidate, 89.33333333333333);
  assert.equal(result.outputs[0].delta, -18.66666666666667);
  assert.equal(result.spellFocus.available, false); assert.equal(result.pet.available, false);
  const same = dps.project(profile, worn, worn, { ...assumptions,
    procAssumptions: [{ key: 'proc:old', procsPerMinute: 2, damagePerProc: 300 }] });
  assert.equal(same.outputs[0].delta, 0); assert.equal(same.outputs[1].delta, 0); assert.equal(same.outputs[2].delta, 0);
  const secondaryCandidate = { id: '4', name: 'New Offhand', slot: 'secondary', stats: { Damage: 80, Delay: 25 }, effectsKnown: true, effects: [] };
  const secondary = dps.project(profile, secondaryCandidate, offhand, { ...assumptions, hand: 'secondary', procAssumptions: [] });
  assert.equal(secondary.outputs[0].available, true); assert.equal(secondary.outputs[1].current, 0);
  const nullMelee = dps.project(profile, candidate, worn, { ...assumptions, hitChance: null });
  assert.equal(nullMelee.outputs[0].available, false); assert.equal(nullMelee.outputs[1].available, true);
  const nullProc = dps.project(profile, candidate, worn, { ...assumptions, procAssumptions: null });
  assert.equal(nullProc.outputs[0].available, true); assert.equal(nullProc.outputs[1].available, false);
  const conflictWorn = { ...worn, effects: [{ type: 'proc', key: 'proc:same', rank: '1', raw: 'Shared rank 1' }] };
  const conflictCandidate = { ...candidate, effects: [{ type: 'proc', key: 'proc:same', rank: '2', raw: 'Shared rank 2' }] };
  const conflict = dps.project({ ...profile, items: [conflictWorn, offhand] }, conflictCandidate, conflictWorn,
    { ...assumptions, procAssumptions: [{ key: 'proc:same', procsPerMinute: 2, damagePerProc: 300 }] });
  assert.equal(conflict.outputs[0].available, true); assert.equal(conflict.outputs[1].available, false);
  const overflowItem = { ...worn, stats: { Damage: Number.MAX_VALUE, Delay: 20 } };
  const overflow = dps.project({ ...profile, items: [overflowItem, offhand] }, { ...candidate, stats: { Damage: Number.MAX_VALUE, Delay: 20 } }, overflowItem,
    { ...assumptions, damageMultiplier: Number.MAX_VALUE });
  assert.equal(overflow.outputs[0].available, false); assert.equal(overflow.outputs[1].available, true); assert.equal(overflow.outputs[2].available, false);
  const knownEmpty = { ...worn, effectsKnown: true, effects: [] };
  const emptyProfile = { ...profile, items: [knownEmpty, offhand] };
  const empty = dps.project(emptyProfile, { ...candidate, effectsKnown: true, effects: [] }, knownEmpty,
    { ...assumptions, procAssumptions: [] });
  assert.equal(empty.outputs[1].current, 0); assert.equal(empty.outputs[1].candidate, 0);
  const incompleteEmpty = dps.project(profile, { ...candidate, effectsKnown: false, effects: [] }, { ...worn, effectsKnown: false, effects: [] },
    { ...assumptions, procAssumptions: [] });
  assert.equal(incompleteEmpty.outputs[1].available, false);
  assert.equal(dps.project(profile, candidate, worn, { ...assumptions, hitChance: 2 }).outputs[0].available, false);
  assert.equal(dps.project(profile, candidate, worn, { ...assumptions, procAssumptions: [] }).outputs[1].available, false);
  assert.throws(() => dps.project(profile, { ...candidate, slot: 'secondary' }, worn, assumptions), /incompatible/);
  assert.throws(() => dps.project({ ...profile, cls: 'Wizard' }, candidate, worn, assumptions), /Beastlords/);

  const send = (msg, url = 'https://www.raidloot.com/items/2') => new Promise(resolve => handler(msg, { url }, resolve));
  const message = { type: 'GET_CHARACTER_PROJECTION', mode: 'dps', profileId: 'p', targetIndex: 0,
    expected: { id: '1', name: 'Old Claw', slot: 'primary' }, item: candidate, classes: ['BST'], requiredLevel: 100, assumptions,
    expectedEquipment: profile.items.map((item, index) => ({ index, id: item.id, name: item.name, slot: item.slot, isAugment: false })) };
  const storageBeforeRequests = clone(storage);
  const response = await send(message);
  assert.equal(response.ok, true); assert.equal(response.projection.outputs[2].candidate, 89.33333333333333);
  assert.equal((await send({ ...message, assumptions: { ...assumptions, hitChance: NaN } })).projection.outputs[0].available, false);
  assert.equal((await send({ ...message, expected: { ...message.expected, slot: 'secondary' } })).ok, false);
  assert.equal((await send({ ...message, classes: ['WIZ'] })).ok, false);
  assert.equal((await send({ ...message, item: { ...candidate, isAugment: true } })).ok, false);
  assert.equal((await send({ ...message, item: { ...candidate, effectsKnown: false } })).ok, true);
  assert.deepEqual(storage, storageBeforeRequests);
  const incomplete = dps.project(profile, { ...candidate, effectsKnown: false }, worn, assumptions);
  assert.equal(incomplete.outputs[0].available, true); assert.equal(incomplete.outputs[1].available, false);
  assert.equal(incomplete.outputs[2].available, false);
  const confirmed = dps.project({ ...profile, items: [{ ...worn, effectsKnown: false }, offhand] },
    { ...candidate, effectsKnown: false }, { ...worn, effectsKnown: false }, { ...assumptions, procListsConfirmed: true });
  assert.equal(confirmed.outputs[1].available, true);
  const identicalWeapons = { ...profile, items: [worn, { ...offhand, id: worn.id, name: worn.name }] };
  assert.equal(dps.project(identicalWeapons, candidate, worn, assumptions).outputs[0].available, true);
  assert.throws(() => dps.project({ ...profile, items: [worn] }, { ...candidate, slot: 'primary, secondary' }, worn,
    { ...assumptions, layout: 'two-hand' }), /only the primary/);

  const equippedAssumptions = { ...assumptions, scope: 'equipped-weapons',
    otherHand: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 0,
      attacksPerRound: .5, procAssumptions: [] } };
  const equippedMessage = { ...message, assumptions: equippedAssumptions,
    expectedWeapons: [{ index: 0, id: '1', name: 'Old Claw', slot: 'primary' },
      { index: 1, id: '3', name: 'Offhand Claw', slot: 'secondary' }] };
  const equippedResponse = await send(equippedMessage);
  assert.equal(equippedResponse.ok, true);
  assert.equal((await send({ ...equippedMessage, expectedWeapons: [{ id: '1', name: 'Old Claw', slot: 'primary' },
    { index: 1, id: '3', name: 'Offhand Claw', slot: 'secondary' }] })).ok, false);
  storage.profiles.p = { ...profile, items: [profile.items[0], { ...offhand, id: 'changed' }] };
  assert.equal((await send(equippedMessage)).ok, false);
  storage.profiles.p = { ...profile, items: [worn] };
  assert.equal((await send(equippedMessage)).ok, false);
  storage.profiles.p = { ...profile, items: profile.items };
  const equipped = dps.project(profile, candidate, worn, equippedAssumptions);
  assert.equal(equipped.rule.version, 2);
  assert.deepEqual(Array.from(equipped.outputs, output => output.metric), [
    'Primary melee DPS', 'Primary proc DPS', 'Primary subtotal',
    'Secondary melee DPS', 'Secondary proc DPS', 'Secondary subtotal',
    'Weapon melee DPS', 'Weapon proc DPS', 'Weapon subtotal',
  ]);
  assert.equal(equipped.outputs[0].current, 88);
  assert.equal(equipped.outputs[3].current, 28);
  assert.equal(equipped.outputs[6].current, 116);
  assert.equal(equipped.outputs[6].candidate, 97.33333333333333);
  assert.equal(equipped.outputs[7].current, 10);
  assert.equal(equipped.outputs[7].candidate, 20);
  assert.equal(equipped.outputs[8].current, 126);
  assert.equal(equipped.outputs[8].candidate, 117.33333333333333);
  assert.equal(equipped.outputs[3].hand, 'secondary');
  assert.equal(equipped.scope.singleHand, false);
  const dualSlotCandidate = { ...candidate, slot: 'primary, secondary' };
  assert.equal(dps.project(profile, dualSlotCandidate, worn, equippedAssumptions).outputs[0].available, true);
  const missingOther = dps.project(profile, candidate, worn, { ...equippedAssumptions, otherHand: undefined });
  assert.equal(missingOther.outputs[0].available, true);
  assert.equal(missingOther.outputs[3].available, false);
  assert.equal(missingOther.outputs[6].available, false);
  const secondaryEquippedCandidate = { ...offhand, id: '4', name: 'New Offhand', stats: { Damage: 80, Delay: 25 } };
  const secondaryEquipped = dps.project(profile, secondaryEquippedCandidate, offhand, { ...equippedAssumptions, hand: 'secondary',
    damageBonus: 0, attacksPerRound: .5,
    procAssumptions: [], otherHand: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2,
      damageBonus: 10, attacksPerRound: 1, procAssumptions: [{ key: 'proc:old', procsPerMinute: 2, damagePerProc: 300 }] } });
  assert.equal(secondaryEquipped.outputs[3].current, 28);
  assert.ok(Math.abs(secondaryEquipped.outputs[3].candidate - 25.6) < 1e-12);
  assert.equal(secondaryEquipped.outputs[0].current, 88);
  assert.ok(Math.abs(secondaryEquipped.outputs[6].candidate - 113.6) < 1e-12);
  assert.equal(secondaryEquipped.outputs[8].current, 126);
  assert.ok(Math.abs(secondaryEquipped.outputs[8].candidate - 123.6) < 1e-12);
  const sameProcKeys = dps.project({ ...profile, items: [
    { ...worn, effects: [{ type: 'proc', key: 'proc:shared' }] },
    { ...offhand, effects: [{ type: 'proc', key: 'proc:shared' }] },
  ] }, { ...candidate, effects: [{ type: 'proc', key: 'proc:shared' }] },
  { ...worn, effects: [{ type: 'proc', key: 'proc:shared' }] }, { ...equippedAssumptions,
    procAssumptions: [{ key: 'proc:shared', procsPerMinute: 2, damagePerProc: 300 }],
    otherHand: { ...equippedAssumptions.otherHand, procAssumptions: [{ key: 'proc:shared', procsPerMinute: 1, damagePerProc: 600 }] } });
  assert.equal(sameProcKeys.outputs[1].current, 10);
  assert.equal(sameProcKeys.outputs[4].current, 10);
  const twoHandProfile = { ...profile, items: [worn] };
  const twoHand = dps.project(twoHandProfile, candidate, worn, { ...equippedAssumptions, layout: 'two-hand' });
  assert.deepEqual(Array.from(twoHand.outputs, output => output.metric), [
    'Primary melee DPS', 'Primary proc DPS', 'Primary subtotal', 'Weapon melee DPS', 'Weapon proc DPS', 'Weapon subtotal',
  ]);
  assert.equal(twoHand.outputs[3].current, twoHand.outputs[0].current);
  assert.throws(() => dps.project(twoHandProfile, dualSlotCandidate, worn, { ...equippedAssumptions, layout: 'two-hand' }), /only the primary/);
  assert.throws(() => dps.project({ ...profile, items: [{ ...worn, slot: 'primary, secondary' }, offhand] }, candidate,
    { ...worn, slot: 'primary, secondary' }, equippedAssumptions), /actual weapon hand/);
  assert.throws(() => dps.project({ ...profile, items: [worn, offhand, { ...offhand, id: '5' }] }, candidate, worn, equippedAssumptions), /multiple items/);
  assert.throws(() => dps.project(profile, candidate, worn, { ...equippedAssumptions, scope: 'future' }), /unsupported/);
  const reference = dps.referenceProject(profile, candidate, worn);
  assert.equal(reference.mode, 'dps-reference');
  assert.equal(reference.scenarioDefault, true);
  assert.equal(reference.scenario.layout, 'dual-wield');
  assert.equal(reference.scenarioRevision, 0);
  assert.equal(reference.scenario.version, 3);
  assert.equal(reference.outputs.find((entry) => entry.metric === 'Melee stats DPS').current, 112.375);
  assert.equal(reference.outputs.find((entry) => entry.metric === 'Melee stats DPS').candidate, 94.29166666666666);
  assert.equal(reference.outputs.find((entry) => entry.metric === 'Weapon proc DPS').available, false);
  const rawWorn = { ...worn, stats: { DMG: { raw: '100', num: 100 }, Delay: { raw: '20', num: 20 } } };
  const rawOffhand = { ...offhand, stats: { DMG: { raw: '70', num: 70 }, Delay: { raw: '20', num: 20 } } };
  const rawCandidate = { ...candidate, stats: { DMG: { raw: '120', num: 120 }, Delay: { raw: '30', num: 30 } } };
  const rawProfile = { ...profile, items: [rawWorn, rawOffhand] };
  assert.equal(dps.referenceScenario(rawProfile).scenario.layout, 'dual-wield');
  assert.equal(dps.referenceProject(rawProfile, rawCandidate, rawWorn).outputs.find((entry) => entry.metric === 'Melee stats DPS').available, true);
  assert.equal(dps.project(rawProfile, rawCandidate, rawWorn, assumptions).outputs[0].available, true);
  const canonicalUnknown = dps.referenceProject({ ...profile, items: [{ ...worn, stats: { Damage: { raw: 'unknown' }, DMG: 100 } }, offhand] }, candidate,
    { ...worn, stats: { Damage: { raw: 'unknown' }, DMG: 100 } });
  assert.equal(canonicalUnknown.outputs[0].available, false);
  const noDefaultLayout = dps.referenceScenario({ ...profile, items: [worn] });
  assert.equal(noDefaultLayout.scenario.layout, null);
  const ambiguousLayout = dps.referenceScenario({ ...profile, items: [worn, offhand, { id: '5', name: 'Unknown Primary', slot: 'primary', stats: { AC: 1 } }] });
  assert.equal(ambiguousLayout.scenario.layout, null);
  const layoutNeeded = dps.referenceProject({ ...profile, items: [worn] }, candidate, worn);
  assert.equal(layoutNeeded.outputs[0].available, false);
  assert.equal(layoutNeeded.scenario.layout, null);
  const unsupported = dps.referenceProject({ ...profile, cls: 'Cleric' }, candidate, worn);
  assert.equal(unsupported.outputs[0].available, false);
  assert.equal(unsupported.scenario.layout, 'dual-wield');
  const malformed = dps.referenceProject(profile, candidate, worn, { ...reference.scenario, revision: NaN });
  assert.equal(malformed.outputs[0].available, false);
  assert.equal(malformed.scenario.layout, 'dual-wield');
  const nonweapon = dps.referenceProject(profile, { ...candidate, stats: { AC: 100 }, slot: 'chest' }, worn);
  assert.equal(nonweapon.outputs[0].available, false);
  const custom = { ...reference.scenario, revision: 0, primary: { ...reference.scenario.primary, damageBonus: 20 } };
  const scenarioV3 = { ...clone(dps.SCENARIO_DEFAULTS_V3), layout: 'dual-wield', spells: { ...clone(dps.SCENARIO_DEFAULTS_V3.spells) } };
  const wizardDefaults = dps.referenceScenario({ ...profile, cls: 'Wizard', level: 100 }).scenario;
  assert.equal(wizardDefaults.layout, null);
  assert.deepEqual(clone(wizardDefaults.spells), { model: 'wizard-hoarfrost', rank: 1, cycleSeconds: 12,
    landingMultiplier: 1, criticalChance: 0, criticalMultiplier: 2, manaPerSecond: 1000, meleeDuringCast: 0 });
  assert.equal(dps.validateScenario(wizardDefaults).spells.model, 'wizard-hoarfrost');
  assert.throws(() => dps.validateScenario({ ...wizardDefaults, spells: { ...wizardDefaults.spells, cycleSeconds: 8.99 } }), /cycleSeconds/);
  assert.throws(() => dps.validateScenario({ ...wizardDefaults, spells: { ...wizardDefaults.spells, model: 'magician' } }), /Unsupported spell model/);
  assert.throws(() => dps.project({ ...profile, cls: 'Wizard' }, candidate, worn, assumptions), /Beastlords only/);
  for (const [cls, model] of [['Berserker', 'berserker-base-melee'], ['Monk', 'monk-base-melee'], ['Rogue', 'rogue-base-melee']]) {
    const meleeDefaults = dps.referenceScenario({ ...profile, cls, level: 100 }).scenario;
    assert.equal(meleeDefaults.meleeModel, model); assert.equal(meleeDefaults.layout, 'dual-wield');
    assert.equal(dps.validateScenario(meleeDefaults).meleeModel, model);
  }
  assert.throws(() => dps.validateScenario({ ...scenarioV3, meleeModel: 'paladin-full' }), /Unsupported melee model/);
  for (const [key, value] of [['rank', 0], ['rank', 1.5], ['cycleSeconds', 31], ['criticalChance', 2], ['meleeDuringCast', 2], ['manaPerSecond', null], ['cycleSeconds', NaN]]) {
    const invalid = { ...scenarioV3, spells: { ...scenarioV3.spells, [key]: value } };
    assert.throws(() => dps.validateScenario(invalid), /Scenario spells\.|DPS scenario spell assumptions/);
  }
  assert.throws(() => dps.validateScenario({ ...scenarioV3, spells: { ...scenarioV3.spells, extra: 1 } }), /spell assumptions are required|unsupported fields/);
  const customV2 = { ...clone(dps.SCENARIO_DEFAULTS_V2), layout: 'dual-wield', revision: 17,
    combat: { ...clone(dps.SCENARIO_DEFAULTS_V2.combat), attackCap: 577 },
    procs: { ...clone(dps.SCENARIO_DEFAULTS_V2.procs), primaryPpm: 3 } };
  const validatedV2 = dps.validateScenario(customV2);
  assert.equal(validatedV2.version, 2); assert.equal(Object.prototype.hasOwnProperty.call(validatedV2, 'spells'), false);
  const upgradedV2 = dps.upgradeScenario(customV2);
  assert.equal(upgradedV2.version, 3); assert.equal(upgradedV2.revision, 17);
  assert.equal(upgradedV2.combat.attackCap, 577); assert.equal(upgradedV2.procs.primaryPpm, 3);
  const profileBeforeScenario = clone(storage.profiles.p);
  assert.throws(() => dps.validateScenario({ ...custom, primary: { ...custom.primary, hitChance: 2 } }), /between 0 and 1/);
  assert.throws(() => dps.validateScenario({ ...custom, secondary: { ...custom.secondary, mitigationMultiplier: 2 } }), /between 0 and 1/);
  const invalidSave = await send({ type: 'SET_DPS_SCENARIO', profileId: 'p', scenario: { ...custom, primary: { ...custom.primary, hitChance: 2 } }, expectedRevision: 0 });
  assert.equal(invalidSave.ok, false);
  const save = await send({ type: 'SET_DPS_SCENARIO', profileId: 'p', scenario: custom, expectedRevision: 0 });
  assert.equal(save.ok, true); assert.equal(save.scenario.revision, 1); assert.equal(storage.dpsScenariosByProfile.p.revision, 1);
  const staleSave = await send({ type: 'SET_DPS_SCENARIO', profileId: 'p', scenario: custom, expectedRevision: 0 });
  assert.equal(staleSave.ok, false);
  const savedReference = await send({ ...message, mode: 'dps-reference', expectedWeapons: equippedMessage.expectedWeapons });
  assert.equal(savedReference.ok, true); assert.equal(savedReference.projection.scenarioRevision, 1);
  assert.equal(savedReference.projection.scenario.primary.damageBonus, 20);
  const incompatibleReference = await send({ ...message, mode: 'dps-reference', item: { ...candidate, slot: 'chest', stats: { AC: 100 } }, expectedWeapons: equippedMessage.expectedWeapons });
  assert.equal(incompatibleReference.ok, false);
  assert.deepEqual(storage.profiles.p, profileBeforeScenario);
  storage.profiles.p2 = { ...profile, id: 'p2' };
  const saveOtherProfile = await send({ type: 'SET_DPS_SCENARIO', profileId: 'p2', scenario: reference.scenario, expectedRevision: 0 });
  assert.equal(saveOtherProfile.ok, true);
  assert.equal(storage.dpsScenariosByProfile.p2.revision, 1);
  const deleted = await send({ type: 'SAVE_PROFILES', profiles: {}, deletedIds: ['p'] });
  assert.equal(deleted.ok, true);
  assert.equal(storage.dpsScenariosByProfile.p, undefined);
  assert.equal(storage.dpsScenariosByProfile.p2.revision, 1);
  const robe = { id: '1001', name: 'Wizard Robe', slot: 'chest', stats: { 'Spell Dmg': 0 }, effectsKnown: true, effects: [] };
  storage.profiles.wizard = { id: 'wizard', cls: 'Wizard', level: 100, items: [robe] };
  const wizardRequest = { type: 'GET_CHARACTER_PROJECTION', mode: 'dps-reference', profileId: 'wizard', targetIndex: 0,
    expected: { id: robe.id, name: robe.name, slot: robe.slot }, expectedWeapons: [],
    expectedEquipment: [{ index: 0, id: robe.id, name: robe.name, slot: robe.slot, isAugment: false }],
    item: { ...robe, id: '1002', stats: { 'Spell Dmg': 70 } }, classes: ['WIZ'], requiredLevel: 100 };
  const wizardReference = await send(wizardRequest);
  assert.equal(wizardReference.ok, true, wizardReference.error);
  assert.equal(wizardReference.projection.outputs.find((entry) => entry.metric === 'Player DPS').delta, 7.5);
  const wizardSaved = await send({ type: 'SET_DPS_SCENARIO', profileId: 'wizard', expectedRevision: 0,
    scenario: { ...wizardReference.projection.scenario, spells: { ...wizardReference.projection.scenario.spells, rank: 3 } } });
  assert.equal(wizardSaved.ok, true);
  assert.equal(wizardSaved.scenario.revision, 1);
  const wizardReloaded = await send(wizardRequest);
  assert.equal(wizardReloaded.projection.scenarioDefault, false);
  assert.equal(wizardReloaded.projection.scenario.spells.rank, 3);
  assert.equal(wizardReloaded.projection.scenario.spells.model, 'wizard-hoarfrost');
  assert.equal(wizardReloaded.projection.scenarioRevision, 1);
  assert.equal((await send({ type: 'SET_DPS_SCENARIO', profileId: 'wizard', expectedRevision: 0, scenario: wizardSaved.scenario })).ok, false);
  console.log('DPS estimate checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
