// Loot Captain - options page (profile manager)

const PROFILES_KEY = 'profiles';
const COMPARE_KEY = 'compareProfileIds';
const SCORE_KEY = 'scoreFormula';
const WISHLIST_STYLE_KEY = 'wishlistStyle';
const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;
const PROFILE_STATS_VERSION = 4;
const DEFAULT_FORMULA_KEY = (typeof window === 'undefined' ? globalThis : window).LootCaptain.diff.DEFAULT_FORMULA_KEY;
const ICON_URL_PATTERN = /^(?:data:image\/|https:\/\/(?:cdn\.raidloot\.com|dlil5rqe0ybd2\.cloudfront\.net)\/)/i;
const SCORE_FORMULAS = (typeof window === 'undefined' ? globalThis : window).LootCaptain.diff.SCORE_FORMULAS;
const EVERQUEST_CLASSES = [
  ['Bard', 'BRD'], ['Beastlord', 'BST'], ['Berserker', 'BER'], ['Cleric', 'CLR'],
  ['Druid', 'DRU'], ['Enchanter', 'ENC'], ['Magician', 'MAG'], ['Monk', 'MNK'],
  ['Necromancer', 'NEC'], ['Paladin', 'PAL'], ['Ranger', 'RNG'], ['Rogue', 'ROG'],
  ['Shadowknight', 'SHD'], ['Shaman', 'SHM'], ['Warrior', 'WAR'], ['Wizard', 'WIZ'],
];

// ---------- Slot canonicalization (mirrors content/shared/slots.js) ----------
const EQUIPMENT_SLOTS = [
  'charm', 'ear', 'head', 'face', 'neck', 'shoulders', 'arms', 'back',
  'wrist', 'range', 'hands', 'primary', 'finger', 'chest', 'legs', 'feet',
  'waist', 'secondary', 'powersource',
];

// ---------- State ----------
let profiles = {};   // { id: { id, name, cls, level, items: [] } }
let compareIds = []; // characters picked for comparison (see popup multi-select)
let scoreFormula = DEFAULT_FORMULA_KEY;
let editingId = null; // null = list view, 'new' = creating, else editing that id
let editingProfile = null; // working copy while editing
let itemsEditable = false;
let selectedItemIndex = 0;
let selectedFocusIndex = 0;
let activeInventoryTab = 'equipment';
let wishlistStyle = 'slots';
let refreshingProfileId = '';

// ---------- Storage ----------
async function loadAll() {
  const res = await chrome.storage.local.get([PROFILES_KEY, COMPARE_KEY, SCORE_KEY, WISHLIST_STYLE_KEY]);
  profiles = res[PROFILES_KEY] || {};
  compareIds = Array.isArray(res[COMPARE_KEY]) ? res[COMPARE_KEY] : [];
  wishlistStyle = res[WISHLIST_STYLE_KEY] === 'list' ? 'list' : 'slots';
  scoreFormula = SCORE_FORMULAS.some((formula) => formula.key === res[SCORE_KEY]) ? res[SCORE_KEY] : DEFAULT_FORMULA_KEY;
}
async function saveAll(changedIds = [], deletedIds = []) {
  if (changedIds.length || deletedIds.length) {
    const records = Object.fromEntries(changedIds.filter((id) => profiles[id]).map((id) => [id, profiles[id]]));
    const response = await chrome.runtime.sendMessage({ type: 'SAVE_PROFILES', profiles: records, deletedIds });
    if (!response || !response.ok) throw new Error(response && response.error || 'Could not save profiles');
    profiles = response.profiles || profiles;
  }
}


function appendDebugLog(entries) {
  const log = $('#debug-log');
  if (!log || !Array.isArray(entries) || !entries.length) return;
  const existing = log.textContent === 'No diagnostics yet.' ? '' : log.textContent;
  const lines = entries.map((entry) => {
    const target = [entry.name || 'Unnamed item', entry.id ? 'ID ' + entry.id : 'no ID'].join(' · ');
    const detail = [entry.source, entry.message].filter(Boolean).join(': ');
    const stats = entry.statCount != null ? ', ' + entry.statCount + ' stats' : '';
    return target + ' → ' + (entry.result || 'unknown') + stats + (detail ? ' (' + detail + ')' : '');
  });
  log.textContent = [existing, ...lines].filter(Boolean).join('\n');
  if (entries.some((entry) => entry.result !== 'loaded')) $('#debug-details').open = true;
}

// ---------- DOM helpers ----------
function $(sel) { return document.querySelector(sel); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderFormulaSelect() {
  const select = $('#score-formula');
  if (!select) return;
  select.replaceChildren();
  for (const formula of SCORE_FORMULAS) {
    const option = el('option', '', formula.label);
    option.value = formula.key;
    select.appendChild(option);
  }
  select.value = scoreFormula;
  select.addEventListener('change', async () => {
    scoreFormula = select.value;
    await chrome.storage.local.set({ [SCORE_KEY]: scoreFormula });
  });
}

function renderCharacterFormula() {
  const select = $('#character-formula');
  if (!select || !editingProfile) return;
  const scoring = (typeof window === 'undefined' ? globalThis : window).LootCaptain.diff;
  const resolved = scoring.resolveFormula(editingProfile, scoreFormula);
  select.replaceChildren(...SCORE_FORMULAS.map((formula) => {
    const option = el('option', '', formula.label + ' (' + formula.key + ' v' + formula.version + ')');
    option.value = formula.key;
    return option;
  }));
  select.value = resolved.key;
  $('#character-formula-status').textContent = resolved.warning || '';
  select.onchange = async () => {
    const id = editingId;
    const formula = SCORE_FORMULAS.find((entry) => entry.key === select.value);
    const choice = { key: formula.key, version: formula.version };
    try {
      if (id !== 'new') {
        const result = await chrome.runtime.sendMessage({ type: 'SET_PROFILE_FORMULA', profileId: id, formula: choice });
        if (!result || !result.ok) throw new Error(result && result.error || 'Could not save formula');
      }
      if (editingId === id) { editingProfile.scoreFormula = choice; renderCharacterFormula(); }
    } catch (error) {
      if (editingId === id) { renderCharacterFormula(); $('#character-formula-status').textContent = error.message; }
    }
  };
}

function normalizeClassName(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const match = EVERQUEST_CLASSES.find(([name, abbreviation]) =>
    [name, abbreviation].some((candidate) => candidate.toLowerCase() === key));
  return match ? match[0] : '';
}

function renderClassSelect() {
  const select = $('#profile-class');
  if (!select) return;
  select.replaceChildren(el('option', '', '- select class -'), ...EVERQUEST_CLASSES.map(([name]) => el('option', '', name)));
  select.options[0].value = '';
}

// ---------- View: profile list ----------
function renderProfileList() {
  const list = $('#profile-list');
  list.innerHTML = '';
  const ids = Object.keys(profiles);
  if (!ids.length) {
    list.appendChild(el('div', 'empty-state', 'No characters yet. Click "+ New Character" to create one.'));
    return;
  }
  for (const id of ids) {
    const p = profiles[id];
    const card = el('div', 'profile-card');
    const info = el('div', 'profile-info');
    info.appendChild(el('span', 'profile-name', p.name || 'Unnamed'));
    const metaParts = [];
    if (p.cls) metaParts.push(p.cls);
    if (p.level) metaParts.push('Lv ' + p.level);
    if (metaParts.length) info.appendChild(el('span', 'profile-meta', metaParts.join(' · ')));
    info.appendChild(el('span', 'profile-items', (p.items || []).length + ' items'));
    card.appendChild(info);

    const actions = el('div', 'profile-actions');
    const manageBtn = el('button', 'btn btn-small profile-manage', 'Manage');
    manageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditor(id);
    });
    actions.appendChild(manageBtn);
    // Fresh from RaidLoot: re-pull worn items for profiles imported from a
    // RaidLoot profile, without opening the editor.
    const raidlootId = raidlootImportedProfileId(p.importedFrom);
    if (raidlootId) {
      const refreshBtn = el('button', 'btn btn-small profile-refresh-raidloot', 'Fresh from RaidLoot');
      refreshBtn.setAttribute('aria-label', 'Refresh worn equipment and augment data from RaidLoot for ' + (p.name || 'this character'));
      refreshBtn.disabled = refreshingProfileId === id;
      refreshBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await refreshProfileFromList(id, refreshBtn, raidlootId);
      });
      actions.appendChild(refreshBtn);
    }
    // Compare toggle, mirroring the popup's character selection.
    const compareLabel = el('label', 'profile-compare');
    const compareBox = document.createElement('input');
    compareBox.type = 'checkbox';
    compareBox.checked = compareIds.includes(id);
    compareLabel.appendChild(compareBox);
    compareLabel.appendChild(document.createTextNode('Compare'));
    compareLabel.addEventListener('click', (e) => e.stopPropagation());
    compareLabel.addEventListener('change', async () => {
      compareIds = compareBox.checked ? [...compareIds.filter((cid) => cid !== id), id] : compareIds.filter((cid) => cid !== id);
      await chrome.storage.local.set({ [COMPARE_KEY]: compareIds });
      renderProfileList();
    });
    actions.appendChild(compareLabel);
    const deleteBtn = el('button', 'btn btn-small btn-danger profile-delete', 'Delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (await deleteProfileById(id)) renderProfileList();
    });
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    card.addEventListener('click', () => openEditor(id));
    list.appendChild(card);
  }
}

function renderEditorProfileSelector() {
  const select = $('#editor-profile-select');
  if (!select) return;
  select.replaceChildren();
  const ids = Object.keys(profiles);
  const placeholder = el('option', '', ids.length ? 'Choose a character' : 'No saved characters');
  placeholder.value = '';
  placeholder.disabled = ids.length > 0;
  select.appendChild(placeholder);
  for (const id of ids) {
    const profile = profiles[id];
    const meta = [profile.cls, profile.level && 'Lv ' + profile.level].filter(Boolean).join(' · ');
    const option = el('option', '', [profile.name || 'Unnamed', meta].filter(Boolean).join(' — '));
    option.value = id;
    select.appendChild(option);
  }
  select.value = editingId === 'new' ? '' : editingId;
  select.onchange = async () => {
    if (!select.value) return;
    await openEditor(select.value);
  };
  const newButton = $('#btn-editor-new-profile');
  if (newButton) newButton.onclick = () => openEditor('new');
}

async function deleteProfileById(id) {
  if (!profiles[id] || !confirm('Delete ' + (profiles[id].name || 'this character') + '?')) return false;
  delete profiles[id];
  compareIds = compareIds.filter((cid) => cid !== id);
  await saveAll([], [id]);
  await chrome.storage.local.set({ [COMPARE_KEY]: compareIds });
  return true;
}

// ---------- View: editor ----------
async function openEditor(id) {
  editingId = id;
  itemsEditable = false;
  selectedItemIndex = 0;
  selectedFocusIndex = 0;
  activeInventoryTab = 'equipment';
  if (id === 'new') {
    editingProfile = { id: '', name: '', cls: '', level: '', items: [], wishlist: [] };
    $('#editor-title').textContent = 'New Character';
    $('#btn-delete-profile').classList.add('hidden');
  } else {
    const p = profiles[id];
    editingProfile = {
      id: p.id,
      name: p.name || '',
      cls: normalizeClassName(p.cls),
      level: p.level || '',
      server: p.server || '',
      characterData: p.characterData || null,
      statsVersion: p.statsVersion || 0,
      importedFrom: p.importedFrom || '',
      scoreFormula: p.scoreFormula,
      lastEquip: p.lastEquip || null,
      wishlist: Array.isArray(p.wishlist) ? p.wishlist.map((item) => ({ ...item })) : [],
      items: (p.items || []).map((it) => ({
        id: it.id || '',
        name: it.name || '',
        icon: it.icon || '',
        slot: it.slot || '',
        isAugment: !!it.isAugment,
        augmentTypes: Array.isArray(it.augmentTypes) ? [...it.augmentTypes] : [],
        augSlot: it.augSlot || '',
        parentId: it.parentId || '',
        enriched: !!it.enriched,
        stats: Object.assign({}, it.stats || {}),
        effects: Array.isArray(it.effects) ? it.effects.map((effect) => ({ ...effect })) : [],
        effectsKnown: it.effectsKnown === true,
      })),
    };
    $('#editor-title').textContent = 'Edit: ' + (p.name || 'Unnamed');
    $('#btn-delete-profile').classList.remove('hidden');
  }
  $('#profile-list-section').classList.add('hidden');
  $('#profile-editor-section').classList.remove('hidden');
  renderEditorProfileSelector();
  renderEditor();
  renderCharacterFormula();
  renderCharacterData();
  await loadEditorStats(editingProfile);
}

function closeEditor() {
  editingId = null;
  editingProfile = null;
  itemsEditable = false;
  selectedItemIndex = 0;
  $('#profile-editor-section').classList.add('hidden');
  $('#profile-list-section').classList.remove('hidden');
  renderProfileList();
}

function renderEditor() {
  updateRaidlootRefreshButton();
  $('#profile-name').value = editingProfile.name;
  $('#profile-class').value = editingProfile.cls;
  $('#profile-level').value = editingProfile.level;
  $('#profile-server').value = editingProfile.server || '';
  $('#profile-name').oninput = renderInventoryPreview;
  $('#profile-class').onchange = renderInventoryPreview;
  $('#profile-level').oninput = renderInventoryPreview;
  renderWishlist();
  renderItemList();
}

async function removeWishlistItem(item) {
  if (!editingId || editingId === 'new') return;
  const response = await chrome.runtime.sendMessage({
    type: 'MUTATE_WISHLIST', profileId: editingId, action: 'remove', item,
  });
  if (!response || !response.ok) throw new Error(response && response.error || 'Could not update wishlist');
  profiles = response.profiles || profiles;
  editingProfile.wishlist = (profiles[editingId] && profiles[editingId].wishlist || []).map((entry) => ({ ...entry }));
  renderWishlist();
}

// The wishlist lives in the inventory tab strip, so it re-renders through the
// preview rather than owning a section of its own.
function renderWishlist() {
  if (activeInventoryTab === 'wishlist') renderInventoryPreview();
}

// Undo lives here rather than on the item page: on a page it would be permanent
// furniture, and it would quietly retarget whenever something else is equipped.
function renderLastEquip() {
  const host = $('#last-equip');
  if (!host) return;
  const record = editingProfile && editingProfile.lastEquip;
  const equipped = record && record.item && record.item.name;
  host.hidden = !equipped;
  if (!equipped) return;
  const restores = record.previous && record.previous.name;
  host.replaceChildren(
    el('span', 'last-equip-text', restores
      ? 'Last equip: ' + restores + ' → ' + record.item.name
      : 'Last equip: added ' + record.item.name),
  );
  const undo = el('button', 'btn btn-small', 'Undo');
  undo.type = 'button';
  undo.setAttribute('aria-label', restores
    ? 'Undo the last equip, restoring ' + restores
    : 'Undo the last equip, removing ' + record.item.name);
  undo.addEventListener('click', async () => {
    undo.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'UNDO_EQUIP', profileId: editingProfile.id });
      if (!response || !response.ok) throw new Error(response && response.error || 'Undo failed');
      await loadAll();
      await openEditor(editingProfile.id);
    } catch (e) {
      undo.disabled = false;
      undo.title = 'Could not undo the last equip';
    }
  });
  host.appendChild(undo);
}

// Wishlist entries laid out on the slot grid, so an empty slot reads as "still
// nothing wanted here". Kept separate from makeSlot, which is tied to item
// indices, augment parenting and selection that wishlist entries do not have.
function wishlistSlotGrid() {
  const grouped = {};
  for (const entry of (editingProfile.wishlist || [])) {
    const root = slotRoot(normalizeEditorSlot(entry.slot || ''));
    (grouped[root] || (grouped[root] = [])).push(entry);
  }
  return INVENTORY_SLOT_LAYOUT.map(({ slot, label, column, row }) => {
    const root = slotRoot(slot);
    const pairedIndex = /-[12]$/.test(slot) ? Number(slot.slice(-1)) - 1 : -1;
    const all = grouped[root] || [];
    const entries = pairedIndex >= 0 ? (all[pairedIndex] ? [all[pairedIndex]] : []) : all;
    const box = el('div', 'gear-slot wishlist-gear-slot' + (entries.length ? ' filled' : ''));
    box.style.gridColumn = column;
    box.style.gridRow = row;
    const names = entries.map((entry) => entry.name || 'Unnamed item').join(' / ');
    box.title = entries.length ? label + ' wanted: ' + names : 'Nothing wishlisted for ' + label;
    const glyph = el('span', 'gear-glyph', SLOT_ICONS[root] || '✦');
    glyph.setAttribute('aria-hidden', 'true');
    box.appendChild(glyph);
    const text = el('div', 'gear-slot-text');
    text.appendChild(el('span', 'gear-slot-label', label));
    text.appendChild(el('span', 'gear-slot-name', entries.length ? names : 'Nothing wanted'));
    box.appendChild(text);
    return box;
  });
}

function wishlistRows() {
  const wishlist = Array.isArray(editingProfile && editingProfile.wishlist) ? editingProfile.wishlist : [];
  if (!wishlist.length) return [el('div', 'wishlist-empty', 'No wishlist items yet.')];
  return wishlist.map((item) => {
    const row = el('div', 'wishlist-row');
    const info = el('div', 'wishlist-item');
    info.appendChild(el('span', 'wishlist-name', item.name || 'Unnamed item'));
    info.appendChild(el('span', 'wishlist-slot', item.slot || 'Unknown slot'));
    const actions = el('div', 'wishlist-actions');
    const details = el('a', 'btn-remove wishlist-details', 'Details');
    details.href = item.raidlootId
      ? 'https://www.raidloot.com/items/' + encodeURIComponent(item.raidlootId)
      : 'https://www.raidloot.com/items?name=' + encodeURIComponent(item.name || '');
    details.target = '_blank';
    details.rel = 'noopener';
    details.setAttribute('aria-label', 'View ' + (item.name || 'item') + ' details on RaidLoot');
    const remove = el('button', 'btn-remove wishlist-remove', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove ' + (item.name || 'item') + ' from wishlist');
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await removeWishlistItem(item);
      } catch (e) {
        remove.title = 'Could not update wishlist';
      } finally {
        remove.disabled = false;
      }
    });
    actions.append(details, remove);
    row.append(info, actions);
    return row;
  });
}

const INVENTORY_SLOT_LAYOUT = [
  { slot: 'ear-1', label: 'Left Ear', column: 2, row: 1 },
  { slot: 'head', label: 'Head', column: 3, row: 1 },
  { slot: 'face', label: 'Face', column: 4, row: 1 },
  { slot: 'ear-2', label: 'Right Ear', column: 5, row: 1 },
  { slot: 'neck', label: 'Neck', column: 6, row: 2 },
  { slot: 'back', label: 'Back', column: 6, row: 3 },
  { slot: 'shoulders', label: 'Shoulder', column: 6, row: 4 },
  { slot: 'wrist-2', label: 'Right Wrist', column: 6, row: 5 },
  { slot: 'feet', label: 'Feet', column: 5, row: 6 },
  { slot: 'charm', label: 'Charm', column: 4, row: 6 },
  { slot: 'hands', label: 'Hand', column: 3, row: 6 },
  { slot: 'legs', label: 'Leg', column: 2, row: 6 },
  { slot: 'wrist-1', label: 'Left Wrist', column: 1, row: 5 },
  { slot: 'waist', label: 'Waist', column: 1, row: 4 },
  { slot: 'arms', label: 'Arm', column: 1, row: 3 },
  { slot: 'chest', label: 'Chest', column: 1, row: 2 },
  { slot: 'finger-1', label: 'Finger 1', column: 2, row: 7 },
  { slot: 'finger-2', label: 'Finger 2', column: 3, row: 7 },
  { slot: 'powersource', label: 'Power Source', column: 4, row: 7 },
  { slot: 'primary', label: 'Primary', column: 2, row: 8 },
  { slot: 'secondary', label: 'Secondary', column: 3, row: 8 },
  { slot: 'range', label: 'Range', column: 4, row: 8 },
];
const SLOT_ICONS = {
  charm: '✦', ear: '◖', head: '♜', face: '◉', neck: '⌁', shoulders: '◇', arms: '♢', back: '▣',
  wrist: '◌', range: '➶', hands: '✋', primary: '⚔', finger: '○', chest: '▤', legs: '♜', feet: '⌁',
  waist: '◍', secondary: '⚔', powersource: '✹',
};

function normalizeEditorSlot(slot) {
  return String(slot || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/^fingers(?=-|$)/, 'finger');
}

function slotRoot(slot) {
  return normalizeEditorSlot(slot).replace(/-[12]$/, '');
}

function isPowerSourceItem(item) {
  return slotRoot(item && item.slot) === 'powersource';
}

function hasSpellFocus(item) {
  return !isPowerSourceItem(item) && Array.isArray(item.effects) &&
    item.effects.some((effect) => effect && effect.type === 'focus');
}

function hasWeaponProc(item) {
  return !item?.isAugment && ['primary', 'secondary', 'range'].includes(slotRoot(item && item.slot)) &&
    Array.isArray(item.effects) && item.effects.some((effect) => effect && effect.type === 'proc');
}

function getGearEffectEntries() {
  return (editingProfile && editingProfile.items || []).flatMap((item, itemIndex) =>
    (hasSpellFocus(item) || hasWeaponProc(item) ? item.effects : [])
      .filter((effect) => effect && (effect.type === 'focus' && hasSpellFocus(item) || effect.type === 'proc' && hasWeaponProc(item)))
      .map((effect) => ({ effect, item, itemIndex })));
}

function renderInventoryPreview() {
  const slots = $('#inventory-slots');
  if (!slots || !editingProfile) return;
  renderLastEquip();
  const showAugments = activeInventoryTab === 'augments';
  const showFocus = activeInventoryTab === 'focus';
  const syncTabs = () => {
    document.querySelectorAll('[data-inventory-tab]').forEach((tab) => {
      const active = tab.dataset.inventoryTab === activeInventoryTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    const styleToggle = $('#wishlist-style');
    if (styleToggle) styleToggle.hidden = activeInventoryTab !== 'wishlist';
    document.querySelectorAll('[data-wishlist-style]').forEach((button) => {
      const active = button.dataset.wishlistStyle === wishlistStyle;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  if (activeInventoryTab === 'wishlist') {
    // Wanted, not owned: both styles are tinted so they never read as worn gear.
    const grid = document.querySelector('.inventory-grid');
    const asSlots = wishlistStyle === 'slots';
    grid.classList.toggle('focus-list-view', !asSlots);
    slots.classList.toggle('focus-list', !asSlots);
    slots.classList.add('wishlist-view');
    slots.replaceChildren(...(asSlots ? wishlistSlotGrid() : wishlistRows()));
    const count = Array.isArray(editingProfile.wishlist) ? editingProfile.wishlist.length : 0;
    const label = count + ' wanted item' + (count === 1 ? '' : 's');
    $('#inventory-stage-name').textContent = editingProfile.name || 'Unnamed Character';
    $('#inventory-stage-meta').textContent =
      [editingProfile.cls, editingProfile.level ? 'Level ' + editingProfile.level : '', label].filter(Boolean).join(' · ');
    $('.inventory-stage-title').textContent = 'WISHLIST — WANTED, NOT OWNED';
    $('#inventory-slot-count').textContent = label;
    syncTabs();
    return;
  }
  slots.classList.remove('wishlist-view');
  if (showFocus) {
    const grid = document.querySelector('.inventory-grid');
    const entries = getGearEffectEntries();
    grid.classList.add('focus-list-view');
    slots.classList.add('focus-list');
    slots.replaceChildren(...entries.map((entry, index) => {
      const button = el('button', 'focus-list-entry');
      button.type = 'button';
      button.classList.toggle('proc', entry.effect.type === 'proc');
      button.classList.toggle('selected', index === selectedFocusIndex);
      button.setAttribute('aria-pressed', String(index === selectedFocusIndex));
      button.appendChild(el('span', 'focus-list-type', entry.effect.type === 'proc' ? 'PROC' : 'FOCUS'));
      button.appendChild(el('span', 'focus-list-name', entry.effect.name || entry.effect.raw || 'Unnamed effect'));
      button.appendChild(el('span', 'focus-list-item', entry.item.name || 'Unnamed item'));
      button.addEventListener('click', () => {
        selectedFocusIndex = index;
        selectedItemIndex = entry.itemIndex;
        renderItemList();
      });
      return button;
    }));
    const visibleCount = entries.length;
    const meta = [editingProfile.cls, editingProfile.level ? 'Level ' + editingProfile.level : '', visibleCount + ' gear effects'].filter(Boolean).join(' · ') || 'Local profile';
    $('#inventory-stage-name').textContent = editingProfile.name || 'Unnamed Character';
    $('#inventory-stage-meta').textContent = meta;
    $('.inventory-stage-title').textContent = 'SPELL FOCUS & PROCS';
    $('#inventory-slot-count').textContent = visibleCount + ' gear effects';
    syncTabs();
    return;
  }
  document.querySelector('.inventory-grid').classList.remove('focus-list-view');
  slots.classList.remove('focus-list');
  const equipmentGrouped = {};
  const augmentGrouped = {};
  editingProfile.items.forEach((item, index) => {
    if (!item.slot || (showFocus && !hasSpellFocus(item))) return;
    const slot = normalizeEditorSlot(item.slot);
    const grouped = item.isAugment ? augmentGrouped : equipmentGrouped;
    (grouped[slot] || (grouped[slot] = [])).push({ item, index });
  });
  const makeSlot = ({ slot, label, column, row }) => {
    const root = slotRoot(slot);
    const pairedIndex = /-[12]$/.test(slot) ? Number(slot.slice(-1)) - 1 : -1;
    const equipmentEntries = equipmentGrouped[root] || [];
    const exactEquipmentEntries = equipmentGrouped[slot] || [];
    let entries;
    if (showAugments) {
      const parent = pairedIndex >= 0
        ? (exactEquipmentEntries[0] || equipmentEntries[pairedIndex])
        : equipmentEntries[0];
      const augments = augmentGrouped[root]?.length ? augmentGrouped[root] : (augmentGrouped[slot] || []);
      entries = parent
        ? augments.filter((entry) => entry.item.parentId && entry.item.parentId === (parent.item.id || parent.item.name))
        : [];
      if (!entries.length && (pairedIndex < 0 || pairedIndex === 0)) entries = augments.filter((entry) => !entry.item.parentId);
    } else {
      entries = pairedIndex >= 0
        ? exactEquipmentEntries.length ? [exactEquipmentEntries[0]] : (equipmentEntries[pairedIndex] ? [equipmentEntries[pairedIndex]] : [])
        : equipmentGrouped[slot] || [];
    }
    const box = el('div', 'gear-slot' + (entries.length ? ' filled' : ''));
    box.style.gridColumn = column;
    box.style.gridRow = row;
    // A filled slot keeps its label: without it several items truncate to the
    // same prefix and there is no way to tell which slot is which.
    const record = editingProfile.lastEquip;
    const justEquipped = !!record && !showAugments && entries.some((entry) =>
      entry.index === Number(record.index) && entry.item && record.item && entry.item.name === record.item.name);
    if (justEquipped) box.classList.add('just-equipped');
    const names = entries.map((entry) => entry.item.name || 'Unnamed item').join(' / ');
    box.title = (entries.length ? label + ': ' + names : 'Empty ' + label + ' slot') +
      (justEquipped ? ' (last equipped)' : '');
    const glyph = el('span', 'gear-glyph', SLOT_ICONS[root] || '✦');
    glyph.setAttribute('aria-hidden', 'true');
    const text = el('div', 'gear-slot-text');
    text.appendChild(el('span', 'gear-slot-label', label));
    text.appendChild(el('span', 'gear-slot-name', entries.length ? names : 'Empty'));
    const name = text;
    const iconUrl = entries[0] && ICON_URL_PATTERN.test(entries[0].item.icon || '') && entries[0].item.icon;
    if (iconUrl) {
      const icon = document.createElement('img');
      icon.className = 'gear-icon';
      icon.src = iconUrl;
      icon.alt = '';
      icon.addEventListener('error', () => icon.replaceWith(glyph), { once: true });
      box.appendChild(icon);
    } else {
      box.appendChild(glyph);
    }
    box.appendChild(name);
    if (entries.length) {
      const selectItem = () => {
        const current = entries.findIndex((entry) => entry.index === selectedItemIndex);
        selectedItemIndex = entries[(current + 1) % entries.length].index;
        renderItemList();
      };
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.addEventListener('click', selectItem);
      box.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectItem(); } });
    }
    return box;
  };
  slots.replaceChildren(...INVENTORY_SLOT_LAYOUT
    .filter(({ slot }) => !(showAugments && slotRoot(slot) === 'powersource'))
    .map(makeSlot));
  const visibleCount = editingProfile.items.filter((item) => !!item.isAugment === showAugments && !(showAugments && isPowerSourceItem(item))).length;
  const visibleLabel = showAugments ? 'augments' : 'items';
  const meta = [editingProfile.cls, editingProfile.level ? 'Level ' + editingProfile.level : '', visibleCount + ' ' + visibleLabel].filter(Boolean).join(' · ') || 'Local profile';
  $('#inventory-stage-name').textContent = editingProfile.name || 'Unnamed Character';
  $('#inventory-stage-meta').textContent = meta;
  $('.inventory-stage-title').textContent = showAugments ? 'WORN AUGMENTS' : 'WORN EQUIPMENT';
  $('#inventory-slot-count').textContent = showAugments ? visibleCount + ' augments' : visibleCount + ' / 19 worn slots';
  syncTabs();
}

function hasNumericStats(item) {
  return Object.values(item.stats || {}).some((value) => {
    return Number.isFinite(normalizeEditorStat(value).num);
  });
}

function hasItemData(item) {
  return hasNumericStats(item) || hasSpellFocus(item) || (item && Array.isArray(item.effects) && item.effects.length > 0);
}

function hasAugmentTypes(item) {
  return !item.isAugment || (Array.isArray(item.augmentTypes) && item.augmentTypes.length > 0);
}

function normalizedName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadEditorStats(profile) {
  if (!profile || editingProfile !== profile) return;
  const refreshAll = profile.statsVersion !== PROFILE_STATS_VERSION;
  const pending = profile.items.filter((item) => (item.id || item.name) &&
    (refreshAll || ((!hasItemData(item) || !item.icon || !hasAugmentTypes(item)) && !item.enriched)));
  if (!pending.length) {
    if (editingId !== 'new' && refreshAll) {
      profiles[editingId] = { ...profiles[editingId], statsVersion: PROFILE_STATS_VERSION };
      await saveAll([editingId]);
    }
    $('#editor-status').textContent = '';
    return;
  }
  $('#editor-status').textContent = 'Looking up item stats…';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ENRICH_PROFILE_ITEMS',
      items: pending.map(({ id, name, slot }) => ({ id, name, slot })),
    });
    if (editingProfile !== profile) return;
    if (!response || !response.ok) throw new Error(response && response.error);
    appendDebugLog(response.debug);
    const byId = new Map((response.items || []).filter((item) => item && item.id).map((item) => [String(item.id), item]));
    const byName = new Map((response.items || []).filter((item) => item && item.name).map((item) => [normalizedName(item.name), item]));
    let loadedCount = 0;
    let enrichedCount = 0;
    for (const item of profile.items) {
      const loaded = (item.id && byId.get(String(item.id))) || byName.get(normalizedName(item.name));
      if (!loaded) continue;
      item.enriched = true;
      enrichedCount++;
      if (!hasItemData(loaded) && !loaded.icon) continue;
      item.id = loaded.id || item.id || '';
      item.icon = loaded.icon || item.icon || '';
      item.slot = item.slot || loaded.slot || '';
      item.augmentTypes = (Array.isArray(loaded.augmentTypes) && loaded.augmentTypes.length)
        ? [...loaded.augmentTypes] : (item.augmentTypes || []);
      item.stats = statsToPlain(loaded.stats);
      item.effects = Array.isArray(loaded.effects) ? loaded.effects : (item.effects || []);
      item.effectsKnown = loaded.effectsKnown === true;
      loadedCount++;
    }
    renderItemList();
    if (editingId !== 'new' && enrichedCount) {
      profiles[editingId] = { ...profiles[editingId], statsVersion: PROFILE_STATS_VERSION, items: profile.items };
      await saveAll([editingId]);
    }
    $('#editor-status').textContent = loadedCount ? 'Loaded stats for ' + loadedCount + ' item' + (loadedCount === 1 ? '' : 's') : 'No matching RaidLoot stats found';
  } catch (e) {
    $('#editor-status').textContent = 'Could not load RaidLoot stats';
  }
}

function renderFocusDetails() {
  const list = $('#item-list');
  const entries = getGearEffectEntries();
  list.replaceChildren();
  if (!entries.length) {
    list.appendChild(el('div', 'empty-state', 'No spell focus or weapon proc found on worn items.'));
    return;
  }
  selectedFocusIndex = Math.min(selectedFocusIndex, entries.length - 1);
  const entry = entries[selectedFocusIndex];
  const detailsLabel = document.querySelector('.item-details-label');
  if (detailsLabel) detailsLabel.textContent = entry.effect.type === 'proc' ? 'WEAPON PROC DETAILS' : 'SPELL FOCUS DETAILS';
  const row = el('div', 'item-row selected');
  row.appendChild(el('div', 'item-row-header', entry.effect.name || entry.effect.raw || 'Unnamed effect'));
  const details = el('div', 'focus-detail');
  details.appendChild(el('div', 'focus-detail-label', 'DETAILS'));
  details.appendChild(el('div', 'focus-detail-text', entry.effect.raw || entry.effect.name || 'No details available.'));
  details.appendChild(el('div', 'focus-detail-label', 'ON ITEM'));
  details.appendChild(el('div', 'focus-detail-text', entry.item.name || 'Unnamed item'));
  row.appendChild(details);
  list.appendChild(row);
}

function renderItemList() {
  const list = $('#item-list');
  list.innerHTML = '';
  const editButton = $('#btn-edit-items');
  if (editButton) {
    editButton.textContent = itemsEditable ? 'Done' : 'Edit';
    editButton.setAttribute('aria-pressed', String(itemsEditable));
  }
  const addItemButton = $('#btn-add-item');
  if (addItemButton) addItemButton.disabled = !itemsEditable;
  renderInventoryPreview();
  const focusView = activeInventoryTab === 'focus';
  const wishlistView = activeInventoryTab === 'wishlist';
  const detailsLabel = document.querySelector('.item-details-label');
  if (detailsLabel) {
    detailsLabel.textContent = focusView ? 'GEAR EFFECT DETAILS' : wishlistView ? 'WISHLIST' : 'ITEM DETAILS';
  }
  if (editButton) editButton.hidden = focusView || wishlistView;
  if (addItemButton) addItemButton.hidden = focusView || wishlistView;
  if (wishlistView) {
    // Wishlist entries are wanted items, not profile items, so there is nothing
    // to edit here; they are added and removed from the item pages themselves.
    list.appendChild(el('div', 'empty-state',
      'Wishlist items are added from RaidLoot and OpenDKP item pages. Remove them in the list on the left.'));
    return;
  }
  if (focusView) {
    renderFocusDetails();
    return;
  }
  const visibleIndices = editingProfile.items
    .map((item, index) => ((activeInventoryTab === 'augments' ? !!item.isAugment && !isPowerSourceItem(item) : activeInventoryTab === 'focus' ? hasSpellFocus(item) : !item.isAugment) ? index : -1))
    .filter((index) => index >= 0);
  if (!visibleIndices.length) {
    list.appendChild(el('div', 'empty-state', activeInventoryTab === 'augments' ? 'No augments. Import an inventory file or add one.' : 'No worn items. Add one to start comparing.'));
    return;
  }
  if (!visibleIndices.includes(selectedItemIndex)) selectedItemIndex = visibleIndices[0];
  editingProfile.items.forEach((item, idx) => {
    if (idx !== selectedItemIndex) return;
    const row = el('div', 'item-row');
    row.dataset.itemIndex = idx;
    const header = el('div', 'item-row-header');
    const heading = el('div', 'item-heading');
    const iconUrl = ICON_URL_PATTERN.test(item.icon || '') && item.icon;
    if (iconUrl) {
      const icon = document.createElement('img');
      icon.className = 'item-detail-icon';
      icon.src = iconUrl;
      icon.alt = '';
      icon.addEventListener('error', () => icon.remove(), { once: true });
      heading.appendChild(icon);
    }
    heading.appendChild(el('span', 'item-name', item.name || ('Item ' + (idx + 1))));
    header.appendChild(heading);
    const actions = el('div', 'item-actions');
    const removeBtn = el('button', 'btn-remove', 'Remove');
    removeBtn.disabled = !itemsEditable;
    removeBtn.addEventListener('click', () => {
      editingProfile.items.splice(idx, 1);
      renderItemList();
    });
    actions.appendChild(removeBtn);
    header.appendChild(actions);
    row.appendChild(header);

    const fields = el('div', 'item-fields');
    const nameLbl = el('label', 'full', 'Item Name');
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.value = item.name;
    nameInput.placeholder = 'e.g. Cloak of Flames';
    nameInput.disabled = !itemsEditable;
    nameInput.addEventListener('input', () => {
      if (nameInput.value !== item.name) {
        item.name = nameInput.value;
        item.id = '';
        item.icon = '';
        item.augmentTypes = [];
        item.enriched = false;
        item.stats = {};
        item.effects = [];
      }
      header.querySelector('.item-name').textContent = nameInput.value || ('Item ' + (idx + 1));
      renderInventoryPreview();
    });
    nameLbl.appendChild(nameInput);
    fields.appendChild(nameLbl);

    const slotLbl = el('label', '', 'Slot');
    const slotSel = el('select');
    const slotOptions = [...EQUIPMENT_SLOTS, 'ear-1', 'ear-2', 'wrist-1', 'wrist-2', 'finger-1', 'finger-2'];
    slotSel.innerHTML = '<option value="">- select -</option>' + slotOptions.map((s) => '<option value="' + s + '">' + s + '</option>').join('');
    slotSel.value = normalizeEditorSlot(item.slot);
    slotSel.disabled = !itemsEditable;
    slotSel.addEventListener('change', () => { item.slot = slotSel.value; renderInventoryPreview(); });
    slotLbl.appendChild(slotSel);
    fields.appendChild(slotLbl);

    const typeLbl = el('label', '', 'Type');
    const typeSel = el('select');
    const equipmentOption = el('option', '', 'Equipment');
    equipmentOption.value = 'equipment';
    const augmentOption = el('option', '', 'Augment');
    augmentOption.value = 'augment';
    typeSel.appendChild(equipmentOption);
    typeSel.appendChild(augmentOption);
    typeSel.value = item.isAugment ? 'augment' : 'equipment';
    typeSel.disabled = !itemsEditable;
    typeSel.addEventListener('change', () => {
      item.isAugment = typeSel.value === 'augment';
      item.augmentTypes = [];
      item.enriched = false;
      activeInventoryTab = item.isAugment ? 'augments' : 'equipment';
      renderItemList();
    });
    typeLbl.appendChild(typeSel);
    fields.appendChild(typeLbl);
    row.appendChild(fields);

    // Stats
    const statsBlock = el('div', 'item-stats');
    const statsHeader = el('div', 'item-stats-header');
    statsHeader.appendChild(el('span', '', 'Stats'));
    const addStatBtn = el('button', 'btn-remove', '+ Stat');
    addStatBtn.disabled = !itemsEditable;
    addStatBtn.addEventListener('click', () => {
      item.stats[''] = '';
      renderItemList();
    });
    statsHeader.appendChild(addStatBtn);
    statsBlock.appendChild(statsHeader);

    const statKeys = Object.keys(item.stats);
    if (!statKeys.length) {
      statsBlock.appendChild(el('div', 'hint', 'No stats. Add stats to enable scoring.'));
    } else {
      for (const key of statKeys) {
        const statRow = el('div', 'stat-row');
        const nameInput = el('input');
        nameInput.className = 'stat-name';
        nameInput.type = 'text';
        nameInput.value = key;
        nameInput.placeholder = 'e.g. HP';
        nameInput.disabled = !itemsEditable;
        nameInput.addEventListener('input', () => {
          const newKey = nameInput.value.trim();
          if (newKey && newKey !== key && !['__proto__', 'constructor', 'prototype'].includes(newKey)) {
            const val = item.stats[key];
            delete item.stats[key];
            item.stats[newKey] = { ...normalizeEditorStat(val), source: 'manual' };
            renderItemList();
          }
        });
        const valInput = el('input');
        valInput.className = 'stat-value';
        const stat = normalizeEditorStat(item.stats[key]);
        valInput.type = 'text';
        valInput.inputMode = 'decimal';
        valInput.value = Number.isFinite(stat.num) ? String(stat.num) : stat.raw;
        if (!Number.isFinite(stat.num) && stat.raw) valInput.title = 'Unavailable numeric value: ' + stat.raw;
        valInput.placeholder = 'Unknown';
        valInput.disabled = !itemsEditable;
        valInput.addEventListener('input', () => {
          item.stats[key] = { raw: valInput.value, num: finiteEditorStatNumber(valInput.value), source: 'manual' };
        });
        const rmBtn = el('button', 'btn-remove btn-remove-stat', '×');
        rmBtn.disabled = !itemsEditable;
        rmBtn.addEventListener('click', () => {
          delete item.stats[key];
          renderItemList();
        });
        statRow.appendChild(nameInput);
        statRow.appendChild(valInput);
        if (itemsEditable) statRow.appendChild(rmBtn);
        statsBlock.appendChild(statRow);
      }
    }
    row.appendChild(statsBlock);
    const focusEffects = hasSpellFocus(item) ? item.effects.filter((effect) => effect && effect.type === 'focus') : [];
    if (focusEffects.length) {
      const focusBlock = el('div', 'item-stats');
      const focusHeader = el('div', 'item-stats-header');
      focusHeader.appendChild(el('span', '', 'Spell Focus'));
      focusBlock.appendChild(focusHeader);
      for (const effect of focusEffects) focusBlock.appendChild(el('div', 'hint', effect.raw || effect.name || 'Unnamed focus'));
      row.appendChild(focusBlock);
    }
    list.appendChild(row);
  });
}

// ---------- Save ----------
async function saveProfile() {
  const wasNew = editingId === 'new';
  const name = $('#profile-name').value.trim();
  if (!name) { alert('Please enter a character name.'); return; }
  editingProfile.name = name;
  editingProfile.cls = $('#profile-class').value;
  editingProfile.level = $('#profile-level').value.trim();
  editingProfile.server = $('#profile-server') ? $('#profile-server').value.trim() : editingProfile.server || '';
  // Clean up items: remove empty ones, normalize stats
  editingProfile.items = editingProfile.items
    .filter((it) => it.name && it.slot)
    .map((it) => {
      const stats = {};
      for (const k of Object.keys(it.stats)) {
        const key = k.trim();
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        const value = normalizeEditorStat(it.stats[k]);
        if (key && !NON_NUMERIC_STAT.test(key)) stats[key] = value;
      }
      return {
        id: it.id, name: it.name, icon: it.icon || '', slot: it.slot,
        isAugment: !!it.isAugment, augmentTypes: Array.isArray(it.augmentTypes) ? [...it.augmentTypes] : [],
        augSlot: it.augSlot || '', parentId: it.parentId || '', enriched: !!it.enriched, stats, effects: it.effects || [], effectsKnown: it.effectsKnown === true,
      };
    });
  let savedId = editingId;
  if (editingId === 'new') {
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    editingProfile.id = id;
    profiles[id] = { ...editingProfile, wishlist: [] };
    savedId = id;
  } else {
    profiles[editingId] = editingProfile;
  }
  await saveAll([savedId]);
  editingId = savedId;
  $('#editor-title').textContent = 'Edit: ' + (editingProfile.name || 'Unnamed');
  $('#btn-delete-profile').classList.remove('hidden');
  editingProfile.characterData = profiles[savedId].characterData || null;
  renderEditorProfileSelector();
  if (wasNew) renderCharacterData();
  else refreshCharacterDataStatus();
}

async function deleteProfile() {
  if (!editingId || editingId === 'new') return;
  if (await deleteProfileById(editingId)) closeEditor();
}

// ---------- EQ inventory file import ----------
// Worn equipment locations from the /output inventory file.
const EQUIPMENT_LOCATIONS = new Set([
  'Charm', 'Ear', 'Head', 'Face', 'Neck', 'Shoulders', 'Arms', 'Back',
  'Wrist', 'Range', 'Hands', 'Primary', 'Secondary', 'Fingers', 'Chest',
  'Legs', 'Feet', 'Waist', 'Power Source',
]);

// Normalize an EQ location name to our slot list value.
function slotFromLocation(loc) {
  let s = String(loc).trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (s === 'power-source') s = 'powersource';
  if (s === 'fingers') s = 'finger';
  return s;
}

// Parse a [name]_[server]-Inventory.txt file. Returns worn items only.
function parseInventoryText(text) {
  const items = [];
  const lines = text.split(/\r?\n/);
  let inKeyRing = false;
  const lastEquipmentBySlot = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.indexOf('KeyRing') === 0) { inKeyRing = true; continue; }
    if (inKeyRing) continue; // keyring section (different columns, not worn)
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    const [location, name, idStr] = cols;
    if (location === 'Location') continue; // header row
    const augMatch = String(location).match(/^(.+)-Slot(\d+)$/i);
    const baseLocation = augMatch ? augMatch[1] : location;
    const equipmentLocation = [...EQUIPMENT_LOCATIONS].find((value) => value.toLowerCase() === String(baseLocation).toLowerCase());
    if (!equipmentLocation) continue; // bags/bank/etc.
    if (!name || name === 'Empty') continue;
    const slot = slotFromLocation(equipmentLocation);
    if (augMatch) {
      const parent = lastEquipmentBySlot[slot];
      items.push({
        name,
        id: idStr,
        slot,
        isAugment: true,
        augSlot: Number(augMatch[2]),
        parentId: parent ? (parent.id || parent.name) : '',
        stats: {},
      });
      continue;
    }
    const item = {
      name,
      id: idStr,
      slot,
      stats: {},
      effects: [],
    };
    lastEquipmentBySlot[slot] = item;
    items.push(item);
  }
  return items;
}

// Read character metadata when the inventory export includes labeled fields.
function parseInventoryMetadata(text) {
  const metadata = { name: '', cls: '', level: '' };
  for (const line of String(text || '').split(/\r?\n/)) {
    const field = line.match(/^\s*([^:\t=]+?)\s*(?::|=|\t)\s*(.*?)\s*$/) ||
      line.match(/^\s*(name|character|character name|player|player name|class|character class|player class|level|lvl|character level|player level)\s+(.+?)\s*$/i);
    const key = field && field[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const value = field && field[2].trim();
    if (!value) {
      const level = line.match(/^\s*(?:level|lvl)\s+(\d{1,3})\b/i);
      if (!metadata.level && level) metadata.level = level[1];
      continue;
    }
    if (!metadata.name && ['name', 'character', 'character name', 'player', 'player name'].includes(key)) {
      metadata.name = value;
    } else if (!metadata.cls && ['class', 'character class', 'player class'].includes(key)) {
      metadata.cls = value;
    } else if (!metadata.level && ['level', 'lvl', 'character level', 'player level'].includes(key)) {
      const match = value.match(/\d{1,3}/);
      if (match) metadata.level = match[0];
    }
    if (!metadata.level) {
      const level = line.match(/^\s*(?:level|lvl)\s+(\d{1,3})\b/i);
      if (level) metadata.level = level[1];
    }
  }
  return metadata;
}

const NON_NUMERIC_STAT = /^(?:slot|class|race|type|deity|skill|effect|click|worn|proc|focus|tools|required|restriction|lore|aug)/i;
const STAT_SOURCES = new Set(['raidloot', 'opendkp', 'manual', 'legacy']);

function finiteEditorStatNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeEditorStat(value, source) {
  const object = value && typeof value === 'object' ? value : null;
  const hasNum = !!object && Object.prototype.hasOwnProperty.call(object, 'num');
  const rawValue = object && Object.prototype.hasOwnProperty.call(object, 'raw')
    ? object.raw : object && Object.prototype.hasOwnProperty.call(object, 'num') ? object.num : value;
  const raw = rawValue == null ? '' : String(rawValue);
  const candidateSource = object && object.source || source || 'legacy';
  return { raw, num: hasNum ? finiteEditorStatNumber(object.num) : finiteEditorStatNumber(value),
    source: STAT_SOURCES.has(candidateSource) ? candidateSource : 'legacy' };
}

// Keep unknown RaidLoot values and their source text in the editor.
function statsToPlain(stats) {
  const out = {};
  for (const k of Object.keys(stats || {})) {
    if (['__proto__', 'constructor', 'prototype'].includes(k) || NON_NUMERIC_STAT.test(k)) continue;
    out[k] = normalizeEditorStat(stats[k]);
  }
  return out;
}

function mapRaidlootItem(item) {
  return {
    id: item.id || '',
    name: item.name || '',
    icon: item.icon || '',
    slot: item.slot || '',
    isAugment: !!item.isAugment,
    augmentTypes: Array.isArray(item.augmentTypes) ? [...item.augmentTypes] : [],
    augSlot: item.augSlot || '',
    parentId: item.parentId || '',
    enriched: true,
    stats: statsToPlain(item.stats),
    effects: Array.isArray(item.effects) ? item.effects.map((effect) => ({ ...effect })) : [],
    effectsKnown: item.effectsKnown === true,
  };
}

function raidlootProfileId(value) {
  const input = String(value || '').trim();
  const urlMatch = input.match(/\/profile\/(\d+)(?:[/?#]|$)/i);
  return urlMatch ? urlMatch[1] : (/^\d+$/.test(input) ? input : '');
}

function raidlootImportedProfileId(value) {
  const input = String(value || '').trim();
  return /^raidloot\.com\/profile\/\d+$/i.test(input) ? raidlootProfileId(input) : '';
}

function updateRaidlootRefreshButton() {
  const button = $('#btn-refresh-raidloot');
  if (!button) return;
  button.hidden = !raidlootImportedProfileId(editingProfile && editingProfile.importedFrom);
  button.disabled = !!editingProfile && editingId === refreshingProfileId;
}

// List-row variant of the editor's "Refresh from RaidLoot" action: pull the
// latest worn items for an imported profile without opening the editor.
async function refreshProfileFromList(id, button, profileId) {
  const savedProfile = profiles[id];
  if (!savedProfile || !profileId || refreshingProfileId) return;
  refreshingProfileId = id;
  button.disabled = true;
  button.textContent = 'Refreshing…';
  let refreshed = false;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_PROFILE', profileId });
    if (!response || !response.ok || !response.profile) throw new Error(response && response.error || 'No profile returned');
    const items = (response.profile.items || []).map(mapRaidlootItem).filter((item) => item.name && item.slot);
    if (!items.length) throw new Error('RaidLoot returned no worn items; check the profile ID');
    profiles[id] = { ...savedProfile, items, statsVersion: PROFILE_STATS_VERSION };
    try {
      await saveAll([id]);
      refreshed = true;
    } catch (e) {
      profiles[id] = savedProfile;
      throw e;
    }
  } catch (e) {
    appendDebugLog([{ name: savedProfile.name || 'RaidLoot profile ' + profileId, result: 'error', message: e.message }]);
    button.textContent = 'Refresh failed';
  } finally {
    if (refreshingProfileId === id) refreshingProfileId = '';
    if (refreshed) renderProfileList();
    else button.disabled = false;
  }
}

async function refreshRaidlootProfile() {
  const profile = editingProfile;
  const profileId = raidlootImportedProfileId(profile && profile.importedFrom);
  if (!profile || editingId === 'new' || !profileId || refreshingProfileId) return;
  const requestProfileId = editingId;
  const savedProfile = profiles[editingId];
  if (!savedProfile) return;
  refreshingProfileId = requestProfileId;
  updateRaidlootRefreshButton();
  $('#editor-status').textContent = 'Refreshing from RaidLoot…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_PROFILE', profileId });
    if (!response || !response.ok || !response.profile) throw new Error(response && response.error || 'No profile returned');
    const items = (response.profile.items || []).map(mapRaidlootItem).filter((item) => item.name && item.slot);
    if (!items.length) throw new Error('RaidLoot returned no worn items; check the profile ID');
    if (editingProfile !== profile || editingId !== requestProfileId) return;
    profiles[requestProfileId] = { ...savedProfile, items, statsVersion: PROFILE_STATS_VERSION };
    try {
      await saveAll([requestProfileId]);
    } catch (e) {
      profiles[requestProfileId] = savedProfile;
      throw e;
    }
    profile.items = items;
    profile.statsVersion = PROFILE_STATS_VERSION;
    renderEditor();
    $('#editor-status').textContent = 'Refreshed ' + items.length + ' items from RaidLoot.';
  } catch (e) {
    $('#editor-status').textContent = 'RaidLoot refresh failed: ' + e.message;
  } finally {
    if (refreshingProfileId === requestProfileId) refreshingProfileId = '';
    updateRaidlootRefreshButton();
  }
}

// Extract a profile name from the filename "Ereebus_oakwynd-Inventory.txt".
function nameFromFilename(filename) {
  const base = (filename || '').split(/[\\/]/).pop();
  const m = base.match(/^(.+?)_([^-]+)-Inventory\.txt$/i);
  if (m) return { name: m[1], server: m[2] };
  return { name: base.replace(/-Inventory\.txt$/i, '').replace(/\.txt$/i, ''), server: '' };
}

// Fetch item stats from raidloot (via background) for a list of worn items.
async function fetchStatsForItems(items, onProgress) {
  if (onProgress) onProgress('Fetching stats for ' + items.length + ' items...');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'ENRICH_PROFILE_ITEMS', items });
    if (!response || !response.ok) return items;
    appendDebugLog(response.debug);
    return (response.items || items).map((item, index) => ({
      ...(items[index] || {}), ...item,
      isAugment: !!(items[index] && items[index].isAugment),
      augmentTypes: (Array.isArray(item.augmentTypes) && item.augmentTypes.length)
        ? [...item.augmentTypes] : ((items[index] && items[index].augmentTypes) || []),
      augSlot: (items[index] && items[index].augSlot) || '',
      parentId: (items[index] && items[index].parentId) || '',
      enriched: true,
      stats: statsToPlain(item.stats),
    }));
  } catch (e) {
    return items;
  }
}

function addImportedProfile({ name, cls, level, server, items, statsVersion, importedFrom }) {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  profiles[id] = {
    id,
    name: name || 'Imported Character',
    cls: normalizeClassName(cls),
    level: level || '',
    server: server || '',
    statsVersion: statsVersion || 0,
    items,
    importedFrom: importedFrom || '',
    wishlist: [],
  };
  return id;
}

async function importRaidlootProfile() {
  const status = $('#raidloot-import-status');
  const profileId = raidlootProfileId($('#raidloot-profile').value);
  if (!profileId) {
    status.textContent = 'Enter a RaidLoot profile URL or numeric ID.';
    status.className = 'import-status error';
    return;
  }
  status.textContent = 'Loading RaidLoot profile…';
  status.className = 'import-status';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_PROFILE', profileId });
    if (!response || !response.ok || !response.profile) throw new Error(response && response.error || 'No profile returned');
    const profile = response.profile;
    const items = (profile.items || []).map(mapRaidlootItem).filter((item) => item.name && item.slot);
    if (!items.length) throw new Error('RaidLoot returned no worn items; check the profile ID');
    const id = addImportedProfile({
      name: profile.name || 'RaidLoot ' + profileId,
      cls: profile.cls,
      level: profile.level,
      items,
      statsVersion: PROFILE_STATS_VERSION,
      importedFrom: 'raidloot.com/profile/' + profileId,
    });
    await saveAll([id]);
    const loadedCount = items.filter((item) => Object.keys(item.stats).length).length;
    status.textContent = 'Imported ' + items.length + ' items (' + loadedCount + ' with stats) from RaidLoot.';
    status.className = 'import-status success';
    renderProfileList();
  } catch (e) {
    appendDebugLog([{ name: 'RaidLoot profile ' + profileId, result: 'error', message: e.message }]);
    status.textContent = 'RaidLoot import failed: ' + e.message;
    status.className = 'import-status error';
  }
}

async function handleInventoryFile(file) {
  const status = $('#import-status');
  status.textContent = 'Reading file...';
  status.className = 'import-status';
  try {
    const text = await file.text();
    let items = parseInventoryText(text);
    if (!items.length) {
      status.textContent = 'No worn equipment found in file. Make sure you exported with /output inventory.';
      status.className = 'import-status error';
      return;
    }
    const fetchStats = $('#fetch-stats').checked;
    if (fetchStats) {
      items = await fetchStatsForItems(items, (msg) => {
        status.textContent = msg;
        status.className = 'import-status';
      });
    }
    // Create profile from filename
    const filenameMetadata = nameFromFilename(file.name);
    const inventoryMetadata = parseInventoryMetadata(text);
    const profileName = inventoryMetadata.name || filenameMetadata.name || 'Imported Character';
    const id = addImportedProfile({
      name: profileName,
      cls: inventoryMetadata.cls,
      level: inventoryMetadata.level,
      server: filenameMetadata.server,
      items,
      statsVersion: fetchStats ? PROFILE_STATS_VERSION : 0,
      importedFrom: file.name,
    });
    await saveAll([id]);
    const loadedCount = items.filter((item) => Object.keys(item.stats || {}).length).length;
    const profileMeta = [inventoryMetadata.cls, inventoryMetadata.level && 'level ' + inventoryMetadata.level].filter(Boolean).join(' · ');
    status.textContent = 'Imported ' + items.length + ' items' + (fetchStats ? ' (' + loadedCount + ' with stats)' : ' (stats load when comparing)') + ' for ' + profileName + (profileMeta ? ' (' + profileMeta + ')' : '') + '.';
    status.className = 'import-status success';
    renderProfileList();
  } catch (e) {
    status.textContent = 'Import failed: ' + e.message;
    status.className = 'import-status error';
  }
}

// ---------- Init ----------
async function requireConsent() {
  const result = await chrome.storage.local.get(CONSENT_KEY);
  const gate = $('#consent-gate');
  if (result[CONSENT_KEY] === CONSENT_VERSION) {
    gate.classList.add('hidden');
    return;
  }
  gate.classList.remove('hidden');
  await new Promise((resolve) => {
    $('#btn-consent').addEventListener('click', async () => {
      await chrome.storage.local.set({ [CONSENT_KEY]: CONSENT_VERSION });
      gate.classList.add('hidden');
      resolve();
    }, { once: true });
  });
}

async function init() {
  await requireConsent();
  await loadAll();
  if (new URLSearchParams(location.search).has('debug')) $('#debug-details').hidden = false;
  renderClassSelect();
  renderFormulaSelect();
  $('#btn-new-profile').addEventListener('click', () => openEditor('new'));
  $('#btn-back').addEventListener('click', closeEditor);
  $('#btn-save-profile').addEventListener('click', saveProfile);
  $('#btn-delete-profile').addEventListener('click', deleteProfile);
  $('#btn-refresh-raidloot').addEventListener('click', refreshRaidlootProfile);
  $('#btn-import-raidloot').addEventListener('click', importRaidlootProfile);
  document.querySelectorAll('[data-inventory-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeInventoryTab = tab.dataset.inventoryTab;
      renderItemList();
    });
  });
  document.querySelectorAll('[data-wishlist-style]').forEach((button) => {
    button.addEventListener('click', async () => {
      wishlistStyle = button.dataset.wishlistStyle === 'list' ? 'list' : 'slots';
      await chrome.storage.local.set({ [WISHLIST_STYLE_KEY]: wishlistStyle });
      renderItemList();
    });
  });
  $('#btn-edit-items').addEventListener('click', () => {
    itemsEditable = !itemsEditable;
    renderItemList();
  });
  $('#btn-clear-debug').addEventListener('click', () => { $('#debug-log').textContent = 'No diagnostics yet.'; });
  $('#btn-add-item').addEventListener('click', () => {
    if (!itemsEditable) return;
    editingProfile.items.push({ id: '', name: '', slot: '', stats: {} });
    selectedItemIndex = editingProfile.items.length - 1;
    renderItemList();
  });
  $('#inventory-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleInventoryFile(file);
    e.target.value = ''; // allow re-selecting the same file
  });
  renderProfileList();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[SCORE_KEY]) {
      scoreFormula = (typeof window === 'undefined' ? globalThis : window).LootCaptain.diff.resolveFormula(null, changes[SCORE_KEY].newValue).key;
      $('#score-formula').value = scoreFormula;
      renderCharacterFormula();
    }
    if (!changes[PROFILES_KEY]) return;
    profiles = changes[PROFILES_KEY].newValue || {};
    refreshCharacterDataStatus();
    if (editingId && editingId !== 'new' && editingProfile && profiles[editingId]) {
      const stored = profiles[editingId];
      editingProfile.scoreFormula = stored.scoreFormula;
      renderCharacterFormula();
      editingProfile.wishlist = Array.isArray(stored.wishlist)
        ? stored.wishlist.map((item) => ({ ...item })) : [];
      // Worn items change from outside this page too -- equipping on a RaidLoot
      // or OpenDKP tab writes here. Without this the open editor keeps showing
      // the old gear. Hand edits in progress win, so they are not discarded.
      if (!itemsEditable) {
        editingProfile.items = (stored.items || []).map((item) => ({
          ...item,
          augmentTypes: Array.isArray(item.augmentTypes) ? [...item.augmentTypes] : [],
          stats: Object.assign({}, item.stats || {}),
          effects: Array.isArray(item.effects) ? item.effects.map((effect) => ({ ...effect })) : [],
          effectsKnown: item.effectsKnown === true,
        }));
        editingProfile.lastEquip = stored.lastEquip || null;
        renderItemList();
        return;
      }
      renderWishlist();
    } else if (!editingId) {
      renderProfileList();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
