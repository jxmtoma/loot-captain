'use strict';

// Controlled async interleavings use the actual options refresh/delete code and
// the actual service-worker save queue. Storage and handles are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const clone = value => JSON.parse(JSON.stringify(value));
const read = name => fs.readFileSync(name, 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const exportText = 'Location\tName\tID\tExtra\nHead\tNew Helm\t21\t';
const original = { id: 'p', name: 'Synthetic', importedFrom: 'Synthetic_test-Inventory.txt',
  cls: 'Warrior', items: [{ id: '1', name: 'Old Helm', slot: 'Head', stats: {} }],
  wishlist: [{ name: 'Wanted Helm' }], scoreFormula: { key: 'custom', version: 1 } };

function fixture(hooks = {}, sourceRoot = '.') {
  const data = { profiles: { p: clone(original), q: { ...clone(original), id: 'q', name: 'Other' } } };
  const handles = new Map();
  const status = { textContent: 'Other editor status' };
  const worker = {
    console, TextEncoder, URL, importScripts() {},
    chrome: { runtime: { onMessage: { addListener() {} } },
      storage: { local: {
        get: async key => ({ [key]: clone(data[key] === undefined ? null : data[key]) }),
        set: async values => { Object.assign(data, clone(values)); },
      } } },
  };
  // Missing storage keys behave like Chrome, rather than returning null.
  worker.chrome.storage.local.get = async key => data[key] === undefined ? {} : { [key]: clone(data[key]) };
  vm.runInNewContext(read(path.join(sourceRoot, 'background/service-worker.js')), worker);
  const handle = {
    name: original.importedFrom,
    requestPermission: async () => hooks.permission || 'granted',
    getFile: async () => {
      if (hooks.missing) throw new Error('file not found');
      return file;
    },
  };
  const file = { name: hooks.filename || original.importedFrom,
    text: async () => {
      if (hooks.read) { hooks.read.entered.resolve(); return hooks.read.promise; }
      return hooks.empty ? '' : exportText;
    } };
  const page = {
    document: { addEventListener() {}, querySelector: () => status },
    confirm: () => hooks.confirm !== false,
    setTimeout() {},
    chrome: {
      storage: { local: { set: async values => Object.assign(data, clone(values)) } },
      runtime: { sendMessage: async message => {
        if (message.type === 'SAVE_PROFILES') {
          if (hooks.saveError && !message.deletedIds.length) throw new Error('save failed');
          const result = await worker.saveProfiles(clone(message.profiles), clone(message.deletedIds));
          if (hooks.save && !message.deletedIds.length) {
            hooks.save.entered.resolve(); await hooks.save.promise;
          }
          return { ok: true, profiles: result };
        }
        if (message.type === 'ENRICH_PROFILE_ITEMS') {
          if (hooks.enrich) { hooks.enrich.entered.resolve(); await hooks.enrich.promise; }
          return { ok: true, items: message.items };
        }
        throw new Error('Unexpected message: ' + message.type);
      } },
    },
    state: clone(data.profiles),
    picked: async () => {
      if (hooks.pick) { hooks.pick.entered.resolve(); await hooks.pick.promise; }
      return hooks.cancel ? null : { file, handle };
    },
    handleStore: async (mode, run) => run({
      get: id => handles.get(id),
      delete: id => handles.delete(id),
      put: async (value, id) => {
        if (hooks.put) { hooks.put.entered.resolve(); await hooks.put.promise; }
        handles.set(id, value);
      },
    }),
  };
  vm.runInNewContext(read(path.join(sourceRoot, 'content/shared/diff.js')) + '\n' +
    read(path.join(sourceRoot, 'options/options.js')), page);
  vm.runInNewContext(
    'profiles = state; compareIds = ["p"]; renderProfileList = () => {}; ' +
    'updateRaidlootRefreshButton = () => {}; renderItemList = () => {}; ' +
    'appendDebugLog = () => {}; inventoryHandleStore = handleStore; ' +
    'pickInventoryFile = picked; ' +
    'editingId = "p"; editingProfile = profiles.p; ' +
    'globalThis.inspect = () => ({ profiles, editingProfile, refreshingProfileId }); ' +
    'globalThis.switchEditor = () => { editingId = "q"; editingProfile = profiles.q; };',
    page);
  return { page, data, handles, status, handle };
}
function gate() { return { ...deferred(), entered: deferred() }; }
async function deletion(stage, sourceRoot = '.', expectResurrection = false) {
  const pause = gate();
  const f = fixture({ [stage]: pause }, sourceRoot);
  const refresh = f.page.refreshProfileFromFile('p');
  await pause.entered.promise;
  await f.page.deleteProfileById('p');
  pause.resolve(exportText);
  await refresh;
  assert.equal(!!f.data.profiles.p, expectResurrection, stage + ': persisted deletion');
  assert.equal(!!f.page.inspect().profiles.p, expectResurrection, stage + ': local deletion');
  assert.equal(f.handles.has('p'), expectResurrection, stage + ': remembered handle');
  assert.equal(f.page.inspect().refreshingProfileId, '');
}

(async () => {
  if (process.argv[2] === '--prove-original') {
    await deletion('read', process.argv[3], true);
    await deletion('enrich', process.argv[3], true);
    console.log('pristine main reproduced profile resurrection under controlled read/enrichment delays');
    return;
  }
  for (const stage of ['pick', 'read', 'enrich', 'save', 'put']) await deletion(stage);
  for (const stage of ['pick', 'read', 'enrich']) {
    const pause = gate(), f = fixture({ [stage]: pause });
    const refresh = f.page.refreshEditorFromFile();
    await pause.entered.promise;
    f.page.switchEditor();
    pause.resolve(exportText);
    await refresh;
    assert.equal(f.page.inspect().editingProfile.id, 'q');
    assert.equal(f.page.inspect().editingProfile.items[0].name, 'Old Helm');
    assert.equal(f.status.textContent, 'Other editor status', stage + ': switched editor status');
  }
  {
    const pause = gate(), f = fixture({ read: pause });
    const refresh = f.page.refreshEditorFromFile();
    await pause.entered.promise;
    f.page.switchEditor();
    pause.reject(new Error('late file error'));
    await refresh;
    assert.equal(f.status.textContent, 'Other editor status');
  }
  for (const hooks of [{ cancel: true }, { filename: 'Other.txt', confirm: false }]) {
    const f = fixture(hooks);
    assert.equal(await f.page.refreshProfileFromFile('p'), null);
    assert.equal(f.data.profiles.p.items[0].name, 'Old Helm');
    assert.equal(f.handles.size, 0);
  }
  for (const hooks of [{ permission: 'denied' }, { missing: true }]) {
    const f = fixture(hooks);
    f.handles.set('p', f.handle);
    await assert.rejects(f.page.refreshProfileFromFile('p'), /Could not reopen/);
    assert.equal(f.handles.has('p'), false);
    assert.equal(f.data.profiles.p.items[0].name, 'Old Helm');
  }
  for (const hooks of [{ empty: true }, { saveError: true }]) {
    const f = fixture(hooks);
    await assert.rejects(f.page.refreshProfileFromFile('p'), /No worn equipment|save failed/);
    assert.equal(f.data.profiles.p.items[0].name, 'Old Helm');
    assert.equal(f.page.inspect().profiles.p.items[0].name, 'Old Helm');
    assert.equal(f.page.inspect().refreshingProfileId, '');
  }
  {
    const f = fixture();
    const update = await f.page.refreshProfileFromFile('p');
    assert.equal(update.items[0].name, 'New Helm');
    assert.equal(f.data.profiles.p.items[0].name, 'New Helm');
    assert.equal(f.data.profiles.p.wishlist[0].name, 'Wanted Helm');
    assert.equal(f.handles.has('p'), true);
  }
  console.log('inventory file refresh: actual worker queue, deletion, switching, failure and recovery checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
