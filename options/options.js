// Loot Captain - options page (profile manager)

const PROFILES_KEY = 'profiles';
const SELECTED_KEY = 'selectedProfileId';
const SCORE_KEY = 'scoreFormula';
const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;
const PROFILE_STATS_VERSION = 2;
const DEFAULT_FORMULA_KEY = 'ac10hp';
const SCORE_FORMULAS = [
  { key: 'ac10hp', label: '1AC = 10HP' },
  { key: 'ac15hp', label: '1AC = 15HP' },
  { key: 'hdex', label: '1HDex = 4AC = 40HP' },
  { key: 'hagi', label: '1HAgi = 4AC = 40HP' },
  { key: 'hp', label: 'HP' },
  { key: 'mana', label: 'Mana' },
  { key: 'end', label: 'Endurance' },
  { key: 'endregen', label: 'End Regen' },
  { key: 'netpos', label: 'Net positive' },
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

// ---------- Storage ----------
async function loadAll() {
  const res = await chrome.storage.local.get([PROFILES_KEY, SELECTED_KEY, SCORE_KEY]);
  profiles = res[PROFILES_KEY] || {};
  selectedId = res[SELECTED_KEY] || '';
  scoreFormula = SCORE_FORMULAS.some((formula) => formula.key === res[SCORE_KEY]) ? res[SCORE_KEY] : DEFAULT_FORMULA_KEY;
}
async function saveAll() {
  await chrome.storage.local.set({ [PROFILES_KEY]: profiles, [SELECTED_KEY]: selectedId, [SCORE_KEY]: scoreFormula });
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
    const option = el('option', '', profiles[id].name || 'Unnamed');
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
  await saveAll();
  return true;
}

// ---------- View: editor ----------
async function openEditor(id) {
  editingId = id;
  if (id === 'new') {
    editingProfile = { id: '', name: '', cls: '', level: '', items: [] };
    $('#editor-title').textContent = 'New Character';
    $('#btn-delete-profile').classList.add('hidden');
  } else {
    const p = profiles[id];
    editingProfile = {
      id: p.id,
      name: p.name || '',
      cls: p.cls || '',
      level: p.level || '',
      statsVersion: p.statsVersion || 0,
      items: (p.items || []).map((it) => ({
        id: it.id || '',
        name: it.name || '',
        slot: it.slot || '',
        stats: Object.assign({}, it.stats || {}),
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
  $('#profile-editor-section').classList.add('hidden');
  $('#profile-list-section').classList.remove('hidden');
  renderProfileList();
}

function renderEditor() {
  $('#profile-name').value = editingProfile.name;
  $('#profile-class').value = editingProfile.cls;
  $('#profile-level').value = editingProfile.level;
  $('#profile-name').oninput = renderInventoryPreview;
  $('#profile-class').oninput = renderInventoryPreview;
  $('#profile-level').oninput = renderInventoryPreview;
  renderItemList();
}

const INVENTORY_LEFT_SLOTS = ['head', 'face', 'shoulders', 'arms', 'back', 'range', 'hands', 'primary'];
const INVENTORY_RIGHT_SLOTS = ['ear', 'neck', 'wrist', 'chest', 'finger', 'legs', 'feet', 'secondary'];

function renderInventoryPreview() {
  const left = $('#inventory-left');
  const right = $('#inventory-right');
  if (!left || !right || !editingProfile) return;
  const grouped = {};
  editingProfile.items.forEach((item, index) => {
    if (!item.slot) return;
    (grouped[item.slot] || (grouped[item.slot] = [])).push({ item, index });
  });
  const makeSlot = (slot) => {
    const entries = grouped[slot] || [];
    const box = el('div', 'gear-slot' + (entries.length ? ' filled' : ''));
    box.title = entries.length ? entries.map((entry) => entry.item.name || 'Unnamed item').join(' / ') : 'Empty ' + slot + ' slot';
    const glyph = el('span', 'gear-glyph', slot.slice(0, 2).toUpperCase());
    const label = el('span', 'gear-slot-name', entries.length ? entries.map((entry) => entry.item.name || 'Unnamed').join(' / ') : slot);
    box.appendChild(glyph);
    box.appendChild(label);
    if (entries.length) {
      const focus = () => {
        document.querySelectorAll('.item-row.selected').forEach((row) => row.classList.remove('selected'));
        const row = document.querySelector('.item-row[data-item-index="' + entries[0].index + '"]');
        if (!row) return;
        row.classList.add('selected');
        const panel = document.querySelector('.item-details-panel');
        if (panel) panel.scrollTo({ top: Math.max(0, row.offsetTop - panel.clientHeight / 3), behavior: 'smooth' });
      };
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.addEventListener('click', focus);
      box.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focus(); } });
    }
    return box;
  };
  left.replaceChildren(...INVENTORY_LEFT_SLOTS.map(makeSlot));
  right.replaceChildren(...INVENTORY_RIGHT_SLOTS.map(makeSlot));
  const meta = [editingProfile.cls, editingProfile.level ? 'Level ' + editingProfile.level : '', editingProfile.items.length + ' items'].filter(Boolean).join(' · ') || 'Local profile';
  $('#inventory-stage-name').textContent = editingProfile.name || 'Unnamed Character';
  $('#inventory-stage-meta').textContent = meta;
  $('#inventory-slot-count').textContent = editingProfile.items.length + ' / 19 worn slots';
}

function hasNumericStats(item) {
  return Object.values(item.stats || {}).some((value) => {
    const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
    return num != null && !isNaN(num);
  });
}

function normalizedName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadEditorStats(profile) {
  if (!profile || editingProfile !== profile) return;
  const refreshAll = profile.statsVersion !== PROFILE_STATS_VERSION;
  const pending = profile.items.filter((item) => (item.id || item.name) && (refreshAll || !hasNumericStats(item)));
  if (!pending.length) {
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
    for (const item of profile.items) {
      const loaded = (item.id && byId.get(String(item.id))) || byName.get(normalizedName(item.name));
      if (!loaded || !hasNumericStats(loaded)) continue;
      item.id = loaded.id || item.id || '';
      item.slot = item.slot || loaded.slot || '';
      item.stats = statsToPlain(loaded.stats);
      loadedCount++;
    }
    renderItemList();
    if (editingId !== 'new' && loadedCount) {
      profiles[editingId] = { ...profiles[editingId], statsVersion: PROFILE_STATS_VERSION, items: profile.items };
      await saveAll();
    }
    $('#editor-status').textContent = loadedCount ? 'Loaded stats for ' + loadedCount + ' item' + (loadedCount === 1 ? '' : 's') : 'No matching RaidLoot stats found';
  } catch (e) {
    $('#editor-status').textContent = 'Could not load RaidLoot stats';
  }
}

function renderItemList() {
  const list = $('#item-list');
  list.innerHTML = '';
  renderInventoryPreview();
  if (!editingProfile.items.length) {
    list.appendChild(el('div', 'empty-state', 'No worn items. Add one to start comparing.'));
    return;
  }
  editingProfile.items.forEach((item, idx) => {
    const row = el('div', 'item-row');
    row.dataset.itemIndex = idx;
    const header = el('div', 'item-row-header');
    header.appendChild(el('span', 'item-name', item.name || ('Item ' + (idx + 1))));
    const actions = el('div', 'item-actions');
    const removeBtn = el('button', 'btn-remove', 'Remove');
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
    nameInput.addEventListener('input', () => {
      if (nameInput.value !== item.name) {
        item.name = nameInput.value;
        item.id = '';
        item.stats = {};
      }
      header.querySelector('.item-name').textContent = nameInput.value || ('Item ' + (idx + 1));
      renderInventoryPreview();
    });
    nameLbl.appendChild(nameInput);
    fields.appendChild(nameLbl);

    const slotLbl = el('label', '', 'Slot');
    const slotSel = el('select');
    slotSel.innerHTML = '<option value="">- select -</option>' + EQUIPMENT_SLOTS.map((s) => '<option value="' + s + '">' + s + '</option>').join('');
    slotSel.value = item.slot;
    slotSel.addEventListener('change', () => { item.slot = slotSel.value; renderInventoryPreview(); });
    slotLbl.appendChild(slotSel);
    fields.appendChild(slotLbl);
    row.appendChild(fields);

    // Stats
    const statsBlock = el('div', 'item-stats');
    const statsHeader = el('div', 'item-stats-header');
    statsHeader.appendChild(el('span', '', 'Stats'));
    const addStatBtn = el('button', 'btn-remove', '+ Stat');
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
        valInput.addEventListener('input', () => { item.stats[key] = valInput.value; });
        const rmBtn = el('button', 'btn-remove btn-remove-stat', '×');
        rmBtn.addEventListener('click', () => {
          delete item.stats[key];
          renderItemList();
        });
        statRow.appendChild(nameInput);
        statRow.appendChild(valInput);
        statRow.appendChild(rmBtn);
        statsBlock.appendChild(statRow);
      }
    }
    row.appendChild(statsBlock);
    list.appendChild(row);
  });
}

// ---------- Save ----------
async function saveProfile() {
  const name = $('#profile-name').value.trim();
  if (!name) { alert('Please enter a character name.'); return; }
  editingProfile.name = name;
  editingProfile.cls = $('#profile-class').value.trim();
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
      return { id: it.id, name: it.name, slot: it.slot, stats };
    });
  if (editingId === 'new') {
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    editingProfile.id = id;
    profiles[id] = editingProfile;
    if (!selectedId) selectedId = id;
  } else {
    profiles[editingId] = editingProfile;
  }
  await saveAll();
  closeEditor();
}

async function deleteProfile() {
  if (!editingId || editingId === 'new') return;
  if (await deleteProfileById(editingId)) closeEditor();
}

// ---------- EQ inventory file import ----------
// Worn equipment locations from the /output inventory file. Sub-slots
// (e.g. "Ear-Slot1") are augments, not worn items, and are skipped.
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
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.indexOf('KeyRing') === 0) { inKeyRing = true; continue; }
    if (inKeyRing) continue; // keyring section (different columns, not worn)
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    const [location, name, idStr] = cols;
    if (location === 'Location') continue; // header row
    if (/-Slot\d+$/.test(location)) continue; // augments/ornaments, not worn
    if (!EQUIPMENT_LOCATIONS.has(location)) continue; // bags/bank/etc.
    if (!name || name === 'Empty') continue;
    items.push({
      name,
      id: idStr,
      slot: slotFromLocation(location),
      stats: {},
    });
  }
  return items;
}

// Read character metadata when the inventory export includes labeled fields.
function parseInventoryMetadata(text) {
  const metadata = { name: '', cls: '', level: '' };
  for (const line of String(text || '').split(/\r?\n/)) {
    const field = line.match(/^\s*([^:\t=]+?)\s*(?::|=|\t)\s*(.*?)\s*$/);
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

function raidlootProfileId(value) {
  const input = String(value || '').trim();
  const urlMatch = input.match(/\/profile\/(\d+)(?:[/?#]|$)/i);
  return urlMatch ? urlMatch[1] : (/^\d+$/.test(input) ? input : '');
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
    return (response.items || items).map((item) => ({ ...item, stats: statsToPlain(item.stats) }));
  } catch (e) {
    return items;
  }
}

function addImportedProfile({ name, cls, level, server, items, statsVersion, importedFrom }) {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  profiles[id] = {
    id,
    name: name || 'Imported Character',
    cls: cls || '',
    level: level || '',
    server: server || '',
    statsVersion: statsVersion || 0,
    items,
    importedFrom: importedFrom || '',
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
    const items = (profile.items || []).map((item) => ({
      id: item.id || '',
      name: item.name || '',
      slot: item.slot || '',
      stats: statsToPlain(item.stats),
    })).filter((item) => item.name && item.slot);
    if (!items.length) throw new Error('RaidLoot returned no worn items; check the profile ID');
    addImportedProfile({
      name: profile.name || 'RaidLoot ' + profileId,
      cls: profile.cls,
      level: profile.level,
      items,
      statsVersion: PROFILE_STATS_VERSION,
      importedFrom: 'raidloot.com/profile/' + profileId,
    });
    await saveAll();
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
    addImportedProfile({
      name: profileName,
      cls: inventoryMetadata.cls,
      level: inventoryMetadata.level,
      server: filenameMetadata.server,
      items,
      statsVersion: fetchStats ? PROFILE_STATS_VERSION : 0,
      importedFrom: file.name,
    });
    await saveAll();
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
  renderFormulaSelect();
  $('#btn-new-profile').addEventListener('click', () => openEditor('new'));
  $('#btn-back').addEventListener('click', closeEditor);
  $('#btn-save-profile').addEventListener('click', saveProfile);
  $('#btn-delete-profile').addEventListener('click', deleteProfile);
  $('#btn-import-raidloot').addEventListener('click', importRaidlootProfile);
  $('#btn-clear-debug').addEventListener('click', () => { $('#debug-log').textContent = 'No diagnostics yet.'; });
  $('#btn-add-item').addEventListener('click', () => {
    editingProfile.items.push({ id: '', name: '', slot: '', stats: {} });
    renderItemList();
  });
  $('#inventory-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleInventoryFile(file);
    e.target.value = ''; // allow re-selecting the same file
  });
  renderProfileList();
}

document.addEventListener('DOMContentLoaded', init);
