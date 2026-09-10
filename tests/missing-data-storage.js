'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(file, 'utf8');
const context = {
  console,
  TextEncoder,
  URL,
  fetch: async () => ({ ok: false, status: 503, text: async () => '' }),
  clients: { matchAll: async () => [] },
  importScripts() {},
  chrome: {
    runtime: {
      id: 'test',
      getURL: (value) => 'chrome-extension://test/' + value,
      onMessage: { addListener() {} },
    },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  },
};
context.globalThis = context;
vm.runInNewContext(read('background/raidloot-parser.js'), context, { filename: 'background/raidloot-parser.js' });
vm.runInNewContext(read('background/service-worker.js'), context, { filename: 'background/service-worker.js' });

const parser = context.parserNormalizeStatValue;
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));
same(parser({ raw: '0', num: 0, source: 'raidloot' }), { raw: '0', num: 0, source: 'raidloot' });
same(parser({ raw: '12?', num: null, source: 'opendkp' }), { raw: '12?', num: null, source: 'opendkp' });
same(parser({ num: 0 }, 'legacy'), { raw: '0', num: 0, source: 'legacy' });
same(parser('12junk', 'legacy'), { raw: '12junk', num: null, source: 'legacy' });
same(parser(NaN, 'legacy'), { raw: 'NaN', num: null, source: 'legacy' });

const json = context.parserNormalizeStatValue;
same(json({ raw: 'HP: unavailable', num: null, source: 'opendkp' }), {
  raw: 'HP: unavailable', num: null, source: 'opendkp',
});

const wishlist = context.sanitizeWishlistItem({
  raidlootId: '12', name: 'Unknown Helm', slot: 'Head',
  stats: { HP: { raw: 'not published', num: null, source: 'raidloot' }, AC: { raw: '0', num: 0, source: 'raidloot' } },
});
assert.equal(wishlist.stats.HP.num, null);
assert.equal(wishlist.stats.HP.raw, 'not published');
assert.equal(wishlist.stats.HP.source, 'raidloot');
assert.equal(wishlist.stats.AC.num, 0);

const merged = context.mergeWishlistItem(
  { ...wishlist, stats: { HP: { raw: 'still missing', num: null, source: 'opendkp' } } },
  wishlist,
);
assert.equal(merged.stats.HP.raw, 'still missing');
assert.equal(merged.stats.AC.num, 0);

assert.throws(() => context.sanitizeProfileItem({
  id: '12', name: 'Unresolved Helm', slot: 'Head', stats: { HP: { raw: 'unknown', num: null, source: 'raidloot' } }, effects: [],
}), /unresolved/i);
const safeProfileItem = context.sanitizeProfileItem({
  id: '12', name: 'Unsafe Helm', slot: 'Head', stats: JSON.parse('{"__proto__":{"num":99},"HP":{"raw":"0","num":0}}'), effects: [],
});
assert.equal(safeProfileItem.stats.HP.num, 0);
assert.equal(Object.prototype.hasOwnProperty.call(safeProfileItem.stats, '__proto__'), false);

// Exercise the real editor save, then compare the persisted imported values.
(async () => {
  const page = { window: {} };
  for (const file of ['slots', 'parser', 'diff']) {
    vm.runInNewContext(read('content/shared/' + file + '.js'), page);
  }
  const LC = page.window.LootCaptain;
  const imported = LC.parser.parseOpenDkpJson({ name: 'Imported Helm', slot: 'Head', hp: 0, ac: 'unpublished' });
  const cached = JSON.parse(JSON.stringify(context.trimRaidlootItemCache({ item: imported }))).item;
  const stored = context.sanitizeProfileItem({ ...cached, id: '12' });
  const controls = {
    '#profile-name': { value: 'Test' }, '#profile-class': { value: 'Warrior' },
    '#profile-level': { value: '125' }, '#editor-title': {},
    '#btn-delete-profile': { classList: { remove() {} } },
  };
  let saved;
  const editor = {
    document: { addEventListener() {}, querySelector: (key) => controls[key] },
    chrome: {
      runtime: { sendMessage: async (message) => {
        saved = JSON.parse(JSON.stringify(message.profiles));
        return { ok: true, profiles: saved };
      } },
      storage: { local: { set: async () => {} } },
    },
    fixture: { ...stored, effectsKnown: true, effects: [{ type: 'worn', name: 'Vigor', raw: 'Vigor', provenance: 'opendkp' }], stats: { ...stored.stats, END: { raw: '', num: null, source: 'manual' },
      MANA: { raw: '', num: 0, source: 'manual' } } },
  };
  vm.runInNewContext(read('content/shared/diff.js') + '\n' + read('options/options.js'), editor);
  await vm.runInNewContext(`editingId = 'p';
    editingProfile = { id: 'p', items: [fixture], wishlist: [] };
    profiles = { p: editingProfile };
    renderEditorProfileSelector = () => {};
    globalThis.refreshCharacterDataStatus = () => {};
    saveProfile();`, editor);
  assert.equal(saved.p.items[0].effectsKnown, true);
  assert.equal(saved.p.items[0].effects[0].provenance, 'opendkp');
  assert.equal(saved.p.items[0].stats.HP.source, 'opendkp');
  assert.equal(saved.p.items[0].stats.HP.num, 0);
  assert.equal(saved.p.items[0].stats.AC.raw, 'unpublished');
  assert.equal(saved.p.items[0].stats.AC.num, null);
  assert.equal(saved.p.items[0].stats.END.num, null);
  assert.equal(saved.p.items[0].stats.MANA.num, 0);
  const comparison = LC.diff.diffItems(saved.p.items[0], { stats: { HP: 10, AC: 5 } },
    LC.diff.SCORE_FORMULAS[0]);
  assert.equal(comparison.diffs.HP.delta, -10);
  assert.equal(comparison.diffs.AC.delta, null);
  assert.equal(comparison.numericScoreAvailable, false);
  for (const raw of ['unavailable 999', '12oops']) {
    const dom = LC.parser.parseOpenDkpDom({ textContent: 'Helm\nHP: ' + raw, querySelector: () => null });
    assert.equal(dom.stats.HP.num, null);
    assert.match(dom.stats.HP.raw, new RegExp(raw));
  }
  const safe = LC.parser.normalizeStats(JSON.parse('{"__proto__: ":{"num":99},"constructor":{"num":99},"HP":0}'));
  assert.deepEqual(Object.keys(safe), ['HP']);
  console.log('missing-data-storage: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
