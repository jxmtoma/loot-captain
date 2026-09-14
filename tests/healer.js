'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const context = { console }; context.window = context;
for (const file of ['slots', 'reference-stats', 'player-damage', 'healer']) vm.runInNewContext(fs.readFileSync('content/shared/' + file + '.js', 'utf8'), context);
const healer = context.LootCaptain.healer, clone = (value) => JSON.parse(JSON.stringify(value));
const output = (result, metric) => result.outputs.find((entry) => entry.metric === metric);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, a + ' != ' + b);
for (const [cls, heals, costs] of [
  ['Cleric', [7611, 7992, 8392], [990, 1030, 1071]], ['Druid', [9964, 10462, 10985], [1045, 1087, 1130]],
  ['Shaman', [9991, 10491, 11016], [1584, 1647, 1713]],
]) {
  const worn = { id: 'old', name: 'Old', slot: 'head', stats: { 'Heal Amount': 100, MANA: 1000 } };
  const candidate = { ...worn, id: 'new', stats: { 'Heal Amount': 200, MANA: 2000 } };
  const profile = { id: cls, cls, level: 100, items: [worn] };
  const scenario = { ...healer.defaults(profile), baseMana: 1000, baseWisdom: 0, healBonusPercent: 0,
    baseManaPerSecond: 0, durationSeconds: 100 };
  const unchanged = clone({ profile, candidate, scenario });
  const oculus = { id: '79790', name: 'Model XLII Spatial Temporal Oculus', slot: 'face', isAugment: true,
    stats: { WIS: { num: -4, raw: '-4', source: 'raidloot' } } };
  const withOculus = { ...profile, items: [worn, oculus] };
  const wisScenario = { ...scenario, baseWisdom: 100 };
  const penalty = healer.project(withOculus, candidate, worn, wisScenario);
  near(output(penalty, 'Mana pool').current, output(healer.project(profile, candidate, worn, wisScenario), 'Mana pool').current - 36.6);
  assert.equal(penalty.unresolved.length, 0);
  assert.equal(output(penalty, 'Encounter HPS').available, true);
  const cappedPenalty = healer.project(withOculus, candidate, worn, { ...scenario, baseWisdom: 1000 });
  near(output(cappedPenalty, 'Mana pool').current, output(healer.project(profile, candidate, worn, { ...scenario, baseWisdom: 1000 }), 'Mana pool').current);
  const unreadable = { ...profile, items: [worn, { ...oculus, stats: { WIS: { num: null, raw: '?', source: 'raidloot' } } }] };
  assert.equal(output(healer.project(unreadable, candidate, worn, wisScenario), 'Mana pool').available, false);
  for (const rank of [1, 2, 3]) {
    const result = healer.project(profile, candidate, worn, { ...scenario, rank });
    near(output(result, 'Effective heal/cast').current, heals[rank - 1] + 66);
    near(output(result, 'Effective heal/cast').delta, 67);
    near(output(result, 'Mana pool').current, 2000);
    near(output(result, 'Casting HPS').current, (heals[rank - 1] + 66) / 5.25);
    near(output(result, 'Encounter HPS').current, (heals[rank - 1] + 66) * 2000 / costs[rank - 1] / 100);
    near(output(result, 'Long-run HPS').current, 0);
    assert.ok(output(result, 'Encounter HPS').delta > 0);
  }
  const same = healer.project(profile, worn, worn, scenario);
  assert.ok(same.outputs.every((entry) => entry.available && entry.delta === 0));
  const manaOnly = { ...candidate, stats: { ...worn.stats, MANA: 2000 } };
  const manaGain = healer.project(profile, manaOnly, worn, scenario);
  assert.equal(output(manaGain, 'Casting HPS').delta, 0);
  assert.ok(output(manaGain, 'Encounter HPS').delta > 0);
  const steady = healer.project(profile, candidate, worn, { ...scenario, baseManaPerSecond: 10000 });
  near(output(steady, 'Encounter HPS').current, output(steady, 'Casting HPS').current);
  const scaled = healer.project(profile, candidate, worn, { ...scenario, criticalChance: .5, overhealFraction: .25 });
  near(output(scaled, 'Effective heal/cast').current, (heals[0] + 66) * 1.5 * .75);
  const noHeal = healer.project(profile, { ...candidate, stats: { 'Heal Amount': { num: null }, MANA: 2000 } }, worn, scenario);
  assert.equal(output(noHeal, 'Casting HPS').available, false);
  assert.ok(noHeal.unresolved.some((issue) => issue.item === 'Old' && issue.stat === 'Heal Amount' && issue.reason === 'unreadable or unsupported value'));
  assert.equal(output(noHeal, 'Mana pool').available, true);
  const noMana = healer.project(profile, { ...candidate, stats: { 'Heal Amount': 200, MANA: { num: null } } }, worn, scenario);
  assert.equal(output(noMana, 'Encounter HPS').available, false);
  assert.equal(output(noMana, 'Casting HPS').available, true);
  const focusOnly = { id: 'focus', name: 'Focus augment', slot: 'head', isAugment: true,
    stats: { Slot: { num: null, raw: 'Head', source: 'raidloot' } }, effects: [{ type: 'focus', name: 'Unknown healing focus' }] };
  const withFocus = healer.project({ ...profile, items: [worn, focusOnly] }, candidate, worn, scenario);
  near(output(withFocus, 'Casting HPS').current, output(same, 'Casting HPS').current);
  assert.equal(withFocus.unresolved.length, 0);
  const failedImport = { ...focusOnly, name: 'Unloaded augment', stats: {} };
  const failed = healer.project({ ...profile, items: [worn, failedImport] }, candidate, worn, scenario);
  assert.ok(failed.unresolved.some((issue) => issue.item === 'Unloaded augment' && issue.reason === 'no numeric item stats imported'));
  assert.equal(output(failed, 'Encounter HPS').available, false);
  const regen = healer.project(profile, { ...candidate, stats: { ...worn.stats, ManaRegen: 60 } }, worn, scenario);
  near(output(regen, 'Mana regeneration/second').candidate, 5);
  const heroic = healer.project(profile, { ...candidate, stats: { ...worn.stats, HWis: 10 } }, worn, scenario);
  near(output(heroic, 'Mana pool').delta, 191.5);
  const cappedWorn = { ...worn, stats: { ...worn.stats, WIS: 1000 } };
  const cappedProfile = { ...profile, items: [cappedWorn] };
  const cappedGain = healer.project(cappedProfile, { ...candidate, stats: { ...cappedWorn.stats, WIS: 1100 } }, cappedWorn, scenario);
  assert.equal(output(cappedGain, 'Mana pool').delta, 0);
  const partial = healer.project(profile, { ...candidate, stats: { MANA: { num: 1000, source: 'opendkp' } } }, worn, scenario);
  assert.equal(output(partial, 'Encounter HPS').available, false);
  const shorter = healer.project(profile, candidate, worn, { ...scenario, durationSeconds: 50 });
  near(output(shorter, 'Encounter HPS').current, output(healer.project(profile, candidate, worn, scenario), 'Encounter HPS').current * 2);
  if (cls === 'Cleric') near(output(healer.project(profile, candidate, worn, { ...scenario, lowHealthFraction: 1 }), 'Effective heal/cast').current, 9514 + 66);
  for (const [key, value] of [['rank', 1.5], ['cycleSeconds', 1], ['criticalChance', 2], ['startingManaFraction', -1], ['manaCostReduction', 1], ['durationSeconds', 0], ['baseMana', null]]) {
    assert.throws(() => healer.validateScenario({ ...scenario, [key]: value }));
  }
  assert.throws(() => healer.project(profile, candidate, worn, { ...scenario, spellModel: cls === 'Cleric' ? 'druid' : 'cleric' }), /match/);
  assert.deepEqual(clone({ profile, candidate, scenario }), unchanged);
  assert.equal(healer.project({ ...profile, level: 99 }, candidate, worn).outputs.length, 0);
  assert.equal(healer.project({ ...profile, cls: 'Warrior' }, candidate, worn).outputs.length, 0);
}
for (const cls of ['CLR', 'DRU', 'SHM']) assert.ok(healer.supported({ cls, level: 100 }));
assert.equal(healer.supported({ cls: 'constructor', level: 100 }), false);
console.log('Healer reference checks passed');
