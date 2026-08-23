'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(file, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.permissions.includes('scripting'), false);
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
const twoHand = LC.parser.parseOpenDkpJson({
  ItemID: 44, ItemName: 'Two Handed Weapon', Slot: 'Primary', Class: 'ALL', DMG: 220, Delay: 40, HP: 300,
});
const twoHandProfile = { cls: 'Warrior', items: [{ slot: 'Primary', stats: { Damage: 200, Delay: 40, HP: 100 } }] };
assert.equal(LC.diff.compareCandidate(twoHandProfile, dualWeapon, weaponFormula).eligible, false);
assert.equal(LC.diff.compareCandidate(twoHandProfile, twoHand, weaponFormula).rows.length, 1);
assert.equal(LC.parser.normalizeClass('Beastlord'), 'BST');
assert.equal(LC.parser.classMatches('Warrior', ['BST']), false);
assert.equal(LC.parser.classMatches('Warrior', ['ALL']), true);
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
    if (selector === 'img.itemicon') return { getAttribute: () => '//cdn.raidloot.com/123.png' };
    return null;
  },
  querySelectorAll: () => [],
});
assert.equal(parsedIconItem.icon, 'https://cdn.raidloot.com/123.png');

const openDkpItem = LC.parser.parseOpenDkpJson({
  ItemID: 42, ItemName: 'Casing Test', Slot: 'Head', HP: 100, Stats: { AC: 50 },
});
assert.equal(LC.parser.canonicalStat('DMG'), 'Damage');
assert.deepEqual(
  { id: openDkpItem.id, name: openDkpItem.name, slot: openDkpItem.slot, hp: openDkpItem.stats.HP.num, ac: openDkpItem.stats.AC.num },
  { id: '42', name: 'Casing Test', slot: 'Head', hp: 100, ac: 50 },
);

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
  { name: 'Crown', id: '13', slot: 'head' },
]);
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
const stateContext = {
  window: {},
  console,
  chrome: { runtime: { sendMessage: () => {
    if (mode === 'edit') {
      profiles.p.name = 'Edited';
      return Promise.resolve({ ok: true, items: [{ id: '1', name: 'Sword', slot: 'Head', stats: { HP: 100 } }] });
    }
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

(async () => {
  await Promise.all([oversizedFetch, validFetch]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(oversizedFetchReads, 1);
  assert.equal(oversizedFetchCanceled, true);
  assert.equal(bridgeEvents.length, 2);
  assert.equal(JSON.parse(bridgeEvents[1].detail).data.ItemID, 46);
  await state.getSelectedProfile();
  assert.equal(profiles.p.name, 'Edited');
  assert.equal(saves, 0);

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
