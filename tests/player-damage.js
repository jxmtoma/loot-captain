'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = (file) => fs.readFileSync(file, 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));
const slot = (value) => {
  const keys = String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
  return keys.length === 1 ? { key: keys[0] } : { key: keys[0], keys };
};
const context = { console, parserCanonicalSlot: slot, LootCaptain: {} };
vm.runInNewContext(read('content/shared/dps.js'), context, { filename: 'content/shared/dps.js' });
vm.runInNewContext(read('content/shared/damage-catalog.js'), context, { filename: 'content/shared/damage-catalog.js' });
vm.runInNewContext(read('content/shared/player-damage.js'), context, { filename: 'content/shared/player-damage.js' });
const dps = context.LootCaptain.dps, model = context.LootCaptain.playerDamage;
const worn = (name) => ({ type: 'worn', name, raw: name });
const proc = (name) => ({ type: 'proc', name, raw: name });
const weapon = (id, slotName, damage = 100, delay = 20, effects = []) => ({ id, name: id, slot: slotName,
  stats: { Damage: damage, Delay: delay }, effectsKnown: true, effects });
const armor = (id, stats = {}, effects = []) => ({ id, name: id, slot: 'chest', stats, effectsKnown: true, effects });
const baseScenario = () => ({ ...clone(dps.SCENARIO_DEFAULTS_V2), layout: 'dual-wield' });
const profileWith = (primary, gear = armor('old', { ATK: 10, STR: 10, DEX: 10 })) => ({ id: 'p', cls: 'Beastlord', level: 100,
  items: [primary, weapon('secondary', 'secondary', 70), gear] });
const output = (result, metric) => result.outputs.find((entry) => entry.metric === metric);
const projectGear = (oldGear, newGear, scenario = baseScenario(), primary = weapon('primary', 'primary')) => {
  const profile = profileWith(primary, oldGear);
  return model.project(profile, newGear, oldGear, scenario);
};

const ferocity = projectGear(armor('old', {}, [worn('Ferocity III')]), armor('new', {}, [worn('Ferocity IV')]));
assert.ok(Math.abs(output(ferocity, 'Melee DPS').candidate / output(ferocity, 'Melee DPS').current - 1.42 / 1.39) < 1e-12);
const cleaveGain = projectGear(armor('old', {}, [worn('Cleave III')]), armor('new', {}, [worn('Cleave IV')]));
assert.ok(output(cleaveGain, 'Melee DPS').delta > 0);
const coveredProfile = profileWith(weapon('primary', 'primary'), armor('old', {}, [worn('Cleave III')]));
coveredProfile.items.push(armor('cover', {}, [worn('Cleave VIII')]));
assert.equal(output(model.project(coveredProfile, armor('new', {}, [worn('Cleave IV')]), coveredProfile.items[2], baseScenario()), 'Melee DPS').delta, 0);
const coveredFerocity = profileWith(weapon('primary', 'primary'), armor('old', {}, [worn('Ferocity VI')]));
coveredFerocity.items.push(armor('cover', {}, [worn('Ferocity VIII')]));
assert.equal(output(model.project(coveredFerocity, armor('new', {}, [worn('Ferocity VII')]), coveredFerocity.items[2], baseScenario()), 'Melee DPS').delta, 0);
assert.equal(output(projectGear(armor('old', {}, [worn('Ferocity VI')]), armor('new', {}, [worn('Ferocity VII')])), 'Melee DPS').delta, 0);

const flat = projectGear(armor('old', {}, [worn('Cleave IX - 20')]), armor('new', {}, [worn('Cleave IX - 25')]));
assert.ok(Math.abs(output(flat, 'Melee DPS').delta - 6) < 1e-12);

assert.equal(output(projectGear(armor('old', { ATK: 610, STR: 10, DEX: 10 }), armor('new', { ATK: 700, STR: 10, DEX: 10 })), 'Melee stats DPS').delta, 0);
assert.equal(output(projectGear(armor('old', { STR: 630, ATK: 10, DEX: 10 }), armor('new', { STR: 700, ATK: 10, DEX: 10 })), 'Melee stats DPS').delta, 0);
assert.ok(output(projectGear(armor('old', { HStr: 0, ATK: 10, STR: 10, DEX: 10 }), armor('new', { HStr: 10, ATK: 10, STR: 10, DEX: 10 })), 'Melee stats DPS').delta > 0);
assert.ok(output(projectGear(armor('old', { HDex: 0, ATK: 10, STR: 10, DEX: 10 }), armor('new', { HDex: 10, ATK: 10, STR: 10, DEX: 10 })), 'Melee stats DPS').delta > 0);
assert.equal(output(projectGear(armor('old', { ATK: { num: null, raw: 'unknown', source: 'raidloot' } }), armor('new', { ATK: 20 })), 'Melee stats DPS').available, false);
assert.equal(output(projectGear(armor('old', { STR: { num: 10, raw: '10', source: 'opendkp' } }), armor('new', { STR: 20 })), 'Melee stats DPS').available, false);

const procProfile = profileWith(weapon('primary', 'primary', 100, 20, [proc('Force of Corruption VI')]));
const strike = weapon('candidate', 'primary', 100, 20, [proc('Strike of Flames VI')]);
const procScenario = baseScenario();
const procResult = model.project(procProfile, strike, procProfile.items[0], procScenario);
assert.ok(Math.abs(output(procResult, 'Weapon proc DPS').delta - 50 * 2 / 60) < 1e-12);
const slower = clone(procScenario); slower.hastePercent = 0; slower.primary.hitChance = .1;
assert.ok(Math.abs(output(model.project(procProfile, strike, procProfile.items[0], slower), 'Weapon proc DPS').delta - output(procResult, 'Weapon proc DPS').delta) < 1e-12);
const duplicate = model.project({ ...procProfile, items: [weapon('primary', 'primary', 100, 20, [proc('Force of Corruption VI'), proc('Force of Corruption VI')]), procProfile.items[1], procProfile.items[2]] }, strike, procProfile.items[0], procScenario);
assert.equal(output(duplicate, 'Weapon proc DPS').available, false);

const rawPrimary = weapon('raw', 'primary'); rawPrimary.stats = { DMG: { raw: '100', num: 100 }, Delay: { raw: '20', num: 20 } };
const rawProfile = profileWith(rawPrimary);
assert.equal(output(model.project(rawProfile, weapon('raw-candidate', 'primary', 110), rawPrimary, baseScenario()), 'Melee stats DPS').available, true);
const unknownDamage = weapon('unknown', 'primary'); unknownDamage.stats = { Damage: { raw: 'unknown', num: null }, Delay: 20 };
assert.equal(output(model.project(profileWith(unknownDamage), weapon('candidate', 'primary'), unknownDamage, baseScenario()), 'Melee stats DPS').available, false);

const twoHandScenario = baseScenario(); twoHandScenario.layout = 'two-hand';
const twoHandProfile = { id: '2h', cls: 'Beastlord', level: 100, items: [weapon('two-hand', 'primary', 150, 30), armor('old')] };
assert.equal(output(model.project(twoHandProfile, armor('new', { STR: 20 }), twoHandProfile.items[1], twoHandScenario), 'Melee stats DPS').available, true);
assert.throws(() => model.project(twoHandProfile, weapon('ambiguous', 'primary,secondary'), twoHandProfile.items[0], twoHandScenario), /Two-hand/);
const dualProfile = profileWith(weapon('primary', 'primary'));
assert.equal(output(model.project(dualProfile, weapon('dual-primary', 'primary,secondary', 110), dualProfile.items[0], baseScenario()), 'Melee stats DPS').available, true);
assert.equal(output(model.project(dualProfile, weapon('dual-secondary', 'primary,secondary', 80), dualProfile.items[1], baseScenario()), 'Melee stats DPS').available, true);
const shieldScenario = baseScenario(); shieldScenario.layout = 'one-hand-shield';
const shieldProfile = { id: 'shield', cls: 'Beastlord', level: 100, items: [weapon('one-hand', 'primary'), { id: 'shield', name: 'shield', slot: 'secondary', stats: { AC: 1 }, effectsKnown: true, effects: [] }, armor('old')] };
assert.equal(output(model.project(shieldProfile, armor('new', { STR: 20 }), shieldProfile.items[2], shieldScenario), 'Melee stats DPS').available, true);
assert.throws(() => model.project({ ...shieldProfile, items: [shieldProfile.items[0], weapon('bad-offhand', 'secondary'), shieldProfile.items[2]] }, armor('new', { STR: 20 }), shieldProfile.items[2], shieldScenario), /non-weapon secondary/);

function bruteRoll(offense, mitigation) {
  const avg = Math.max(1, Math.floor((offense + mitigation + 10) / 2)); let total = 0, count = 0;
  for (let attack = 0; attack < offense + 5; attack++) for (let defend = 0; defend < mitigation + 5; defend++) {
    const index = Math.max(0, Math.min(19, Math.floor(((attack - defend) + Math.floor(avg / 2)) * 20 / avg)));
    total += (index + 1) / 10; count++;
  }
  return total / count;
}
for (const offense of [0, 1, 5, 20]) for (const mitigation of [0, 1, 5, 20]) assert.ok(Math.abs(model.expectedRoll(offense, mitigation) - bruteRoll(offense, mitigation)) < 1e-12);

const v1 = { ...clone(dps.SCENARIO_DEFAULTS_V1), layout: 'dual-wield', revision: 4 };
assert.equal(dps.upgradeScenario(v1).version, 3);
const beforeProfile = clone(profileWith(weapon('primary', 'primary'))), beforeScenario = clone(baseScenario());
model.project(beforeProfile, armor('new', { STR: 20 }), beforeProfile.items[2], beforeScenario);
assert.deepEqual(beforeProfile, profileWith(weapon('primary', 'primary')));
assert.deepEqual(beforeScenario, baseScenario());
console.log('Player damage checks passed');

// v3 spell/reference vectors: spell-only comparisons remain usable without a melee layout.
const v3 = () => ({ ...clone(dps.SCENARIO_DEFAULTS_V3), layout: null });
const focus = (spellId, name) => ({ type: 'focus', spellId, name });
const spellArmor = (id, stats = {}, effects = [], effectsKnown = true) => ({ id, name: id, slot: 'chest', stats, effects, effectsKnown });
const spellProfile = (gear) => ({ id: 'spell-v3', cls: 'Beastlord', level: 100, items: [gear, spellArmor('other')] });
const spellOutput = (result, metric) => result.outputs.find((entry) => entry.metric === metric);
const oldFocus = spellArmor('old', {}, [focus(33139, 'Cold Damage 35-70 L100')]);
const newFocus = spellArmor('new', {}, [focus(33141, 'Cold Damage 35-100 L100')]);
const spellOnly = model.project(spellProfile(oldFocus), newFocus, oldFocus, v3());
assert.equal(spellOutput(spellOnly, 'Melee stats DPS').available, false);
assert.equal(spellOutput(spellOnly, 'Spell DPS').available, true);
assert.ok(spellOutput(spellOnly, 'Spell DPS').delta > 0);
const coveredFocus = spellArmor('covered', {}, [focus(33141, 'Cold Damage 35-100 L100')]);
const covered = model.project({ ...spellProfile(oldFocus), items: [oldFocus, coveredFocus] }, spellArmor('candidate'), oldFocus, v3());
assert.equal(spellOutput(covered, 'Spell DPS').delta, 0);
const unknownFocus = model.project(spellProfile({ ...oldFocus, effectsKnown: false }), spellArmor('unknown', {}, [{ type: 'focus', name: 'unknown focus' }], false), oldFocus, v3());
assert.equal(spellOutput(unknownFocus, 'Spell DPS').available, false);
assert.equal(spellOutput(unknownFocus, 'Spell stats DPS').available, true);
assert.ok(unknownFocus.excludedComponents.includes('Spell focus modifiers'));
const manaSlow = { ...v3(), spells: { ...v3().spells, manaPerSecond: 1 } };
const manaResult = model.project(spellProfile(spellArmor('mana')), spellArmor('mana-new'), spellArmor('mana'), manaSlow);
assert.ok(manaResult.spellFocus.uptime < 1);
const rankTwo = { ...v3(), spells: { ...v3().spells, rank: 2 } };
const rankOneResult = model.project(spellProfile(spellArmor('rank')), spellArmor('rank-new'), spellArmor('rank'), v3());
const rankTwoResult = model.project(spellProfile(spellArmor('rank')), spellArmor('rank-new'), spellArmor('rank'), rankTwo);
assert.equal(spellOutput(rankOneResult, 'Spell DPS').available, true);
assert.equal(spellOutput(rankTwoResult, 'Spell DPS').available, true);
assert.equal(spellOutput(rankOneResult, 'Spell DPS').current, (8391 + 6757) / 32);
assert.equal(spellOutput(rankTwoResult, 'Spell DPS').current, (8811 + 7095) / 32);
const weaponProfile = { id: 'hybrid-v3', cls: 'Beastlord', level: 100,
  items: [weapon('hybrid-primary', 'primary'), weapon('hybrid-secondary', 'secondary'), spellArmor('hybrid-old')] };
const hybridScenario = { ...v3(), layout: 'dual-wield' };
const hybrid = model.project(weaponProfile, spellArmor('hybrid-new', { 'Spell Dmg': 10 }), weaponProfile.items[2], hybridScenario);
assert.equal(spellOutput(hybrid, 'Melee DPS').available, true);
assert.equal(spellOutput(hybrid, 'Spell DPS').available, true);
assert.ok(hybrid.includedComponents.includes('Melee DPS') && hybrid.includedComponents.includes('Spell DPS'));
assert.equal(spellOutput(hybrid, 'Player DPS').current,
  ['Melee DPS', 'Weapon proc DPS', 'Spell DPS'].reduce((sum, metric) => sum + spellOutput(hybrid, metric).current, 0));
const casting = { ...hybridScenario, spells: { ...hybridScenario.spells, meleeDuringCast: 1 } };
const castingResult = model.project(weaponProfile, spellArmor('hybrid-new', { 'Spell Dmg': 10 }), weaponProfile.items[2], casting);
assert.equal(spellOutput(hybrid, 'Weapon proc DPS').current, spellOutput(castingResult, 'Weapon proc DPS').current);
assert.ok(Math.abs(spellOutput(hybrid, 'Melee DPS').current / spellOutput(castingResult, 'Melee DPS').current - 31 / 32) < 1e-12);
const flatDelta = model.project(spellProfile(spellArmor('flat')), spellArmor('flat-new', { 'Spell Dmg': 10 }), spellArmor('flat'), v3());
assert.equal(spellOutput(flatDelta, 'Spell DPS').delta, 2.6875);
const cappedFlat = model.project(spellProfile(spellArmor('cap')), spellArmor('cap-new', { 'Spell Dmg': 1000 }), spellArmor('cap'), v3());
assert.equal(spellOutput(cappedFlat, 'Spell DPS').candidate, 710.03125);
const unknownFlat = model.project(spellProfile(spellArmor('unknown-flat')), spellArmor('unknown-flat-new', { 'Spell Dmg': { num: null, raw: 'unknown', source: 'opendkp' } }), spellArmor('unknown-flat'), v3());
assert.equal(spellOutput(unknownFlat, 'Spell DPS').available, false);
assert.equal(spellOutput(unknownFlat, 'Spell stats DPS').available, false);
const critScenario = { ...v3(), spells: { ...v3().spells, criticalChance: 1, criticalMultiplier: 2 } };
const critGear = spellArmor('crit', {}, [focus(33141, 'Cold Damage 35-100 L100'), focus(33145, 'Poison Damage 35-100 L100')]);
const critResult = model.project(spellProfile(critGear), spellArmor('crit-new'), critGear, critScenario);
assert.equal(spellOutput(critResult, 'Spell DPS').current, (6757 * 1.15 * 2 + 8391 * 2 + 8391 * .675) / 32);
const type3 = [focus(36812, 'Type3 FC Kromrif Lance'), focus(36809, "Type3 FC Poantaar's Bite")];
for (const rank of [1, 2, 3]) {
  const scenario = { ...critScenario, spells: { ...critScenario.spells, rank, manaPerSecond: 1000 } };
  const empty = spellArmor('type3-empty');
  for (const [effects, bonus] of [[type3, 1193], [[type3[0]], 532], [[type3[1]], 661], [[...type3, ...type3], 1193]]) {
    const result = model.project(spellProfile(empty), spellArmor('type3-new', {}, effects), empty, scenario);
    assert.equal(spellOutput(result, 'Spell DPS').available, true);
    assert.equal(spellOutput(result, 'Spell DPS').delta, bonus * 2 / 32);
  }
}
const combined = spellArmor('combined', {}, [...critGear.effects, ...type3]);
const combinedResult = model.project(spellProfile(critGear), combined, critGear, critScenario);
assert.ok(Math.abs(spellOutput(combinedResult, 'Spell DPS').delta - 1193 * 2 / 32) < 1e-10);
const type3Gear = spellArmor('type3-old', {}, type3);
const type3Covered = model.project({ ...spellProfile(type3Gear), items: [type3Gear, spellArmor('retained', {}, type3)] }, spellArmor('removed'), type3Gear, v3());
assert.equal(spellOutput(type3Covered, 'Spell DPS').delta, 0);
for (const [effects, known] of [[[...type3, { type: 'focus', name: 'unknown Type3' }], true], [type3, false]]) {
  const result = model.project(spellProfile(type3Gear), spellArmor('unresolved-type3', { 'Spell Dmg': 10 }, effects, known), type3Gear, v3());
  assert.equal(spellOutput(result, 'Spell DPS').available, false);
  assert.equal(spellOutput(result, 'Spell stats DPS').available, true);
  assert.equal(spellOutput(result, 'Spell stats DPS').delta, 2.6875);
}
// Keep real focus records; substitute rotation IDs only to exercise non-applicability.
const realCatalog = context.LootCaptain.damageCatalog;
context.LootCaptain.damageCatalog = { ...realCatalog,
  spellRotation: (rank) => realCatalog.spellRotation(rank).map((spell) => ({ ...spell, spellId: spell.spellId + 100000 })),
};
try {
  const irrelevant = model.project(spellProfile(type3Gear), spellArmor('irrelevant-new'), type3Gear, v3());
  assert.equal(spellOutput(irrelevant, 'Spell DPS').available, true);
  assert.equal(spellOutput(irrelevant, 'Spell DPS').delta, 0);
  assert.equal(irrelevant.observations.unresolved.some((reason) => /spell-focus/.test(reason)), false);
} finally {
  context.LootCaptain.damageCatalog = realCatalog;
}
console.log('Spell v3 checks passed');

const wizardGear = spellArmor('wizard-old');
const wizardProfile = { id: 'wizard', cls: 'WIZ', level: 100, items: [wizardGear] };
const wizardScenario = dps.referenceScenario(wizardProfile).scenario;
for (const rank of [1, 2, 3]) {
  const scenario = { ...wizardScenario, spells: { ...wizardScenario.spells, rank } };
  const same = dps.referenceProject(wizardProfile, clone(wizardGear), wizardGear, scenario);
  assert.ok(Math.abs(output(same, 'Spell DPS').current - [23156, 24314, 25894][rank - 1] / 12) < 1e-10);
  assert.equal(output(same, 'Player DPS').delta, 0);
  assert.equal(same.scope.layout, null);
  assert.deepEqual(Array.from(same.includedComponents), ['Spell DPS']);
  assert.equal(same.outputs.some((entry) => /Melee|proc/.test(entry.metric)), false);
}
const wizardDelta = dps.referenceProject(wizardProfile, spellArmor('wizard-new', { 'Spell Dmg': 70 }), wizardGear);
assert.equal(output(wizardDelta, 'Spell DPS').delta, 7.5);
assert.equal(output(wizardDelta, 'Spell stats DPS').delta, 7.5);
assert.equal(output(wizardDelta, 'Player DPS').delta, 7.5);
assert.equal(wizardDelta.scenarioDefault, true);
assert.match(wizardDelta.rule.name, /Wizard.*spell-only/);
for (const effects of [[{ type: 'focus', name: 'unknown' }], [{ type: 'focus', spellId: 33139, name: 'Cold Damage 35-100 L100' }]]) {
  const fallback = dps.referenceProject(wizardProfile, spellArmor('unknown-wizard', { 'Spell Dmg': 70 }, effects), wizardGear);
  assert.equal(output(fallback, 'Spell DPS').available, false);
assert.equal(output(fallback, 'Spell stats DPS').delta, 7.5);
  assert.deepEqual(Array.from(fallback.includedComponents), ['Spell stats DPS']);
  assert.ok(fallback.observations.unresolved.length);
}
const irrelevantWizard = dps.referenceProject(wizardProfile, spellArmor('irrelevant-wizard', {}, [...type3, focus(33145, 'Poison Damage 35-100 L100')]), wizardGear);
assert.equal(output(irrelevantWizard, 'Spell DPS').delta, 0);
assert.equal(irrelevantWizard.observations.unresolved.length, 0);
const focusedWizard = dps.referenceProject(wizardProfile, spellArmor('focused-wizard', {}, [focus(33141, 'Cold Damage 35-100 L100')]), wizardGear);
assert.ok(output(focusedWizard, 'Spell DPS').delta > 0);
assert.equal(output(focusedWizard, 'Spell stats DPS').delta, 0);
const casterModels = [
  ['Magician', 'magician-spear', 24460 / 12.5],
  ['Enchanter', 'enchanter-mindcleave', 20791 / 13],
  ['Necromancer', 'necro-pyre', (8271 * 5) / 30],
];
for (const [cls, modelName, baseline] of casterModels) {
  const profile = { ...wizardProfile, cls };
  const reference = dps.referenceProject(profile, wizardGear, wizardGear);
  assert.equal(reference.scenario.spells.model, modelName);
  assert.ok(Math.abs(output(reference, 'Spell DPS').current - baseline) < 1e-10);
  assert.equal(output(reference, 'Player DPS').delta, 0);
  const changed = dps.referenceProject(profile, spellArmor(cls + '-new', { 'Spell Dmg': 70 }), wizardGear);
  assert.ok(output(changed, 'Spell DPS').available);
  assert.equal(output(changed, 'Player DPS').delta, cls === 'Necromancer' ? 0 : 10);
}
assert.ok(dps.referenceProject({ ...wizardProfile, cls: 'Cleric' }, wizardGear, wizardGear).outputs.every((entry) => !entry.available));
for (const [cls, modelName, excluded] of [
  ['Berserker', 'berserker-base-melee', 'Discs'], ['Monk', 'monk-base-melee', 'kicks'], ['Rogue', 'rogue-base-melee', 'backstab'],
]) {
  const oldGear = armor(cls + '-old', { STR: 10 }, []);
  const profile = { ...profileWith(weapon(cls + '-primary', 'primary'), oldGear), cls, level: 100 };
  const scenario = dps.referenceScenario(profile).scenario;
  assert.equal(scenario.meleeModel, modelName); assert.equal(scenario.layout, 'dual-wield');
  const result = dps.referenceProject(profile, armor(cls + '-new', { STR: 20 }, []), oldGear);
  assert.ok(output(result, 'Player DPS').available); assert.ok(output(result, 'Player DPS').delta > 0);
  assert.deepEqual(Array.from(result.includedComponents), ['Melee DPS', 'Weapon proc DPS']);
  assert.ok(result.excludedComponents.includes(excluded));
  assert.equal(result.outputs.some((entry) => /Spell/.test(entry.metric)), false);
}
assert.ok(dps.referenceProject({ ...wizardProfile, level: 99 }, wizardGear, wizardGear).outputs.every((entry) => !entry.available));
assert.throws(() => model.project(wizardProfile, wizardGear, wizardGear, v3()), /model does not match/);
const savedOldV3 = { ...hybridScenario, revision: 9, spells: { ...hybridScenario.spells } };
delete savedOldV3.spells.model;
const oldSavedResult = dps.referenceProject(weaponProfile, spellArmor('hybrid-new', { 'Spell Dmg': 10 }), weaponProfile.items[2], savedOldV3);
assert.equal(oldSavedResult.scenario.spells.model, 'beastlord');
assert.equal(oldSavedResult.scenarioRevision, 9);
assert.equal(oldSavedResult.scenarioDefault, false);
assert.deepEqual(clone(oldSavedResult.outputs), clone(hybrid.outputs));
for (const [castSeconds, recastSeconds, recoverySeconds, expected] of [
  [2.5, 0, 0, 250], [2.501, 0, 0, 167], [7, 0, 0, 1000], [7.001, 0, 0, 1000],
  [.5, 30, 0, 4357], [3.75, 5.25, 0, 1285], [.5, 1, 2, 250],
]) assert.equal(model.spellExtra(1000, { castSeconds, recastSeconds, recoverySeconds, baseDamage: 100000 }), expected);
assert.equal(model.spellExtra(100000, { castSeconds: 3.75, recastSeconds: 5.25, baseDamage: 23156 }), 11578);
console.log('Wizard spell-only checks passed');
