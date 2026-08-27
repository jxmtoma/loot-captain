'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(file, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const optionsHtml = read('options/options.html');
const optionsSource = read('options/options.js');
const popupSource = read('popup/popup.js');
const raidlootSource = read('content/raidloot.js');
const opendkpSource = read('content/opendkp.js');
assert.match(optionsHtml, /<select id="profile-class"><\/select>/);
assert.match(optionsHtml, /id="btn-edit-items"/);
assert.match(optionsHtml, /data-inventory-tab="augments"/);
assert.match(optionsHtml, /data-inventory-tab="focus"/);
assert.match(optionsHtml, /id="wishlist-list"/);
assert.doesNotMatch(optionsHtml, /id="profile-class"[^>]*type="text"/);
for (const className of ['Bard', 'Beastlord', 'Berserker', 'Cleric', 'Druid', 'Enchanter', 'Magician', 'Monk', 'Necromancer', 'Paladin', 'Ranger', 'Rogue', 'Shadowknight', 'Shaman', 'Warrior', 'Wizard']) {
  assert.match(optionsSource, new RegExp("'" + className + "'"));
}
assert.match(optionsSource, /INVENTORY_SLOT_LAYOUT/);
assert.match(optionsSource, /let itemsEditable = false/);
assert.match(optionsSource, /let selectedItemIndex = 0/);
assert.match(optionsSource, /if \(idx !== selectedItemIndex\) return/);
assert.match(optionsSource, /disabled = !itemsEditable/);
assert.match(optionsSource, /if \(itemsEditable\) statRow\.appendChild\(rmBtn\)/);
assert.match(optionsSource, /item-detail-icon/);
assert.match(optionsSource, /hasSpellFocus/);
assert.match(optionsSource, /isPowerSourceItem/);
assert.match(optionsSource, /PROFILE_STATS_VERSION = 4/);
assert.match(optionsSource, /renderFocusDetails/);
assert.match(optionsSource, /focus-list-entry/);
assert.match(optionsSource, /hasWeaponProc/);
assert.match(optionsSource, /renderWishlist/);
assert.match(optionsSource, /type: 'SAVE_PROFILES'/);
assert.match(optionsSource, /editingId = savedId/);
assert.doesNotMatch(optionsSource, /await saveAll\(\[savedId\]\);\s*closeEditor\(\);/);
assert.match(optionsSource, /https:\/\/www\.raidloot\.com\/items\?name=/);
assert.match(optionsSource, /details\.rel = 'noopener'/);
assert.match(popupSource, /key: 'regen'/);
assert.match(popupSource, /key: 'manaregen'/);
assert.match(optionsSource, /\{ slot: 'neck', label: 'Neck', column: 6, row: 2 \}/);
assert.match(optionsSource, /\{ slot: 'back', label: 'Back', column: 6, row: 3 \}/);
assert.match(optionsSource, /\{ slot: 'shoulders', label: 'Shoulder', column: 6, row: 4 \}/);
assert.match(optionsSource, /\{ slot: 'chest', label: 'Chest', column: 1, row: 2 \}/);
assert.match(optionsSource, /\{ slot: 'arms', label: 'Arm', column: 1, row: 3 \}/);
assert.match(optionsSource, /\{ slot: 'waist', label: 'Waist', column: 1, row: 4 \}/);
assert.match(optionsSource, /\{ slot: 'feet', label: 'Feet', column: 5, row: 6 \}/);
assert.match(optionsSource, /\{ slot: 'wrist-1', label: 'Left Wrist', column: 1, row: 5 \}/);
assert.doesNotMatch(optionsSource, /ammo/i);
assert.equal(manifest.permissions.includes('scripting'), false);
assert.equal(manifest.host_permissions.includes('https://dlil5rqe0ybd2.cloudfront.net/*'), true);
assert.doesNotMatch(read('background/service-worker.js'), /inlineRaidlootIcon/);
assert.match(read('options/options.js'), /data:image/);
assert.match(read('content/shared/ui.js'), /padding:2px 8px 2px 0 !important/);
assert.match(read('content/shared/ui.js'), /text-align:right !important/);
assert.match(read('content/shared/ui.js'), /table-layout:fixed !important/);
assert.match(read('content/shared/ui.js'), /focus up/);
assert.match(read('content/shared/ui.js'), /proc up/);
assert.match(read('content/shared/ui.js'), /proc eq/);
assert.match(read('content/shared/ui.js'), /dataset\.lcView = 'proc'/);
assert.match(read('content/shared/ui.js'), /slotShort\(row\.slotKey\)/);
assert.match(read('content/shared/state.js'), /PROFILE_STATS_VERSION = 4/);
assert.match(read('content/shared/state.js'), /type: 'MUTATE_WISHLIST'/);
assert.match(read('background/service-worker.js'), /let profileMutationQueue = Promise\.resolve\(\)/);
assert.match(read('background/service-worker.js'), /RAIDLOOT_ITEM_CACHE_KEY = 'raidlootItemCache'/);
assert.match(read('background/service-worker.js'), /debug\.source = 'cache'/);
assert.match(read('content/shared/ui.js'), /Wishlist item stats unavailable/);
assert.match(read('content/shared/ui.js'), /\.lc-wishlist-toggle\{[^']*width:auto !important/);
assert.match(read('content/shared/ui.js'), /background:transparent !important/);
assert.match(raidlootSource, /raidlootId: cand\.raidlootId \|\| cand\.id/);
assert.match(opendkpSource, /\.p-progressbar-value\.p-progressbar-value-animate/);
assert.match(opendkpSource, /raidlootId,/);
assert.match(opendkpSource, /opendkpHost: OPENDKP_HOST/);
assert.match(opendkpSource, /let annotationGeneration = 0/);
assert.match(read('content/shared/ui.js'), /let renderGeneration = 0/);
assert.match(read('content/shared/ui.js'), /enrichWishlistEntry\(target, profile && profile\.id\)/);
assert.match(opendkpSource, /new MutationObserver\(\(records\) =>/);
assert.doesNotMatch(read('content/shared/ui.js'), /return arrow \+ ' ' \+ fmtDelta\(diff\.score\) \+ ' ' \+ formula\.label/);
assert.match(read('content/shared/ui.js'), /\.lc-compare-panel \.lc-head\{display:flex/);
assert.match(raidlootSource, /existing\.dataset\.lcView/);
assert.match(raidlootSource, /existing\.dataset\.lcRow/);
assert.match(raidlootSource, /nativeDetailRow\.nextElementSibling/);
assert.match(raidlootSource, /appendChild\(newRow\)/);
assert.match(read('content/shared/ui.js'), /dataset\.lcView = 'focus'/);
assert.equal(manifest.content_scripts.some((script) => script.world === 'MAIN'), true);
const bridgeSource = read('content/opendkp-page.js');
assert.match(bridgeSource, /event\.isTrusted/);
assert.match(bridgeSource, /getReader/);
assert.match(bridgeSource, /content-length/);
assert.match(read('content/opendkp.js'), /Extension context invalidated/);
assert.match(read('content/opendkp-consent.js'), /consentVersion/);

function loadCore(context) {
  for (const file of ['content/shared/slots.js', 'content/shared/parser.js', 'content/shared/diff.js']) {
    vm.runInNewContext(read(file), context, { filename: file });
  }
}

const core = { window: {}, console };
core.window = core;
core.LootCaptain = {};
loadCore(core);
const LC = core.LootCaptain;

const formula = LC.diff.SCORE_FORMULAS.find((item) => item.key === 'hp');
const unresolved = LC.diff.diffItems({ stats: { HP: { num: 100 } } }, { stats: {} }, formula);
assert.equal(unresolved.comparable, false);
assert.equal(unresolved.score, 0);
const wishlistPair = LC.diff.compareItemPair(
  { name: 'Candidate Helm', slot: 'Head', stats: { HP: { num: 150 } } },
  { name: 'Wanted Helm', slot: 'Head', stats: { HP: { num: 100 } } },
  formula,
  125,
);
assert.equal(wishlistPair.comparable, true);
assert.equal(wishlistPair.score, 50);
assert.equal(LC.diff.wishlistComparisonDirection(
  { stats: { HP: { num: 150 } } },
  [{ stats: { HP: { num: 100 } } }, { stats: { HP: { num: 125 } } }],
  formula,
), 1);
assert.equal(LC.diff.wishlistComparisonDirection(
  { stats: { HP: { num: 100 } } },
  [{ stats: { HP: { num: 150 } } }],
  formula,
), -1);
assert.equal(LC.diff.wishlistComparisonDirection(
  { stats: { HP: { num: 125 } } },
  [{ stats: { HP: { num: 100 } } }, { stats: { HP: { num: 150 } } }],
  formula,
), 0);
const mixedStats = LC.diff.diffItems(
  { stats: { HP: { num: 100 } } },
  { stats: { HP: { num: 50 }, AC: { num: 10 } } },
  LC.diff.SCORE_FORMULAS.find((item) => item.key === 'ac10hp'),
);
assert.equal(mixedStats.comparable, true);
assert.equal(mixedStats.score, -50);
assert.equal(mixedStats.diffs.AC.delta, -10);
const weaponFormula = LC.diff.SCORE_FORMULAS.find((item) => item.key === 'ac10hp');
for (const slot of ['Primary', 'Secondary', 'Range']) {
  const weaponUpgrade = LC.diff.diffItems(
    { slot, stats: { Damage: { num: 100 }, Delay: { num: 20 }, HP: { num: 200 } } },
    { slot, stats: { Damage: { num: 80 }, Delay: { num: 20 }, HP: { num: 100 } } },
    weaponFormula,
  );
  assert.equal(weaponUpgrade.comparable, true);
  assert.equal(weaponUpgrade.score, 100);
  assert.equal(weaponUpgrade.weaponRatioDelta, 1);
}
assert.equal(LC.diff.diffItems(
  { slot: 'Head', stats: { Damage: { num: 100 }, Delay: { num: 20 } } },
  { slot: 'Head', stats: { Damage: { num: 80 }, Delay: { num: 20 } } },
  weaponFormula,
).weaponRatioDelta, null);
const dualSlotKey = LC.slots.canonicalSlot('Primary, Secondary');
assert.equal(dualSlotKey.key, 'primary');
assert.equal(dualSlotKey.paired, false);
assert.equal(dualSlotKey.keys.join(','), 'primary,secondary');
const dualSlotUpgrade = LC.diff.diffItems(
  { slot: 'Primary, Secondary', stats: { Damage: { num: 110 }, Delay: { num: 19 } } },
  { slot: 'Secondary', stats: { Damage: { num: 100 }, Delay: { num: 20 } } },
  weaponFormula,
);
assert.equal(dualSlotUpgrade.comparable, true);
assert.equal(dualSlotUpgrade.weaponRatioDelta > 0, true);
const dualWeapon = LC.parser.parseOpenDkpJson({
  ItemID: 43, ItemName: 'Dual Weapon', Slot: 'Primary, Secondary', Class: 'BST', DMG: 110, Delay: 19, HP: 200,
});
const dualProfile = {
  cls: 'Beastlord',
  items: [
    { slot: 'Primary', stats: { Damage: 100, Delay: 20, HP: 100 } },
    { slot: 'Secondary', stats: { Damage: 90, Delay: 20, HP: 100 } },
  ],
};
const dualComparison = LC.diff.compareCandidate(dualProfile, dualWeapon, weaponFormula);
assert.equal(dualComparison.eligible, true);
assert.equal(dualComparison.rows.length, 2);
assert.equal(LC.diff.summarizeComparisons(dualComparison).comparable, true);
const dualProcCandidate = LC.parser.parseOpenDkpJson({
  ItemID: 59, ItemName: 'Dual Proc Weapon', Slot: 'Primary, Secondary', Class: 'BST', DMG: 110, Delay: 19, HP: 200,
  ProcEffect: 'Strike of Ice\n1: Decrease Current HP by 1200',
});
const dualProcProfile = {
  cls: 'Beastlord',
  items: [
    { name: 'Primary Weapon', slot: 'Primary', stats: { Damage: 100, Delay: 20, HP: 100 }, effects: [LC.parser.parseStructuredEffects({ type: 'proc', name: 'Strike of Ice', raw: 'Strike of Ice\n1: Decrease Current HP by 1000' }, 'proc')[0]] },
    { name: 'Secondary Weapon', slot: 'Secondary', stats: { Damage: 90, Delay: 20, HP: 100 }, effects: [LC.parser.parseStructuredEffects({ type: 'proc', name: 'Strike of Ice', raw: 'Strike of Ice\n1: Decrease Current HP by 1500' }, 'proc')[0]] },
  ],
};
const dualProcComparison = LC.diff.compareCandidate(dualProcProfile, dualProcCandidate, weaponFormula);
assert.equal(dualProcComparison.rows.length, 2);
assert.equal(dualProcComparison.rows[0].slotKey.key, 'primary');
assert.equal(dualProcComparison.rows[0].diff.effects.proc.rows[0].direction, 1);
assert.equal(dualProcComparison.rows[1].slotKey.key, 'secondary');
assert.equal(dualProcComparison.rows[1].diff.effects.proc.rows[0].direction, -1);
const equalSecondaryProfile = {
  ...dualProcProfile,
  items: [dualProcProfile.items[0], {
    ...dualProcProfile.items[1],
    effects: [LC.parser.parseStructuredEffects({ type: 'proc', name: 'Strike of Ice', raw: 'Strike of Ice\n1: Decrease Current HP by 1200' }, 'proc')[0]],
  }],
};
const equalSecondaryComparison = LC.diff.compareCandidate(equalSecondaryProfile, dualProcCandidate, weaponFormula);
assert.equal(equalSecondaryComparison.rows[1].diff.effects.proc.rows[0].status, 'same');
const twoHand = LC.parser.parseOpenDkpJson({
  ItemID: 44, ItemName: 'Two Handed Weapon', Slot: 'Primary', Class: 'ALL', DMG: 220, Delay: 40, HP: 300,
});
const twoHandProfile = { cls: 'Warrior', items: [{ slot: 'Primary', stats: { Damage: 200, Delay: 40, HP: 100 } }] };
assert.equal(LC.diff.compareCandidate(twoHandProfile, dualWeapon, weaponFormula).eligible, false);
const allClassComparison = LC.diff.compareCandidate(twoHandProfile, twoHand, weaponFormula);
assert.equal(allClassComparison.rows.length, 1);
assert.equal(LC.diff.summarizeComparisons(allClassComparison).comparable, true);
assert.equal(LC.parser.normalizeClass('Beastlord'), 'BST');
assert.equal(LC.parser.classMatches('Warrior', ['BST']), false);
assert.equal(LC.parser.classMatches('Warrior', ['ALL']), true);
const wornRange = { slot: 'Range', stats: { HP: 100 } };
const rangeProfile = {
  cls: 'Warrior',
  items: [wornRange, { slot: 'Range', isAugment: true, stats: { Damage: 10 } }],
};
const allClassRange = LC.parser.parseOpenDkpJson({
  ItemID: 87132, ItemName: 'Burning Brand of War', Slot: 'Range', Class: 'ALL', AC: 165, HP: 3560,
});
const rangeComparison = LC.diff.compareCandidate(rangeProfile, allClassRange, weaponFormula);
assert.equal(LC.diff.findWornInSlot(rangeProfile, allClassRange.slotKey).length, 1);
assert.equal(rangeComparison.rows[0].target, wornRange);
assert.equal(LC.diff.summarizeComparisons(rangeComparison).comparable, true);
const raidClasses = ['item', 'Primary', 'Secondary'];
raidClasses.contains = (value) => raidClasses.includes(value);
const parsedRaidWeapon = LC.parser.parseRaidlootNode({
  dataset: { id: '45' },
  textContent: 'Class: BST',
  classList: raidClasses,
  querySelector: () => null,
  querySelectorAll: () => [],
});
assert.equal(parsedRaidWeapon.slotKey.keys.join(','), 'primary,secondary');
assert.equal(parsedRaidWeapon.classes.join(','), 'BST');
const parsedOpenDkpDom = LC.parser.parseOpenDkpDom({
  textContent: 'Dual Weapon\nSlot: Primary, Secondary\nClass: Beastlord\nAC: 10',
  querySelector: () => null,
});
assert.equal(parsedOpenDkpDom.slotKey.keys.join(','), 'primary,secondary');
assert.equal(parsedOpenDkpDom.classes.join(','), 'BST');
const parsedOpenDkpEffects = LC.parser.parseOpenDkpDom({
  textContent: 'Effect Item\nSlot: Head\nFocus Effect: Casting Haste 20%\nProc Effect: Strike of Ice\n1: Decrease Current HP by 2500',
  querySelector: () => null,
});
assert.equal(parsedOpenDkpEffects.effects.map((effect) => effect.type).join(','), 'focus,proc');
assert.match(parsedOpenDkpEffects.effects.find((effect) => effect.type === 'proc').raw, /2500/);
const parsedOpenDkpAugDom = LC.parser.parseOpenDkpDom({
  textContent: 'Bloodied Stone of Might Aug: 7 8 P\nSlot: All except Charm, Secondary, Ammo\nHP: 250',
  querySelector: () => null,
});
assert.equal(parsedOpenDkpAugDom.isAugment, true);
assert.equal(parsedOpenDkpAugDom.augmentTypes.join(','), '7,8');
assert.equal(LC.diff.bestComparisonTarget(
  { stats: { HP: { num: 100 } } },
  [{ stats: { HP: { num: 50 } } }, { stats: {} }],
  LC.diff.SCORE_FORMULAS.find((item) => item.key === 'hp'),
), null);
assert.equal(LC.diff.findWornInSlot({ items: [
  { slot: 'Ear-1' }, { slot: 'Ear-2' }, { slot: 'Head' },
] }, LC.slots.canonicalSlot('Ear')).length, 2);

const raidlootParser = {};
vm.runInNewContext(read('background/raidloot-parser.js') + '\nglobalThis.parseProfileMetadataForTest = parseProfileMetadata; globalThis.parseItemNodeForTest = parseItemNode;', raidlootParser, { filename: 'background/raidloot-parser.js' });
assert.deepEqual(JSON.parse(JSON.stringify(raidlootParser.parseProfileMetadataForTest('Freebus (120 Ranger) - RaidLoot', '', ''))), {
  name: 'Freebus', level: '120', cls: 'Ranger',
});
const iconClasses = ['item', 'Head'];
iconClasses.contains = (value) => iconClasses.includes(value);
const parsedIconItem = raidlootParser.parseItemNodeForTest({
  id: 'item1', dataset: { id: '1' }, textContent: '', classList: iconClasses,
  querySelector(selector) {
    if (selector === '.itemname') return { textContent: 'Icon Test' };
    if (selector === 'img.itemicon') return { getAttribute: () => '//dlil5rqe0ybd2.cloudfront.net/123.png' };
    return null;
  },
  querySelectorAll: () => [],
});
assert.equal(parsedIconItem.icon, 'https://dlil5rqe0ybd2.cloudfront.net/123.png');
const effectLabel = (name, value) => ({
  textContent: name,
  nextSibling: { nodeType: 3, textContent: value, nextSibling: null },
});
const parsedBackgroundEffects = raidlootParser.parseItemNodeForTest({
  dataset: { id: '2' }, classList: iconClasses,
  innerText: 'Background Effect Test\nFocus Effect: Casting Haste 20%\nProc Effect: Flame Damage 25% Proc Rate: +100\n1: Decrease Current HP by 2500',
  textContent: '',
  querySelector(selector) {
    if (selector === '.itemname') return { textContent: 'Background Effect Test' };
    return null;
  },
  querySelectorAll(selector) {
    return selector === 'label' ? [effectLabel('Focus Effect:', 'Casting Haste 20%'), effectLabel('Proc Effect:', 'Flame Damage 25% Proc Rate: +100')] : [];
  },
});
assert.equal(parsedBackgroundEffects.effects.map((effect) => effect.type).join(','), 'focus,proc');
assert.equal(parsedBackgroundEffects.effects[1].name.includes('Flame Damage'), true);
assert.match(parsedBackgroundEffects.effects[1].raw, /Decrease Current HP by 2500/);

const openDkpItem = LC.parser.parseOpenDkpJson({
  ItemID: 42, ItemName: 'Casing Test', Slot: 'Head', HP: 100, Stats: { AC: 50 },
});
assert.equal(LC.parser.canonicalStat('DMG'), 'Damage');
assert.deepEqual(
  { id: openDkpItem.id, name: openDkpItem.name, slot: openDkpItem.slot, hp: openDkpItem.stats.HP.num, ac: openDkpItem.stats.AC.num },
  { id: '42', name: 'Casing Test', slot: 'Head', hp: 100, ac: 50 },
);
assert.equal(LC.diff.SCORE_FORMULAS.some((formula) => formula.key === 'regen'), true);
assert.equal(LC.diff.SCORE_FORMULAS.some((formula) => formula.key === 'manaregen'), true);
const parsedEffects = LC.parser.parseOpenDkpJson({
  ItemID: 53, ItemName: 'Effect Test', Slot: 'Head', HP: 100,
  Effects: { Focus: ['Casting Haste 20%', 'Mana Preservation 15%'], Procs: ['Flame Damage 25%'] },
});
assert.equal(parsedEffects.effects.map((effect) => effect.type).join(','), 'focus,focus,proc');
assert.equal(parsedEffects.effects[0].key, 'focus:haste');
const parsedProcJson = LC.parser.parseOpenDkpJson({
  ItemID: 58, ItemName: 'Proc JSON Test', Slot: 'Primary', HP: 100,
  ProcEffect: 'Strike of Ice (as level 119) Proc Rate: +100\n1: Decrease Current HP by 12000',
});
assert.equal(parsedProcJson.effects.length, 1);
assert.equal(parsedProcJson.effects[0].type, 'proc');
assert.equal(parsedProcJson.effects[0].rank, '119');
assert.match(parsedProcJson.effects[0].raw, /12000/);
const effectCandidate = LC.parser.parseOpenDkpJson({
  ItemID: 54, ItemName: 'Candidate Effects', Slot: 'Head', HP: 120,
  Effects: { Focus: ['Spell Haste 30%', 'Damage Absorption 10%'], Procs: ['Fire Damage 15%'] },
});
const effectProfile = {
  cls: 'Warrior',
  items: [
    { name: 'Old Helm', slot: 'Head', stats: { HP: 100 }, effects: [{ type: 'proc', name: 'Stun II', key: 'proc:stun', rank: 'II', raw: 'Stun II' }] },
    { name: 'Other Focus Item', slot: 'Finger-1', stats: { HP: 10 }, effects: [{ type: 'focus', name: 'Casting Haste 20%', key: 'focus:haste', rank: '20%', raw: 'Casting Haste 20%' }] },
  ],
};
const effectComparison = LC.diff.compareCandidate(effectProfile, effectCandidate, formula);
const focusRows = effectComparison.rows[0].diff.effects.focus.rows;
assert.equal(focusRows.find((row) => row.candidate && row.candidate.key === 'focus:haste').status, 'changed');
assert.equal(focusRows.find((row) => row.candidate && row.candidate.name === 'Damage Absorption 10%').status, 'added');
assert.equal(effectComparison.rows[0].diff.effects.proc.rows[0].status, 'different');
const fuzzyProcCandidate = { name: 'New Weapon', slot: 'Primary', slotKey: LC.slots.canonicalSlot('Primary'), stats: { HP: 110 }, effects: [{ type: 'proc', name: 'Flame Damage 25%', key: 'proc:flame damage', rank: '25%', raw: 'Flame Damage 25%' }] };
const fuzzyProcProfile = { cls: 'Warrior', items: [{ name: 'Old Weapon', slot: 'Primary', stats: { HP: 100 }, effects: [{ type: 'proc', name: 'Fire Damage 15%', key: 'proc:fire damage', rank: '15%', raw: 'Fire Damage 15%' }] }] };
const fuzzyProcRows = LC.diff.compareCandidate(fuzzyProcProfile, fuzzyProcCandidate, formula).rows[0].diff.effects.proc.rows;
assert.equal(fuzzyProcRows.length, 1);
assert.equal(fuzzyProcRows[0].status, 'changed');
const damageProcProfile = { cls: 'Warrior', items: [{
  name: 'Old Sword', slot: 'Primary', stats: { HP: 100 },
  effects: [LC.parser.parseStructuredEffects({ type: 'proc', name: 'Strike of Ice', raw: 'Strike of Ice\n1: Decrease Current HP by 1000' }, 'proc')[0]],
}] };
const damageProcCandidate = {
  name: 'New Sword', slot: 'Primary', slotKey: LC.slots.canonicalSlot('Primary'), stats: { HP: 110 },
  effects: [LC.parser.parseStructuredEffects({ type: 'proc', name: 'Hammer of Magic', raw: 'Hammer of Magic\n1: Decrease Current HP by 1200' }, 'proc')[0]],
};
const damageProcRows = LC.diff.compareCandidate(damageProcProfile, damageProcCandidate, formula).rows[0].diff.effects.proc.rows;
assert.equal(damageProcRows.length, 1);
assert.equal(damageProcRows[0].status, 'changed');
assert.equal(damageProcRows[0].direction, 1);
assert.deepEqual(JSON.parse(JSON.stringify(damageProcRows[0].procComparison)), { current: 1000, candidate: 1200, direction: 1 });
const beneficial100 = LC.parser.parseStructuredEffects('Beneficial Mana Pres 22 L100', 'focus')[0];
const detrimental100 = LC.parser.parseStructuredEffects('Detrimental Mana Pres 22 L100', 'focus')[0];
const beneficialDuration100 = LC.parser.parseStructuredEffects('Beneficial Duration 35 L100', 'focus')[0];
const manaFocusCandidate = LC.parser.parseOpenDkpJson({
  ItemID: 55, ItemName: 'Band of the Victor', Slot: 'Finger', HP: 110,
  Effects: { Focus: ['Beneficial Mana Pres 22 L103'] },
});
const manaFocusProfile = {
  cls: 'Cleric',
  items: [
    { name: 'Azure Ring of the Spiritualist', slot: 'Finger-1', stats: { HP: 100 }, effects: [beneficial100] },
    { name: 'Horrorsilk Mantle', slot: 'Shoulders', stats: { HP: 100 }, effects: [detrimental100] },
    { name: "Lone Walker's Cloak", slot: 'Back', stats: { HP: 100 }, effects: [beneficialDuration100] },
  ],
};
const manaFocusRows = LC.diff.compareCandidate(manaFocusProfile, manaFocusCandidate, formula).rows[0].diff.effects.focus.rows;
assert.equal(manaFocusRows.length, 1);
assert.equal(manaFocusRows[0].status, 'changed');
assert.equal(manaFocusRows[0].current.name.startsWith('Beneficial'), true);
assert.equal(manaFocusRows[0].current.rank, '100');
assert.equal(manaFocusRows[0].candidate.rank, '103');
assert.equal(manaFocusRows[0].direction, 1);
assert.equal(manaFocusRows[0].focusComparison.level, 103);
assert.equal(manaFocusRows[0].focusComparison.current.max, 7);
assert.equal(manaFocusRows[0].focusComparison.candidate.max, 22);
const corruption100 = LC.parser.parseStructuredEffects('Corruption Damage 45-100 L100', 'focus')[0];
const poison100 = LC.parser.parseStructuredEffects('Poison Damage 45-100 L100', 'focus')[0];
const corruptionCandidate = LC.parser.parseOpenDkpJson({
  ItemID: 57, ItemName: 'Beacon of Lost Souls', Slot: 'Range', HP: 110,
  Effects: { Focus: ['Corruption Damage 50-100 L103'] },
});
const corruptionProfile = {
  cls: 'Necromancer',
  items: [
    { name: 'Totem of Inner Tranquility', slot: 'Range', stats: { HP: 100 }, effects: [corruption100] },
    { name: 'Dreadweave Dragonbrood Wristguard', slot: 'Wrist', stats: { HP: 100 }, effects: [poison100] },
  ],
};
const corruptionRows = LC.diff.compareCandidate(corruptionProfile, corruptionCandidate, formula).rows[0].diff.effects.focus.rows;
assert.equal(corruptionRows.length, 1);
assert.equal(corruptionRows[0].current.name.startsWith('Corruption'), true);
assert.equal(corruptionRows[0].direction, 1);
assert.deepEqual(JSON.parse(JSON.stringify(corruptionRows[0].focusComparison)), {
  level: 103,
  current: { min: 30, max: 85 },
  candidate: { min: 50, max: 100 },
  direction: 1,
});
const augmentCoveredProfile = {
  cls: 'Cleric',
  items: [
    { name: 'Old Helm', slot: 'Head', stats: { HP: 100 }, effects: [] },
    { name: 'Type 3 Augment', slot: 'Head', isAugment: true, stats: { HP: 10 }, effects: [beneficial100] },
  ],
};
const augmentIgnoredRows = LC.diff.compareCandidate(augmentCoveredProfile, LC.parser.parseOpenDkpJson({
  ItemID: 56, ItemName: 'New Helm', Slot: 'Head', HP: 110, Effects: { Focus: ['Beneficial Mana Pres 22 L100'] },
}), formula).rows[0].diff.effects.focus.rows;
assert.equal(augmentIgnoredRows[0].status, 'added');
const augCandidate = LC.parser.parseOpenDkpJson({
  ItemID: 50, ItemName: 'Flexible Augment', Slot: 'Ear, Wrist, Finger', Type: 'Augment',
  AugTypes: [7, 8], HP: 60, HPRegen: 2, ManaRegen: 3,
});
assert.equal(augCandidate.augmentTypes.join(','), '7,8');
const augProfile = {
  cls: 'Warrior',
  items: [
    { slot: 'Ear', isAugment: false, stats: { HP: 100 } },
    { name: 'Ear Aug 1', slot: 'Ear', isAugment: true, augmentTypes: [7, 8], augSlot: 1, stats: { HP: 40, Regen: 1 } },
    { name: 'Ear Aug 2', slot: 'Ear', isAugment: true, augmentTypes: [7, 8], augSlot: 2, stats: { HP: 30 } },
    { name: 'Wrist Aug', slot: 'Wrist', isAugment: true, augmentTypes: [7, 8], stats: { HP: 20, Regen: 0 } },
  ],
};
const augComparison = LC.diff.compareCandidate(augProfile, augCandidate, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp'));
assert.equal(augComparison.eligible, true);
assert.equal(augComparison.rows.length, 3);
assert.equal(augComparison.rows[0].isAugment, true);
assert.equal(augComparison.rows[0].target.name, 'Wrist Aug');
assert.equal(augComparison.rows[1].target.name, 'Ear Aug 2');
assert.equal(augComparison.rows[2].target.name, 'Ear Aug 1');
assert.equal(LC.diff.summarizeComparisons(augComparison).score, 40);
assert.match(read('content/shared/ui.js'), /Previous worn augment/);
assert.match(read('content/shared/ui.js'), /Next worn augment/);
assert.equal(LC.diff.compareCandidate({ cls: 'Warrior', items: [augProfile.items[0]] }, augCandidate, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp')).eligible, false);
const typeMismatchProfile = {
  cls: 'Warrior',
  items: [{ slot: 'Ear', isAugment: true, augmentTypes: [3], stats: { HP: 40 } }],
};
assert.equal(LC.diff.compareCandidate(typeMismatchProfile, augCandidate, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp')).eligible, false);
const excludedSecondary = LC.parser.parseOpenDkpJson({
  ItemID: 51, ItemName: 'No Secondary Augment', Slot: 'All except Charm, Secondary, Ammo', Type: 'Augment', HP: 60,
});
assert.equal(excludedSecondary.slotKey.keys.includes('head'), true);
assert.equal(excludedSecondary.slotKey.keys.includes('secondary'), false);
assert.equal(LC.diff.compareCandidate({
  cls: 'Warrior', items: [{ slot: 'Secondary', isAugment: true, stats: { HP: 20 } }],
}, excludedSecondary, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp')).eligible, false);
assert.equal(LC.diff.compareCandidate({
  cls: 'Warrior', items: [{ slot: 'Ear', isAugment: true, stats: { 'Focus Effect': 1 } }],
}, excludedSecondary, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp')).eligible, false);
assert.equal(LC.diff.diffItems(
  { stats: { HP: { num: 250 }, 'Focus Effect': { num: null } } },
  { stats: { 'Focus Effect': { num: 3 } } },
  LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp'),
).comparable, false);
const damageAugment = LC.parser.parseOpenDkpJson({
  ItemID: 52, ItemName: 'Damage Augment', Slot: 'Primary, Secondary', Type: 'Augment', AugTypes: [4, 7, 8], HP: 60, DMG: 20,
});
const damageProfile = {
  cls: 'Warrior',
  items: [
    { slot: 'Primary', isAugment: true, augmentTypes: [4, 7, 8], stats: { HP: 40, Damage: 10 } },
    { slot: 'Secondary', isAugment: true, stats: { HP: 40 } },
  ],
};
const damageComparison = LC.diff.compareCandidate(damageProfile, damageAugment, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp'));
assert.equal(damageComparison.eligible, true);
assert.equal(damageComparison.rows[0].target.slot, 'Primary');
assert.equal(LC.diff.compareCandidate({ cls: 'Warrior', items: [damageProfile.items[1]] }, damageAugment, LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp')).eligible, false);

const bridgeEvents = [];
const bridgeDocument = {
  listeners: {},
  addEventListener(type, listener) {
    (this.listeners[type] || (this.listeners[type] = [])).push(listener);
  },
  dispatchEvent(event) {
    for (const listener of this.listeners[event.type] || []) listener(event);
  },
};
function FakeXHR() { this.listeners = {}; }
FakeXHR.prototype.addEventListener = function (type, listener) {
  (this.listeners[type] || (this.listeners[type] = [])).push(listener);
};
FakeXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
FakeXHR.prototype.send = function () {
  for (const listener of this.listeners.load || []) listener.call(this);
};
class FakeCustomEvent {
  constructor(type, init) { this.type = type; this.detail = init && init.detail; }
}
const bridgeContext = {
  window: null,
  document: bridgeDocument,
  XMLHttpRequest: FakeXHR,
  CustomEvent: FakeCustomEvent,
  TextDecoder,
  URL,
  location: { href: 'https://guild.opendkp.com/' },
  console,
};
let oversizedFetchReads = 0;
let oversizedFetchCanceled = false;
bridgeContext.fetch = (url) => {
  const oversized = /\/45$/.test(url);
  const payload = oversized ? new Uint8Array(512 * 1024 + 1) :
    new TextEncoder().encode(JSON.stringify({ ItemID: 46, ItemName: 'Fetch Casing Test' }));
  return Promise.resolve({
    url,
    clone() {
      return {
        headers: { get() { return null; } },
        body: {
          getReader() {
            let read = false;
            return {
              async read() {
                if (read) return { done: true };
                read = true;
                if (oversized) oversizedFetchReads++;
                return { done: false, value: payload };
              },
              async cancel() {
                if (oversized) oversizedFetchCanceled = true;
              },
            };
          },
        },
      };
    },
  });
};
class TestURL extends URL {
  get origin() { return this.protocol === 'chrome-extension:' ? this.protocol + '//' + this.hostname : super.origin; }
}
const bridgeWindowListeners = {};
const bridgeFrameWindow = { postMessage() {} };
const bridgeFrame = {
  contentWindow: bridgeFrameWindow,
  src: 'https://attacker.test/content/opendkp-consent.html',
};
bridgeContext.addEventListener = (type, listener) => {
  (bridgeWindowListeners[type] || (bridgeWindowListeners[type] = [])).push(listener);
};
bridgeContext.removeEventListener = (type, listener) => {
  bridgeWindowListeners[type] = (bridgeWindowListeners[type] || []).filter((item) => item !== listener);
};
bridgeContext.dispatchEvent = (event) => {
  for (const listener of bridgeWindowListeners[event.type] || []) listener(event);
};
bridgeDocument.getElementById = () => bridgeFrame;
bridgeContext.URL = TestURL;
bridgeContext.window = bridgeContext;
bridgeDocument.addEventListener('loot-captain-opendkp-item-data', (event) => bridgeEvents.push(event));
vm.runInNewContext(read('content/opendkp-page.js'), bridgeContext, { filename: 'content/opendkp-page.js' });
bridgeContext.dispatchEvent({
  type: 'message',
  isTrusted: true,
  source: bridgeFrameWindow,
  origin: 'https://attacker.test',
  data: { type: 'loot-captain-consent-accepted' },
});
const forgedXhr = new FakeXHR();
forgedXhr.responseType = 'json';
forgedXhr.response = { ItemID: 41 };
forgedXhr.open('GET', 'https://guild.opendkp.com/api/items/41');
forgedXhr.send();
assert.equal(bridgeEvents.length, 0);
bridgeFrame.src = 'chrome-extension://test/content/opendkp-consent.html';
bridgeContext.dispatchEvent({
  type: 'message',
  isTrusted: true,
  source: bridgeFrameWindow,
  origin: 'chrome-extension://test',
  data: { type: 'loot-captain-consent-accepted' },
});
const jsonXhr = new FakeXHR();
jsonXhr.responseType = 'json';
jsonXhr.response = { ItemID: 42, ItemName: 'JSON Casing Test' };
jsonXhr.responseText = 'not JSON';
jsonXhr.open('GET', 'https://guild.opendkp.com/api/items/42');
jsonXhr.send();
assert.equal(bridgeEvents.length, 1);
assert.equal(JSON.parse(bridgeEvents[0].detail).data.ItemID, 42);
const oversizedTextXhr = new FakeXHR();
oversizedTextXhr.responseText = JSON.stringify({ ItemID: 43, ItemName: 'x'.repeat(512 * 1024) });
oversizedTextXhr.open('GET', 'https://guild.opendkp.com/api/items/43');
oversizedTextXhr.send();
assert.equal(bridgeEvents.length, 1);
const oversizedJsonXhr = new FakeXHR();
oversizedJsonXhr.responseType = 'json';
oversizedJsonXhr.response = { ItemID: 44, ItemName: 'x'.repeat(512 * 1024) };
oversizedJsonXhr.open('GET', 'https://guild.opendkp.com/api/items/44');
oversizedJsonXhr.send();
assert.equal(bridgeEvents.length, 1);
const oversizedFetch = bridgeContext.fetch('https://guild.opendkp.com/api/items/45');
const validFetch = bridgeContext.fetch('https://guild.opendkp.com/api/items/46');

let workerListener;
const workerStorage = {
  consentVersion: 1,
  profiles: { p: { id: 'p', name: 'Worker Profile', items: [], wishlist: [] } },
};
const workerContext = {
  console,
  URL,
  fetch,
  importScripts() {},
  chrome: {
    runtime: {
      id: 'test',
      onMessage: { addListener(listener) { workerListener = listener; } },
      sendMessage() { return Promise.resolve({ ok: false }); },
    },
    storage: { local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: workerStorage[key] };
        return Object.fromEntries((key || []).map((item) => [item, workerStorage[item]]));
      },
      async set(values) { Object.assign(workerStorage, JSON.parse(JSON.stringify(values))); },
    } },
  },
};
vm.runInNewContext(read('background/raidloot-parser.js'), workerContext, { filename: 'background/raidloot-parser.js' });
vm.runInNewContext(read('background/service-worker.js'), workerContext, { filename: 'background/service-worker.js' });
const sendWorkerMessage = (message, url = 'https://guild.opendkp.com/#/bids') => new Promise((resolve) => {
  workerListener(message, { url }, resolve);
});

assert.match(read('options/options.html'), /id="consent-gate" class="consent-gate hidden"/);
assert.match(read('options/options.js'), /gate\.classList\.add\('hidden'\)/);

const options = { document: { addEventListener() {} } };
vm.runInNewContext(read('options/options.js') + '\nglobalThis.parseInventoryText = parseInventoryText; globalThis.parseInventoryMetadata = parseInventoryMetadata;', options, { filename: 'options/options.js' });
const inventory = options.parseInventoryText([
  'Character: Aurelia',
  'Class: Warrior',
  'Level: 125',
  'Location\tName\tID\tExtra',
  'Ear\tFirst Earring\t11\t',
  'Ear-Slot1\tAugment\t12\t',
  'Head\tCrown\t13\t',
  'Bank\tStored\t14\t',
  'KeyRing',
  'Charm\tAfter Keyring\t15\t',
].join('\n'));
assert.deepEqual(JSON.parse(JSON.stringify(inventory.map(({ name, id, slot }) => ({ name, id, slot })))), [
  { name: 'First Earring', id: '11', slot: 'ear' },
  { name: 'Augment', id: '12', slot: 'ear' },
  { name: 'Crown', id: '13', slot: 'head' },
]);
assert.equal(inventory[1].isAugment, true);
assert.equal(inventory[1].augSlot, 1);
assert.equal(inventory[1].parentId, '11');
assert.deepEqual(JSON.parse(JSON.stringify(options.parseInventoryMetadata([
  'Character: Aurelia',
  'Class: Warrior',
  'Level 125',
].join('\n')))), { name: 'Aurelia', cls: 'Warrior', level: '125' });
assert.deepEqual(JSON.parse(JSON.stringify(options.parseInventoryMetadata([
  'Character Aurelia',
  'Class Warrior',
  'Level 125',
].join('\n')))), { name: 'Aurelia', cls: 'Warrior', level: '125' });

let profiles = { p: { id: 'p', name: 'Original', items: [{ id: '1', name: 'Sword', slot: 'Head', stats: {} }] } };
let saves = 0;
let mode = 'edit';
let firstResolve;
let secondResolve;
let requests = 0;
let unexpectedCalls = 0;
let mockMutationQueue = Promise.resolve();
const stateContext = {
  window: {},
  console,
  chrome: { runtime: { sendMessage: (message) => {
    if (message.type === 'MUTATE_WISHLIST') {
      const mutation = mockMutationQueue.then(() => {
        const state = stateContext.LootCaptain.state;
        const profile = profiles[message.profileId];
        if (!profile) return { ok: false, wanted: false };
        const item = state.normalizeWishlistEntry(message.item);
        const wishlist = (profile.wishlist || []).map((entry) => state.normalizeWishlistEntry(entry));
        const matches = wishlist.map((entry, index) => state.wishlistMatches(entry, item) ? index : -1).filter((index) => index >= 0);
        let wanted = message.action !== 'remove';
        if (message.action === 'toggle' && matches.length) wanted = false;
        let merged = item;
        for (const index of matches) merged = state.normalizeWishlistEntry(merged, wishlist[index]);
        const next = wishlist.filter((entry, index) => !matches.includes(index));
        if (wanted && (message.action !== 'merge' || matches.length)) next.push(merged);
        profiles[message.profileId] = { ...profile, wishlist: next };
        saves++;
        return { ok: true, wanted, entry: wanted ? merged : null, profiles: JSON.parse(JSON.stringify(profiles)) };
      });
      mockMutationQueue = mutation.catch(() => {});
      return mutation;
    }
    if (message.type === 'SAVE_PROFILES') {
      const mutation = mockMutationQueue.then(() => {
        for (const [id, profile] of Object.entries(message.profiles || {})) {
          const expected = message.expectedProfiles && message.expectedProfiles[id];
          const comparable = (value) => { const copy = { ...(value || {}) }; delete copy.wishlist; return copy; };
          if (expected && JSON.stringify(comparable(profiles[id])) !== JSON.stringify(comparable(expected))) continue;
          profiles[id] = { ...(profiles[id] || {}), ...profile,
            wishlist: profiles[id] && profiles[id].wishlist || profile.wishlist || [] };
        }
        for (const id of message.deletedIds || []) delete profiles[id];
        saves++;
        return { ok: true, profiles: JSON.parse(JSON.stringify(profiles)) };
      });
      mockMutationQueue = mutation.catch(() => {});
      return mutation;
    }
    if (mode === 'edit') {
      profiles.p.name = 'Edited';
      return Promise.resolve({ ok: true, items: [{ id: '1', name: 'Sword', slot: 'Head', stats: { HP: 100 }, icon: 'data:image/png;base64,AA==' }] });
    }
    if (mode === 'cache') return Promise.resolve({ ok: true, items: [{ id: '1', name: 'Focus Aug', slot: 'Head', isAugment: true, augmentTypes: [3], stats: { 'Focus Effect': 3 }, effects: [{ type: 'focus', name: 'Spell Haste 10%', raw: 'Spell Haste 10%' }], icon: 'data:image/png;base64,AA==' }] });
    if (mode === 'proc-refresh') return Promise.resolve({ ok: true, items: [{ id: '2', name: 'Old Sword', slot: 'Primary', stats: { HP: 100 }, effects: [{ type: 'proc', name: 'Strike of Ice', raw: 'Strike of Ice (as level 119) Proc Rate: +100' }], icon: 'data:image/png;base64,AA==' }] });
    if (mode === 'no-call') { unexpectedCalls++; return Promise.resolve({ ok: false }); }
    requests++;
    return new Promise((resolve) => {
      if (requests === 1) firstResolve = resolve;
      else secondResolve = resolve;
    });
  } } },
};
stateContext.window = stateContext;
stateContext.LootCaptain = {
  ui: { store: {
    async get(key, fallback) {
      if (key === 'selectedProfileId') return 'p';
      if (key === 'scoreFormula') return 'hp';
      if (key === 'profiles') return JSON.parse(JSON.stringify(profiles));
      return fallback;
    },
    async set(key, value) {
      if (key === 'profiles') { saves++; profiles = JSON.parse(JSON.stringify(value)); }
    },
  } },
};
loadCore(stateContext);
vm.runInNewContext(read('content/shared/state.js'), stateContext, { filename: 'content/shared/state.js' });
const state = stateContext.LootCaptain.state;
const raidlootWish = state.normalizeWishlistEntry({
  raidlootId: '101', name: '  Crown   of Testing ', slot: 'Head', stats: { HP: { num: 100 } }, addedAt: 1,
});
assert.equal(state.wishlistMatches(raidlootWish, { raidlootId: '101' }), true);
assert.equal(state.wishlistMatches(raidlootWish, { raidlootId: '999', name: 'Crown of Testing', slot: 'Head' }), false);
assert.equal(state.wishlistMatches(
  { opendkpHost: 'one.opendkp.com', opendkpId: '22' },
  { opendkpHost: 'two.opendkp.com', opendkpId: '22' },
), false);
assert.equal(state.wishlistMatches(raidlootWish, { name: 'crown of testing', slot: 'head' }), true);
const mergedWish = state.normalizeWishlistEntry({
  opendkpHost: 'Guild.OpenDKP.com', opendkpId: '22', name: 'Crown of Testing', slot: 'Head', stats: { AC: 10 },
}, raidlootWish);
assert.equal(mergedWish.raidlootId, '101');
assert.equal(mergedWish.opendkpHost, 'guild.opendkp.com');
assert.equal(mergedWish.stats.HP, 100);
assert.equal(mergedWish.stats.AC, 10);
const targetProfile = { wishlist: [
  mergedWish,
  state.normalizeWishlistEntry({ raidlootId: '102', name: 'Second Crown', slot: 'Head', stats: { HP: 120 }, addedAt: 2 }),
  state.normalizeWishlistEntry({ raidlootId: '103', name: 'Two Hander', slot: 'Primary', stats: { Damage: 20, Delay: 30 }, addedAt: 3 }),
] };
assert.equal(state.wishlistTargets(targetProfile, { raidlootId: '101', name: 'Crown of Testing', slot: 'Head', stats: { HP: 130 } }).length, 1);
assert.equal(state.wishlistTargets(targetProfile, { name: 'One Hander', slot: 'Primary, Secondary', stats: { Damage: 10, Delay: 20 } }).length, 0);
assert.equal(state.compatibleWishlistItem(
  { isAugment: true, augmentTypes: [7] },
  { isAugment: true, augmentTypes: ['7', '8'] },
), true);

(async () => {
  await Promise.all([oversizedFetch, validFetch]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(oversizedFetchReads, 1);
  assert.equal(oversizedFetchCanceled, true);
  assert.equal(bridgeEvents.length, 2);
  assert.equal(JSON.parse(bridgeEvents[1].detail).data.ItemID, 46);
  await Promise.all([
    sendWorkerMessage({ type: 'MUTATE_WISHLIST', profileId: 'p', action: 'toggle',
      item: { raidlootId: '501', name: 'Queued One', slot: 'Head', stats: { HP: 10 } } }),
    sendWorkerMessage({ type: 'MUTATE_WISHLIST', profileId: 'p', action: 'toggle',
      item: { raidlootId: '502', name: 'Queued Two', slot: 'Face', stats: { HP: 20 } } }, 'https://www.raidloot.com/items/502'),
  ]);
  assert.equal(workerStorage.profiles.p.wishlist.length, 2);
  workerStorage.profiles.p.wishlist.push({
    raidlootId: '', opendkpHost: 'guild.opendkp.com', opendkpId: '601', name: 'Queued One', slot: 'Head',
    isAugment: false, augmentTypes: [], stats: {}, effects: [], addedAt: 2,
  });
  await sendWorkerMessage({ type: 'MUTATE_WISHLIST', profileId: 'p', action: 'merge', item: {
    raidlootId: '501', opendkpHost: 'guild.opendkp.com', opendkpId: '601', name: 'Queued One', slot: 'Head', stats: { AC: 5 },
  } });
  assert.equal(workerStorage.profiles.p.wishlist.length, 2);
  assert.equal(workerStorage.profiles.p.wishlist.find((item) => item.raidlootId === '501').opendkpId, '601');
  await Promise.all([
    sendWorkerMessage({ type: 'SAVE_PROFILES', profiles: { p: { id: 'p', name: 'Saved Profile', items: [] } }, deletedIds: [] },
      'chrome-extension://test/options/options.html'),
    sendWorkerMessage({ type: 'MUTATE_WISHLIST', profileId: 'p', action: 'toggle',
      item: { raidlootId: '503', name: 'Queued Three', slot: 'Neck' } }),
  ]);
  assert.equal(workerStorage.profiles.p.name, 'Saved Profile');
  assert.equal(workerStorage.profiles.p.wishlist.some((item) => item.raidlootId === '503'), true);
  workerStorage.raidlootItemCache = {
    'id:1': { id: '1', name: 'Cached Sword', slot: 'Head', stats: { HP: 100 }, effects: [] },
  };
  const cachedEnrichment = await sendWorkerMessage({ type: 'ENRICH_PROFILE_ITEMS', items: [{ id: '1', name: 'Cached Sword', slot: 'Head' }] },
    'chrome-extension://test/options/options.html');
  assert.equal(cachedEnrichment.ok, true);
  assert.equal(cachedEnrichment.debug[0].source, 'cache');
  assert.equal(cachedEnrichment.items[0].stats.HP, 100);
  await state.getSelectedProfile();
  assert.equal(profiles.p.name, 'Edited');
  assert.equal(saves, 0);

  mode = 'cache';
  profiles = { p: { id: 'p', name: 'Cached', items: [{ id: '1', name: 'Focus Aug', slot: 'Head', isAugment: true, stats: {} }] } };
  const cachedProfile = await state.getSelectedProfile();
  assert.equal(cachedProfile.items[0].icon, 'data:image/png;base64,AA==');
  assert.equal(cachedProfile.items[0].augmentTypes.join(','), '3');
  assert.equal(cachedProfile.items[0].enriched, true);
  assert.equal(cachedProfile.items[0].effects[0].type, 'focus');
  mode = 'no-call';
  await state.getSelectedProfile();
  assert.equal(unexpectedCalls, 0);

  profiles = { p: { id: 'p', name: 'Fast', statsVersion: 4, items: [{
    id: '1', name: 'Sword', slot: 'Head', icon: 'https://cdn.raidloot.com/1.png', stats: { HP: 100 },
  }] } };
  const fastProfile = await state.getSelectedProfile();
  assert.equal(unexpectedCalls, 0);
  assert.equal(fastProfile.items[0].stats.HP.num, 100);

  mode = 'proc-refresh';
  profiles = { p: { id: 'p', name: 'Proc Refresh', statsVersion: 3, items: [{
    id: '2', name: 'Old Sword', slot: 'Primary', icon: 'data:image/png;base64,AA==', enriched: true, stats: { HP: 100 },
  }] } };
  const staleProcProfile = await state.getSelectedProfile();
  assert.equal(staleProcProfile.items[0].effects.length, 0);
  await new Promise((resolve) => setImmediate(resolve));
  const procProfile = await state.getSelectedProfile();
  assert.equal(procProfile.items[0].effects[0].type, 'proc');
  assert.equal(profiles.p.statsVersion, 4);

  mode = 'no-call';
  const untouchedProfile = { id: 'q', name: 'Other', items: [], wishlist: [{ raidlootId: '900', name: 'Other Wish', slot: 'Face', addedAt: 1 }] };
  profiles = { p: { id: 'p', name: 'Wishlist', items: [], wishlist: [] }, q: untouchedProfile };
  await Promise.all([
    state.toggleWishlist({ raidlootId: '201', name: 'First Wish', slot: 'Head', stats: { HP: 10 } }),
    state.toggleWishlist({ raidlootId: '202', name: 'Second Wish', slot: 'Face', stats: { HP: 20 } }),
  ]);
  assert.equal(profiles.p.wishlist.length, 2);
  assert.deepEqual(profiles.q, untouchedProfile);
  await state.mergeWishlistCandidate({
    raidlootId: '201', opendkpHost: 'guild.opendkp.com', opendkpId: '301', name: 'First Wish', slot: 'Head', stats: { AC: 5 },
  });
  const firstWish = profiles.p.wishlist.find((item) => item.raidlootId === '201');
  assert.equal(firstWish.opendkpId, '301');
  assert.equal(firstWish.stats.HP, 10);
  assert.equal(firstWish.stats.AC, 5);
  profiles.p.wishlist = [
    state.normalizeWishlistEntry({ raidlootId: '401', name: 'Bridged Wish', slot: 'Head', addedAt: 1 }),
    state.normalizeWishlistEntry({ opendkpHost: 'guild.opendkp.com', opendkpId: '402', name: 'Bridged Wish', slot: 'Head', addedAt: 2 }),
  ];
  const bridgeWish = { raidlootId: '401', opendkpHost: 'guild.opendkp.com', opendkpId: '402', name: 'Bridged Wish', slot: 'Head' };
  await state.mergeWishlistCandidate(bridgeWish);
  assert.equal(profiles.p.wishlist.length, 1);
  assert.equal(profiles.p.wishlist[0].raidlootId, '401');
  assert.equal(profiles.p.wishlist[0].opendkpId, '402');
  await state.toggleWishlist(bridgeWish);
  assert.equal(profiles.p.wishlist.length, 0);

  mode = 'race';
  profiles = { p: { id: 'p', name: 'Race', items: [{ id: '1', name: 'Sword', slot: 'Head', stats: {} }] } };
  requests = 0;
  const older = state.loadAndCacheProfile();
  const newer = state.loadAndCacheProfile();
  await new Promise((resolve) => setImmediate(resolve));
  secondResolve({ ok: true, items: [{ id: '1', name: 'Sword', slot: 'Head', stats: { HP: 200 } }] });
  await newer;
  firstResolve({ ok: true, items: [{ id: '1', name: 'Sword', slot: 'Head', stats: { HP: 100 } }] });
  await older;
  assert.equal(stateContext.LootCaptain.currentProfile.items[0].stats.HP.num, 200);
  console.log('regression checks passed');
})();
