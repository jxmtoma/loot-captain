'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync('content/shared/slots.js', 'utf8') +
  fs.readFileSync('content/shared/parser.js', 'utf8') +
  fs.readFileSync('content/shared/damage-catalog.js', 'utf8'), context);
const parser = context.window.LootCaptain.parser;
const catalog = context.window.LootCaptain.damageCatalog;
for (const rank of [1, 2, 3]) {
  const records = catalog.spellRotation(rank, 'wizard-hoarfrost');
  assert.equal(records.length, 1);
  const spell = records[0];
  assert.equal(spell.spellId, 35820 + rank);
  assert.equal(spell.name, 'Ethereal Hoarfrost' + ['', ' Rk. II', ' Rk. III'][rank - 1]);
  assert.equal(spell.level, 99);
  assert.equal(spell.baseDamage, [23156, 24314, 25894][rank - 1]);
  assert.equal(spell.mana, [3740, 3890, 4046][rank - 1]);
  assert.equal(spell.castSeconds, 3.75); assert.equal(spell.recastSeconds, 5.25);
  assert.equal(spell.resist, 'Cold'); assert.equal(spell.resistAdjust, -50);
  assert.equal(spell.source.url, 'https://www.raidloot.com/spells/wizard');
}
for (const [model, ids, damage, mana, cast, recast, resist, url] of [
  ['magician-spear', [36022, 36023, 36024], [24460, 25683, 26967], [3951, 4109, 4273], 3.5, 9, 'Fire', 'https://www.raidloot.com/spells/mage'],
  ['enchanter-mindcleave', [36237, 36238, 36239], [20791, 21831, 22922], [3316, 3449, 3587], 4, 9, 'Lowest', 'https://www.raidloot.com/spells/enchanter'],
]) for (const rank of [1, 2, 3]) {
  const spell = catalog.spellRotation(rank, model)[0];
  assert.equal(spell.spellId, ids[rank - 1]); assert.equal(spell.baseDamage, damage[rank - 1]);
  assert.equal(spell.mana, mana[rank - 1]); assert.equal(spell.castSeconds, cast); assert.equal(spell.recastSeconds, recast);
  assert.equal(spell.resist, resist); assert.equal(spell.source.url, url);
}
for (const [rank, damage, id] of [[1, 8271, 35610], [2, 8685, 35611], [3, 9119, 35612]]) {
  const spell = catalog.spellRotation(rank, 'necro-pyre')[0];
  assert.equal(spell.spellId, id); assert.equal(spell.tickDamage, damage); assert.equal(spell.tickCount, 5);
  assert.equal(spell.tickIntervalSeconds, 6); assert.equal(spell.durationSeconds, 30); assert.equal(spell.resist, 'Fire');
  assert.equal(spell.source.url, 'https://www.raidloot.com/spells/necro');
}
assert.equal(catalog.spellRotation(1, 'cleric').length, 0);
assert.equal(catalog.spellRotation(1, 'magician').length, 0);
const raidlootParser = {};
vm.runInNewContext(fs.readFileSync('background/raidloot-parser.js', 'utf8') +
  '\nglobalThis.normalizeEffectForTest = parserNormalizeEffect;', raidlootParser);

const worn = (name, extra = {}) => ({ type: 'worn', name, raw: name, ...extra });
const proc = (name, extra = {}) => ({ type: 'proc', name, raw: name, ...extra });

for (const [spellId, name, flatDamage, spellGroup, eligibleSpellIds] of [
  [36812, 'Type3 FC Kromrif Lance', 532, 2512, [36401, 36402, 36403]],
  [36809, "Type3 FC Poantaar's Bite", 661, 2517, [36379, 36380, 36381]],
]) {
  const raw = `1: SPA 303 Base1=${flatDamage}\n2: SPA 385 Base1=${spellGroup}`;
  const base = name.replace('Type3 FC ', '');
  const text = `1: Increase Spell Damage by ${flatDamage} (v303, Before Crit)\n2: Limit Spells: ${base}, ${base} Rk. II, ${base} Rk. III`;
  const itemRaw = text.split('\n')[0];
  for (const identity of [{ name }, { spellId }, { raw }, { raw: name + '\n' + raw }, { raw: text },
    { name, raw: itemRaw }, { spellId, raw: itemRaw }, { raw: name + '\n' + itemRaw },
    { name, raw: raw.split('\n')[0] }]) {
    const resolved = catalog.resolveFocus({ type: 'focus', ...identity });
    assert.equal(resolved.flatDamage, flatDamage);
    assert.equal(resolved.spellGroup, spellGroup);
    assert.deepEqual(Array.from(resolved.eligibleSpellIds), eligibleSpellIds);
    assert.equal(resolved.spellId, spellId);
    assert.equal(resolved.critScaled, true);
  }
  for (const conflict of [
    { spellId: 99999 }, { effectId: 99999 }, { id: 'unknown' }, { critScaled: false }, { name: base }, { flatDamage: flatDamage + 1 },
    { spellGroup: spellGroup + 1 }, { eligibleSpellIds: eligibleSpellIds.slice(1) },
    { raw: raw.replace(String(flatDamage), '999') }, { raw: raw.replace(String(spellGroup), '999') },
    { raw: raw + '\n3: Limit Resist: Cold' },
    { raw: itemRaw.replace(String(flatDamage), '999') }, { raw: itemRaw.replace('Before Crit', 'After Crit') },
    { raw: itemRaw + '\n' + itemRaw }, { raw: itemRaw + '\n2: Limit Resist: Cold' },
    { name: 'Unknown focus', raw: itemRaw }, { raw: 'Unknown focus\n' + itemRaw },
    { raw: text.replace(', ' + base + ' Rk. III', '') }, { raw: text.replace('Before Crit', 'After Crit') },
    { raw: 'Unknown focus\n' + raw },
  ]) assert.equal(catalog.resolveFocus({ type: 'focus', name, spellId, ...conflict }), null);
  for (const incomplete of [itemRaw, raw.split('\n')[0], raw.split('\n')[1],
    itemRaw + '\n' + itemRaw, text.replace(', ' + base + ' Rk. III', '')]) {
    assert.equal(catalog.resolveFocus({ type: 'focus', raw: incomplete }), null);
  }
  assert.equal(catalog.resolveFocus({ type: 'focus', name, spellId: spellId === 36812 ? 36809 : 36812, raw: itemRaw }), null);
}
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Type3 FC Kromrif Lance', spellId: 36809 }), null);
for (const rank of [1, 2, 3]) for (const spell of catalog.spellRotation(rank)) {
  assert.equal(spell.source.url, 'https://www.raidloot.com/spells/beastlord');
}

assert.deepEqual(JSON.parse(JSON.stringify(catalog.spellRotation(1).map((spell) => [spell.spellId, spell.baseDamage]))), [[36379, 8391], [36401, 6757]]);
assert.deepEqual(JSON.parse(JSON.stringify(catalog.spellRotation(2).map((spell) => [spell.spellId, spell.mana]))), [[36380, 1714], [36402, 1211]]);
assert.deepEqual(JSON.parse(JSON.stringify(catalog.spellRotation(3).map((spell) => [spell.spellId, spell.baseDamage]))), [[36381, 9252], [36403, 7450]]);
assert.deepEqual(JSON.parse(JSON.stringify(catalog.spellRotation(0))), []);
assert.deepEqual(JSON.parse(JSON.stringify(catalog.spellRotation(4))), []);
assert.deepEqual(JSON.parse(JSON.stringify(catalog.spellRotation('1'))), []);

assert.deepEqual(JSON.parse(JSON.stringify(catalog.resolveFocus({
  type: 'focus', name: 'Cold Damage 35-100 L100', spellId: 33141, raw: 'Cold Damage 35-100 L100',
}))), {
  spellId: 33141, name: 'Cold Damage 35-100 L100', minPct: 8, maxPct: 22, maxLevel: 100,
  decayPctPerLevel: 5, resist: 'Cold', critScaled: true, source: { label: 'RaidLoot Cold Damage 35-100 L100', url: 'https://www.raidloot.com/spells?name=33141' },
});
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 40-70 L100', spellId: 33140 }).maxPct, 15);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 45-100 L100', spellId: 37940 }).minPct, 10);
const extractedCold33141 = 'Cold Damage 35-100 L100\n' +
  'Target: Self\nResist: Beneficial, Blockable: Yes\nFocusable: Yes\nCasting: 0s\n' +
  'Duration: 3.3h+ (1950 ticks), Dispelable: Yes\n' +
  '1: Increase Spell Damage by 35% to 100% (v124, Before DoT Crit, After DD Crit)\n' +
  '2: Limit Max Level: 100 (lose 5% per level)\n3: Limit Effect: Current HP\n5: Limit Type: Detrimental\n' +
  '6: Limit Target: Exclude Caster AE\n7: Limit Target: Exclude Caster PB\n8: Limit Target: Exclude Target AE\n' +
  '9: Limit Min Duration: 12s\n10: Limit Min Mana Cost: 10\n11: Limit Type: Exclude Combat Skills\n12: Limit Resist: Cold\n' +
  '13: Increase Spell Damage by 8% to 22% (v302, Before Crit)\n14: Limit Max Level: 100 (lose 5% per level)\n' +
  '15: Limit Effect: Current HP\n17: Limit Type: Detrimental\n18: Limit Target: Exclude Caster AE\n' +
  '19: Limit Target: Exclude Caster PB\n20: Limit Target: Exclude Target AE\n21: Limit Max Duration: 0s\n' +
  '22: Limit Min Mana Cost: 10\n23: Limit Type: Exclude Combat Skills\n24: Limit Resist: Cold';
assert.equal(catalog.resolveFocus({ type: 'focus', raw: extractedCold33141 }).maxPct, 22);
assert.equal(catalog.resolveFocus({ type: 'focus', key: 'focus:cold damage' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Poison Damage 35-100 L100', spellId: 33145 }).minPct, 35);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Poison Damage 35-100 L100', spellId: 33145 }).critScaled, false);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Poison Damage 40-100 L100', spellId: 33146 }).maxPct, 100);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Poison Damage 45-70 L100', spellId: 37941 }).minPct, 45);
assert.equal(catalog.resolveFocus({ type: 'focus', raw: 'Poison Damage 35-100 L100\n1: Increase Spell Damage by 35% to 100% (v124, Before DoT Crit, After DD Crit)\n2: Limit Max Level: 100 (lose 5% per level)\n3: Limit Effect: Current HP\n5: Limit Type: Detrimental\n6: Limit Target: Exclude Caster AE\n7: Limit Target: Exclude Caster PB\n9: Limit Target: Exclude Old Giants\n10: Limit Target: Exclude Old Dragons\n11: Limit Type: Exclude Combat Skills\n12: Limit Resist: Poison' }).maxPct, 100);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', spellId: 33142 }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', raw: 'Cold Damage 35-100 L100\nSPA 302 Base1=35 Base2=100' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', raw: 'Cold Damage 35-100 L100\nSPA 302 Base1=8 Base2=22\nLimit Resist: Poison' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', raw: 'Cold Damage 35-100 L100\nSPA 302 Base1=8 Base2=22\nLimit Max Level: 100\nLimit Max Level: 120' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', raw: 'Cold Damage 35-100 L100\nSPA 302 Base1=8 Base2=22\nLimit Min Mana Cost: 10\nLimit Min Mana Cost: 999' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', raw: 'Cold Damage 35-100 L100\nSPA 302 Base1=8 Base2=22\nLimit Type: Beneficial' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Cold Damage 35-100 L100', raw: 'Cold Damage 35-100 L100\nSPA 302 Base1=8 Base2=22\nLimit Min Duration: 12s\nLimit Min Duration: 12s' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Poison Damage 35-100 L100', raw: 'Poison Damage 35-100 L100\n1: Increase Spell Damage by 35% to 100% (v124, Before DoT Crit, After DD Crit)\n2: Limit Max Level: 100 (lose 5% per level)\n3: Limit Effect: Current HP\n5: Limit Type: Detrimental\n12: Limit Resist: Poison\n13: Limit Min Duration: 12s' }), null);
assert.equal(catalog.resolveFocus({ type: 'focus', name: 'Poison Damage 35-100 L100', raw: 'Poison Damage 35-100 L100\n1: Increase Spell Damage by 35% to 100% (v124, Before DoT Crit, After DD Crit)\n2: Limit Max Level: 100 (lose 5% per level)\n3: Limit Effect: Current HP\n5: Limit Type: Detrimental\n12: Limit Resist: Poison\n13: Limit Min Mana Cost: 999' }), null);

const parsed = parser.parseOpenDkpJson({ name: 'Parser fixture', slot: 'Primary', effects: [
  { type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Decrease Current HP by 460', id: 23815 },
  { type: 'worn', name: 'Cleave VIII', raw: 'Cleave VIII\n1: Increase Chance to Critical Hit with 1H Pierce by 320%', id: 15840 },
] });
assert.equal(parsed.effects[0].rank, null);
assert.equal(parsed.effects[1].rank, '320%');
assert.equal(catalog.resolveProc(parsed.effects[0]).spellId, 23815);
assert.equal(catalog.resolveWorn(parsed.effects[1]).spellId, 15840);
assert.equal(raidlootParser.normalizeEffectForTest(parsed.effects[0]).rank, null);
assert.equal(raidlootParser.normalizeEffectForTest(parsed.effects[1]).rank, '320%');
const rankFixtures = parser.parseOpenDkpJson({ name: 'Rank fixtures', effects: [
  { type: 'unknown', name: 'A', raw: 'A v2' },
  { type: 'unknown', name: 'B', raw: 'B v II' },
  { type: 'unknown', name: 'C', raw: 'C rank2' },
  { type: 'unknown', name: 'D', raw: 'D rank II' },
] });
assert.deepEqual(Array.from(rankFixtures.effects, (effect) => effect.rank), ['2', 'II', '2', 'II']);

assert.equal(catalog.resolveWorn(worn('Ferocity VI')).bonusPct, 18);
assert.equal(catalog.resolveWorn(worn('  ferocity   vi ')).spellId, 7835);
assert.equal(catalog.resolveWorn(worn('Cleave VIII')).bonusPct, 320);
assert.equal(catalog.resolveWorn(worn('Cleave IX', { spellId: 20516 })).bonusPct, 360);
assert.equal(catalog.resolveWorn(worn('Ferocity VI', { key: 'worn:id:7835' })).spellId, 7835);
assert.equal(catalog.resolveWorn({ type: 'worn', key: 'worn:id:7835', raw: 'Ferocity VI' }).family, 'ferocity');
assert.equal(catalog.resolveWorn({ type: 'worn', name: 'Ferocity VI', raw: 'Ferocity VI\n1: Increase Chance to Double Attack by 18%' }).bonusPct, 18);
assert.equal(catalog.resolveWorn({ type: 'worn', name: 'Ferocity VI', spellId: 7835, rank: 'VII' }), null);
assert.equal(catalog.resolveWorn({ type: 'worn', name: 'Ferocity VI', spellId: 7835, rank: 'VII', raw: 'Ferocity VI\n1: Increase Chance to Double Attack by 18%' }), null);
assert.equal(catalog.resolveWorn({ type: 'worn', name: 'Ferocity VI', spellId: 7835, raw: 'Ferocity VI\n1: Increase Chance to Double Attack by 99%' }), null);
assert.equal(catalog.resolveWorn({ type: 'worn', name: 'Cleave VIII', spellId: 15840, raw: 'Cleave VIII\n1: Increase Chance to Critical Hit with 1H Pierce by 99%' }), null);
assert.equal(catalog.resolveWorn({ type: 'worn', name: 'Cleave IX', spellId: 20516, rank: '360%', raw: 'Cleave IX' }).bonusPct, 360);

assert.equal(catalog.resolveWorn({ type: 'focus', name: 'Ferocity VI' }), null);
assert.equal(catalog.resolveWorn(worn('Merciless Ferocity')), null);
assert.equal(catalog.resolveWorn(worn('Ferocity VII', { spellId: 7835 })), null);
assert.equal(catalog.resolveWorn(worn('Cleave IX', { spellId: 15840 })), null);
assert.equal(catalog.resolveWorn(worn('Cleave IX - 40')).flatDamage, 40);
assert.equal(catalog.resolveWorn(worn('Cleave IX - 40')).source.url, 'https://www.raidloot.com/spells?name=38914');
assert.equal(catalog.resolveWorn(worn('Unknown Worn Effect')), null);

assert.deepEqual(JSON.parse(JSON.stringify(catalog.resolveProc(proc('Force of Corruption VI')))), {
  name: 'Force of Corruption VI', spellId: 23815, baseDamage: 460, resist: 'Corruption -25', rateMultiplier: 1,
  source: { label: 'RaidLoot Force of Corruption VI', url: 'https://www.raidloot.com/spells?name=23815' },
});
assert.equal(catalog.resolveProc(proc('Strike of Flames VI', { key: 'proc:id:23735' })).baseDamage, 510);
assert.equal(catalog.resolveProc({ type: 'proc', key: 'proc:id:23815', raw: 'Force of Corruption VI\n1: Decrease Current HP by 460' }).baseDamage, 460);
assert.equal(catalog.resolveProc({ type: 'proc', key: 'proc:id:23815', raw: 'Force of Corruption V\n1: Decrease Current HP by 460' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Decrease Current HP by 460' }).resist, 'Corruption -25');
assert.equal(catalog.resolveProc({ type: 'proc', raw: 'Proc Effect: Force of Corruption VI\nResist: Corruption -25\n1: Decrease Current HP by 460' }).spellId, 23815);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption V\n1: Decrease Current HP by 460' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Flames VI', raw: 'Strike of Flames VI\nResist: Fire -190\n1: Decrease Current HP by 510' }).baseDamage, 510);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Flames VI', rank: 'I', raw: 'Strike of Flames VI', key: 'proc:flames strike' }).spellId, 23735);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Flames VI', rank: 'I', raw: 'Strike of Flames VI' }).spellId, 23735);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Flames VI', rank: 'I', raw: 'Strike of Flames VI', key: 'proc:wrong' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Flames VI', rank: 'II', raw: 'Strike of Flames VI', key: 'proc:flames strike' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Flames VI', rank: 'I', raw: 'Strike of Flames VI', key: 'proc:flames strike', provenance: 'legacy' }).spellId, 23735);
assert.equal(catalog.resolveProc(proc('Strike of Venom V')).baseDamage, 420);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Strike of Venom V', spellId: 23774 }).resist, 'Poison -180');

assert.equal(catalog.resolveProc(proc('Force of Corruption V')), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Unlisted Proc Name', spellId: 23815 }), null);
assert.equal(catalog.resolveProc(proc('Force of Corruption VI', { spellId: 23735 })), null);
assert.equal(catalog.resolveProc({ type: 'proc', key: 'proc:id:23815', name: 'Strike of Flames VI' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', key: 'proc:id:23815', name: 'Force of Corruption V' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Decrease Current HP by 510' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Decrease Current HP by 460 if target is undead' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Decrease Current HP by 460\n2: Decrease Current HP by 460' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Decrease Current HP by 100 per tick' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Cast: Other Spell' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\n1: Increase Current HP by 460' }), null);
assert.equal(catalog.resolveProc({ type: 'proc', name: 'Force of Corruption VI', raw: 'Force of Corruption VI\nResist: Corruption -25' }), null);
assert.equal(catalog.resolveProc(proc('Unknown Proc')), null);
assert.equal(catalog.resolveProc({ type: 'worn', name: 'Force of Corruption VI' }), null);

console.log('damage catalog: ok');
