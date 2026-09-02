// Loot Captain - options page (profile manager)

const PROFILES_KEY = 'profiles';
const SELECTED_KEY = 'selectedProfileId';
const SCORE_KEY = 'scoreFormula';
const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;
const PROFILE_STATS_VERSION = 4;
const DEFAULT_FORMULA_KEY = 'ac10hp';
const ICON_URL_PATTERN = /^(?:data:image\/|https:\/\/(?:cdn\.raidloot\.com|dlil5rqe0ybd2\.cloudfront\.net)\/)/i;
const SCORE_FORMULAS = [
  { key: 'ac10hp', label: '1AC = 10HP' },
  { key: 'ac15hp', label: '1AC = 15HP' },
  { key: 'hdex', label: '1HDex = 4AC = 40HP' },
  { key: 'hagi', label: '1HAgi = 4AC = 40HP' },
  { key: 'hp', label: 'HP' },
  { key: 'mana', label: 'Mana' },
  { key: 'end', label: 'Endurance' },
  { key: 'regen', label: 'HP Regen' },
  { key: 'manaregen', label: 'Mana Regen' },
  { key: 'endregen', label: 'End Regen' },
  { key: 'netpos', label: 'Net positive' },
];
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
let selectedId = '';
let scoreFormula = DEFAULT_FORMULA_KEY;
let editingId = null; // null = list view, 'new' = creating, else editing that id
let editingProfile = null; // working copy while editing
let itemsEditable = false;
let selectedItemIndex = 0;
let selectedFocusIndex = 0;
let activeInventoryTab = 'equipment';
let refreshingProfileId = '';

// ---------- Storage ----------
async function loadAll() {
  const res = await chrome.storage.local.get([PROFILES_KEY, SELECTED_KEY, SCORE_KEY]);
  profiles = res[PROFILES_KEY] || {};
  selectedId = res[SELECTED_KEY] || '';
  scoreFormula = SCORE_FORMULAS.some((formula) => formula.key === res[SCORE_KEY]) ? res[SCORE_KEY] : DEFAULT_FORMULA_KEY;
}
async function saveAll(changedIds = [], deletedIds = []) {
  if (changedIds.length || deletedIds.length) {
    const records = Object.fromEntries(changedIds.filter((id) => profiles[id]).map((id) => [id, profiles[id]]));
    const response = await chrome.runtime.sendMessage({ type: 'SAVE_PROFILES', profiles: records, deletedIds });
    if (!response || !response.ok) throw new Error(response && response.error || 'Could not save profiles');
    profiles = response.profiles || profiles;
  }
  await chrome.storage.local.set({ [SELECTED_KEY]: selectedId, [SCORE_KEY]: scoreFormula });
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
    await saveAll();
  });
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
    const selectBtn = el('button', 'profile-select' + (id === selectedId ? ' selected' : ''), id === selectedId ? '✓ Active' : 'Select');
    selectBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      selectedId = id;
      await saveAll();
      renderProfileList();
    });
    actions.appendChild(selectBtn);
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
    selectedId = select.value;
    await saveAll();
    await openEditor(select.value);
  };
  const newButton = $('#btn-editor-new-profile');
  if (newButton) newButton.onclick = () => openEditor('new');
}

async function deleteProfileById(id) {
  if (!profiles[id] || !confirm('Delete ' + (profiles[id].name || 'this character') + '?')) return false;
  delete profiles[id];
  if (selectedId === id) selectedId = Object.keys(profiles)[0] || '';
  await saveAll([], [id]);
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
      statsVersion: p.statsVersion || 0,
      importedFrom: p.importedFrom || '',
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
      })),
    };
    $('#editor-title').textContent = 'Edit: ' + (p.name || 'Unnamed');
    $('#btn-delete-profile').classList.remove('hidden');
  }
  $('#profile-list-section').classList.add('hidden');
  $('#profile-editor-section').classList.remove('hidden');
  renderEditorProfileSelector();
  renderEditor();
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

function renderWishlist() {
  const list = $('#wishlist-list');
  if (!list || !editingProfile) return;
  const wishlist = Array.isArray(editingProfile.wishlist) ? editingProfile.wishlist : [];
  $('#wishlist-count').textContent = wishlist.length + ' item' + (wishlist.length === 1 ? '' : 's');
  if (!wishlist.length) {
    list.replaceChildren(el('div', 'wishlist-empty', 'No wishlist items yet.'));
    return;
  }
  list.replaceChildren(...wishlist.map((item) => {
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
  }));
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
  const showAugments = activeInventoryTab === 'augments';
  const showFocus = activeInventoryTab === 'focus';
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
    document.querySelectorAll('[data-inventory-tab]').forEach((tab) => {
      const active = tab.dataset.inventoryTab === activeInventoryTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
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
    box.title = entries.length ? entries.map((entry) => entry.item.name || 'Unnamed item').join(' / ') : 'Empty ' + label + ' slot';
    const glyph = el('span', 'gear-glyph', SLOT_ICONS[root] || '✦');
    glyph.setAttribute('aria-hidden', 'true');
    const name = el('span', 'gear-slot-name', entries.length ? entries.map((entry) => entry.item.name || 'Unnamed').join(' / ') : label);
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
  document.querySelectorAll('[data-inventory-tab]').forEach((tab) => {
    const active = tab.dataset.inventoryTab === activeInventoryTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function hasNumericStats(item) {
  return Object.values(item.stats || {}).some((value) => {
    const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
    return num != null && !isNaN(num);
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
  const detailsLabel = document.querySelector('.item-details-label');
  if (detailsLabel) detailsLabel.textContent = focusView ? 'GEAR EFFECT DETAILS' : 'ITEM DETAILS';
  if (editButton) editButton.hidden = focusView;
  if (addItemButton) addItemButton.hidden = focusView;
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
          if (newKey && newKey !== key) {
            const val = item.stats[key];
            delete item.stats[key];
            item.stats[newKey] = val;
            renderItemList();
          }
        });
        const valInput = el('input');
        valInput.className = 'stat-value';
        valInput.type = 'number';
        valInput.value = item.stats[key];
        valInput.placeholder = '0';
        valInput.disabled = !itemsEditable;
        valInput.addEventListener('input', () => { item.stats[key] = valInput.value; });
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
  const name = $('#profile-name').value.trim();
  if (!name) { alert('Please enter a character name.'); return; }
  editingProfile.name = name;
  editingProfile.cls = $('#profile-class').value;
  editingProfile.level = $('#profile-level').value.trim();
  // Clean up items: remove empty ones, normalize stats
  editingProfile.items = editingProfile.items
    .filter((it) => it.name && it.slot)
    .map((it) => {
      const stats = {};
      for (const k of Object.keys(it.stats)) {
        const key = k.trim();
        const v = parseFloat(it.stats[k]);
        if (key && !isNaN(v)) stats[key] = v;
      }
      return {
        id: it.id, name: it.name, icon: it.icon || '', slot: it.slot,
        isAugment: !!it.isAugment, augmentTypes: Array.isArray(it.augmentTypes) ? [...it.augmentTypes] : [],
        augSlot: it.augSlot || '', parentId: it.parentId || '', enriched: !!it.enriched, stats, effects: it.effects || [],
      };
    });
  let savedId = editingId;
  if (editingId === 'new') {
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    editingProfile.id = id;
    profiles[id] = { ...editingProfile, wishlist: [] };
    savedId = id;
    if (!selectedId) selectedId = id;
  } else {
    profiles[editingId] = editingProfile;
  }
  await saveAll([savedId]);
  editingId = savedId;
  $('#editor-title').textContent = 'Edit: ' + (editingProfile.name || 'Unnamed');
  $('#btn-delete-profile').classList.remove('hidden');
  renderEditorProfileSelector();
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

// Convert raidloot item stats ({raw,num}) to the options-page plain format.
function statsToPlain(stats) {
  const out = {};
  for (const k of Object.keys(stats || {})) {
    const v = stats[k];
    const num = v && typeof v === 'object' && 'num' in v ? v.num : parseFloat(v);
    if (num != null && !isNaN(num)) out[k] = num;
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
  if (!selectedId) selectedId = id;
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
    if (area !== 'local' || !changes[PROFILES_KEY]) return;
    profiles = changes[PROFILES_KEY].newValue || {};
    if (editingId && editingId !== 'new' && editingProfile && profiles[editingId]) {
      editingProfile.wishlist = Array.isArray(profiles[editingId].wishlist)
        ? profiles[editingId].wishlist.map((item) => ({ ...item })) : [];
      renderWishlist();
    } else if (!editingId) {
      renderProfileList();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
