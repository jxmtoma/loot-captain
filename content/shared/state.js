// Loot Captain - state helpers (selected profile, formula)

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};

  const PROFILES_KEY = 'profiles';
  const SELECTED_KEY = 'selectedProfileId';
  const SCORE_KEY = 'scoreFormula';
  const PROFILE_STATS_VERSION = 2;
  let profileLoadGeneration = 0;

  // profiles: { id: { id, name, cls, level, items: [...] } }
  async function getProfiles() {
    return await LC.ui.store.get(PROFILES_KEY, {});
  }
  async function saveProfiles(profiles) {
    await LC.ui.store.set(PROFILES_KEY, profiles);
  }
  async function getSelectedId() {
    return await LC.ui.store.get(SELECTED_KEY, '');
  }
  async function setSelectedId(id) {
    await LC.ui.store.set(SELECTED_KEY, id);
  }
  // Normalize item stats to { raw, num } format and compute slotKey.
  // The options page stores stats as plain values (e.g. { HP: 123 }) and
  // slot as a raw string; the diff engine expects { raw, num } + slotKey.
  function normalizeItemStats(item) {
    const stats = {};
    const sourceStats = LC.parser.normalizeStats(item.stats || {});
    for (const k of Object.keys(sourceStats)) {
      const v = sourceStats[k];
      if (v && typeof v === 'object' && 'num' in v) {
        stats[k] = v;
      } else {
        const num = parseFloat(v);
        stats[k] = { raw: String(v), num: isNaN(num) ? null : num };
      }
    }
    return {
      ...item,
      slotKey: LC.slots.canonicalSlot(item.slot),
      stats,
    };
  }

  function hasNumericStats(item) {
    return Object.values(item.stats || {}).some((value) => {
      const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
      return num != null && !isNaN(num);
    });
  }

  async function loadMissingStats(items, refreshAll) {
    const missing = items.filter((item) => (item.id || item.name) && (refreshAll || !hasNumericStats(item)));
    if (!missing.length) return { items, fetched: false };
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ENRICH_PROFILE_ITEMS',
        items: missing.map(({ id, name, slot }) => ({ id, name, slot })),
      });
      if (!response || !response.ok) return { items, fetched: false };
      const byId = new Map((response.items || [])
        .filter((item) => item && item.id)
        .map((item) => [String(item.id), item]));
      const byName = new Map((response.items || [])
        .filter((item) => item && item.name)
        .map((item) => [String(item.name).trim().toLowerCase().replace(/\s+/g, ' '), item]));
      return { items: items.map((item) => {
        const nameKey = String(item.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const loaded = (item.id && byId.get(String(item.id))) || byName.get(nameKey);
        return loaded && hasNumericStats(loaded) ? normalizeItemStats({ ...item, ...loaded }) : item;
      }), fetched: true };
    } catch (e) {
      return { items, fetched: false };
    }
  }

  function storageItem(item) {
    const stats = {};
    for (const [key, value] of Object.entries(item.stats || {})) {
      const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
      if (num != null && !isNaN(num)) stats[key] = num;
    }
    return { id: item.id || '', name: item.name || '', slot: item.slot || '', stats };
  }

  async function getSelectedProfile() {
    const id = await getSelectedId();
    if (!id) return null;
    const profiles = await getProfiles();
    const p = profiles[id];
    if (!p) return null;
    const originalItems = (p.items || []).map(normalizeItemStats);
    const loaded = await loadMissingStats(originalItems, p.statsVersion !== PROFILE_STATS_VERSION);
    const items = loaded.items;
    if (loaded.fetched || items.some((item, index) => hasNumericStats(item) && !hasNumericStats(originalItems[index]))) {
      const latestProfiles = await getProfiles();
      if (latestProfiles[id] && JSON.stringify(latestProfiles[id]) === JSON.stringify(p)) {
        latestProfiles[id] = { ...latestProfiles[id], statsVersion: PROFILE_STATS_VERSION, items: items.map(storageItem) };
        await saveProfiles(latestProfiles);
      }
    }
    return { ...p, id, items };
  }
  async function getScoreFormulaKey() {
    return await LC.ui.store.get(SCORE_KEY, LC.diff.DEFAULT_FORMULA_KEY);
  }
  async function setScoreFormulaKey(key) {
    await LC.ui.store.set(SCORE_KEY, key);
  }
  async function getFormula() {
    const key = await getScoreFormulaKey();
    return LC.diff.SCORE_FORMULAS.find((f) => f.key === key) || LC.diff.SCORE_FORMULAS[0];
  }

  async function loadAndCacheProfile() {
    const generation = ++profileLoadGeneration;
    LC.currentProfile = null;
    LC.currentFormula = null;
    const profile = await getSelectedProfile();
    if (generation !== profileLoadGeneration) return;
    const formula = await getFormula();
    if (generation !== profileLoadGeneration) return;
    if (profile) {
      LC.currentProfile = profile;
      LC.currentFormula = formula;
    }
  }

  LC.state = {
    PROFILES_KEY,
    SELECTED_KEY,
    SCORE_KEY,
    getProfiles,
    saveProfiles,
    getSelectedId,
    setSelectedId,
    getSelectedProfile,
    getFormulaKey: getScoreFormulaKey,
    setFormulaKey: setScoreFormulaKey,
    getFormula,
    loadAndCacheProfile,
  };
})();
