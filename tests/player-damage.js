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
console.log('Spell v3 checks passed');
