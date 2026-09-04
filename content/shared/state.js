// Loot Captain - state helpers (selected profile, formula)

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};

  const PROFILES_KEY = 'profiles';
  const SELECTED_KEY = 'selectedProfileId';
  const COMPARE_KEY = 'compareProfileIds';
  const LAYOUT_KEY = 'compareBadgeLayout';
  const SCORE_KEY = 'scoreFormula';
  const PROFILE_STATS_VERSION = 4;
  const NON_NUMERIC_STAT = /^(?:slot|class|race|type|deity|skill|effect|click|focus|tools|required|restriction|lore|aug)/i;
  let profileLoadGeneration = 0;
  const profileRefreshes = new Map();

  // profiles: { id: { id, name, cls, level, items: [...], wishlist: [...] } }
  async function getProfiles() {
    return await LC.ui.store.get(PROFILES_KEY, {});
  }
  async function saveProfiles(profiles, expectedProfiles) {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PROFILES', profiles, expectedProfiles: expectedProfiles || {}, deletedIds: [],
    });
    return response && response.ok ? response.profiles : null;
  }
  async function getSelectedId() {
    return await LC.ui.store.get(SELECTED_KEY, '');
  }
  async function setSelectedId(id) {
    await LC.ui.store.set(SELECTED_KEY, id);
  }
  // The characters picked for comparison. Selection is symmetric -- there is
  // no separate "active" character; the first selected profile acts as the
  // reference for per-stat indicators. The legacy single-character selection
  // (selectedProfileId) migrates into this list once.
  async function getCompareIds() {
    const ids = await LC.ui.store.get(COMPARE_KEY, []);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id) : [];
  }
  async function setCompareIds(ids) {
    await LC.ui.store.set(COMPARE_KEY, Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id) : []);
  }
  // How inline badges present multi-character results: 'collapsed' shows the
  // best character plus a count, 'expanded' shows every character in the row.
  async function getBadgeLayout() {
    const layout = await LC.ui.store.get(LAYOUT_KEY, 'collapsed');
    return layout === 'expanded' ? 'expanded' : 'collapsed';
  }
  // Normalize item stats to { raw, num } format and compute slotKey.
  // The options page stores stats as plain values (e.g. { HP: 123 }) and
  // slot as a raw string; the diff engine expects { raw, num } + slotKey.
  function normalizeItemStats(item) {
    const stats = {};
    const sourceStats = LC.parser.normalizeStats(item.stats || {});
    for (const k of Object.keys(sourceStats)) {
      if (NON_NUMERIC_STAT.test(k)) continue;
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
      effects: LC.parser.normalizeEffects(item.effects || []),
      stats,
    };
  }

  function hasNumericStats(item) {
    return Object.values(item.stats || {}).some((value) => {
      const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
      return num != null && !isNaN(num);
    });
  }

  function hasItemData(item) {
    return hasNumericStats(item) || (item && Array.isArray(item.effects) && item.effects.length > 0);
  }

  function hasAugmentTypes(item) {
    return !item.isAugment || (Array.isArray(item.augmentTypes) && item.augmentTypes.length > 0);
  }

  async function loadMissingStats(items, refreshAll) {
    const missing = items.filter((item) => (item.id || item.name) &&
      (refreshAll || ((!hasItemData(item) || !hasAugmentTypes(item)) && !item.enriched)));
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
        if (!loaded) return item;
        const enriched = (hasItemData(loaded) || loaded.icon) ? normalizeItemStats({
          ...item,
          ...loaded,
          isAugment: !!item.isAugment || !!loaded.isAugment,
          augmentTypes: (Array.isArray(loaded.augmentTypes) && loaded.augmentTypes.length)
            ? [...loaded.augmentTypes] : (item.augmentTypes || []),
          augSlot: item.augSlot || loaded.augSlot || '',
          parentId: item.parentId || loaded.parentId || '',
        }) : item;
        return { ...enriched, enriched: true };
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
    return {
      id: item.id || '', name: item.name || '', icon: item.icon || '', slot: item.slot || '',
      isAugment: !!item.isAugment, augmentTypes: Array.isArray(item.augmentTypes) ? [...item.augmentTypes] : [],
      augSlot: item.augSlot || '', parentId: item.parentId || '', enriched: !!item.enriched, stats,
      effects: LC.parser.normalizeEffects(item.effects || []),
    };
  }

  function cleanId(value) {
    return String(value || '').trim();
  }

  function cleanName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function wishlistStats(item) {
    const stats = {};
    for (const [key, value] of Object.entries(item && item.stats || {})) {
      const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
      if (num != null && !isNaN(num)) stats[key] = num;
    }
    return stats;
  }

  function wishlistSlot(item) {
    const slotKey = item && (item.slotKey || LC.slots.canonicalSlot(item.slot));
    return slotKey && slotKey.key || '';
  }

  function normalizeWishlistEntry(item, existing) {
    const current = existing || {};
    const candidateStats = wishlistStats(item);
    const currentStats = wishlistStats(current);
    const candidateEffects = LC.parser.normalizeEffects(item && item.effects || []);
    const currentEffects = LC.parser.normalizeEffects(current.effects || []);
    return {
      raidlootId: cleanId(item && item.raidlootId || current.raidlootId),
      opendkpHost: String(item && item.opendkpHost || current.opendkpHost || '').trim().toLowerCase(),
      opendkpId: cleanId(item && item.opendkpId || current.opendkpId),
      name: String(item && item.name || current.name || '').trim(),
      slot: String(item && item.slot || current.slot || '').trim(),
      isAugment: !!(item && item.isAugment || current.isAugment),
      augmentTypes: [...new Set([...(current.augmentTypes || []), ...(item && item.augmentTypes || [])].map(String))],
      stats: { ...currentStats, ...candidateStats },
      effects: candidateEffects.length >= currentEffects.length ? candidateEffects : currentEffects,
      addedAt: Number(current.addedAt || item && item.addedAt) || Date.now(),
    };
  }

  function wishlistMatches(entry, item) {
    if (!entry || !item) return false;
    const entryRaidlootId = cleanId(entry.raidlootId);
    const itemRaidlootId = cleanId(item.raidlootId);
    if (entryRaidlootId && itemRaidlootId) return entryRaidlootId === itemRaidlootId;
    const entryOpenDkpId = cleanId(entry.opendkpId);
    const itemOpenDkpId = cleanId(item.opendkpId);
    const entryHost = String(entry.opendkpHost || '').trim().toLowerCase();
    const itemHost = String(item.opendkpHost || '').trim().toLowerCase();
    if (entryOpenDkpId && itemOpenDkpId && entryHost && entryHost === itemHost) return entryOpenDkpId === itemOpenDkpId;
    return !!cleanName(entry.name) && cleanName(entry.name) === cleanName(item.name) &&
      !!wishlistSlot(entry) && wishlistSlot(entry) === wishlistSlot(item);
  }

  function findWishlistEntry(profile, item) {
    return (profile && profile.wishlist || []).find((entry) => wishlistMatches(entry, item)) || null;
  }

  function wishlistItem(entry) {
    return normalizeItemStats({
      ...entry,
      id: entry.raidlootId || entry.opendkpId || '',
      effects: entry.effects || [],
      stats: entry.stats || {},
    });
  }

  function itemLayout(item) {
    if (!item || item.isAugment) return '';
    const slotKey = item.slotKey || LC.slots.canonicalSlot(item.slot);
    const keys = slotKey && (slotKey.keys || [slotKey.key]) || [];
    if (keys.includes('range')) return 'range';
    if (keys.includes('primary') && keys.includes('secondary')) return 'one-hand';
    if (keys.length === 1 && keys[0] === 'primary') return 'two-hand';
    return '';
  }

  function compatibleWishlistItem(candidate, target) {
    if (!candidate || !target || !!candidate.isAugment !== !!target.isAugment) return false;
    if (candidate.isAugment) {
      const targetTypes = new Set((target.augmentTypes || []).map(String));
      return (candidate.augmentTypes || []).some((type) => targetTypes.has(String(type)));
    }
    const candidateSlot = candidate.slotKey || LC.slots.canonicalSlot(candidate.slot);
    const targetSlot = target.slotKey || LC.slots.canonicalSlot(target.slot);
    const candidateKeys = candidateSlot && (candidateSlot.keys || [candidateSlot.key]) || [];
    const targetKeys = new Set(targetSlot && (targetSlot.keys || [targetSlot.key]) || []);
    if (!candidateKeys.some((key) => targetKeys.has(key))) return false;
    const candidateLayout = itemLayout(candidate);
    const targetLayout = itemLayout(target);
    return !candidateLayout && !targetLayout || candidateLayout === targetLayout;
  }

  function wishlistTargets(profile, candidate) {
    return (profile && profile.wishlist || [])
      .filter((entry) => !wishlistMatches(entry, candidate))
      .map(wishlistItem)
      .filter((entry) => compatibleWishlistItem(candidate, entry));
  }

  // Wishlist comparison targets across every selected character, paired with
  // the character that wants them (for level-aware diffing and enrichment).
  // Characters that cannot wear the candidate item are skipped, since the
  // comparison would be meaningless for them.
  function wishlistTargetPairs(profiles, candidate) {
    const pairs = [];
    for (const profile of profiles || []) {
      if (!LC.parser.canWear(candidate, profile)) continue;
      for (const target of wishlistTargets(profile, candidate)) {
        pairs.push({ target, profile });
      }
    }
    return pairs;
  }

  function wishlistNeedsMerge(entry, item, profile) {
    if (!entry || !item) return false;
    if (profile && (profile.wishlist || []).filter((candidate) => wishlistMatches(candidate, item)).length > 1) return true;
    const merged = normalizeWishlistEntry(item, entry);
    return JSON.stringify(normalizeWishlistEntry(entry)) !== JSON.stringify(merged);
  }

  async function wishlistMutation(action, item, profileId) {
    const id = profileId || await getSelectedId();
    if (!id) return { ok: false, wanted: false };
    try {
      return await chrome.runtime.sendMessage({
        type: 'MUTATE_WISHLIST',
        profileId: id,
        action,
        item: normalizeWishlistEntry(item),
      });
    } catch (e) {
      return { ok: false, wanted: false };
    }
  }

  async function mergeWishlistCandidate(item, profileId) {
    const result = await wishlistMutation('merge', item, profileId);
    return result && result.entry || null;
  }

  function toggleWishlist(item, profileId) {
    return wishlistMutation('toggle', item, profileId);
  }

  async function enrichWishlistEntry(entry, profileId) {
    const target = wishlistItem(entry);
    if (hasItemData(target)) return target;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ENRICH_PROFILE_ITEMS',
        items: [{ id: entry.raidlootId || '', name: entry.name || '', slot: entry.slot || '' }],
      });
      const loaded = response && response.ok && response.items && response.items[0];
      if (!loaded) return target;
      const resolved = wishlistItem(normalizeWishlistEntry({ ...loaded, raidlootId: loaded.id || entry.raidlootId }, entry));
      mergeWishlistCandidate(resolved, profileId).catch(() => {});
      return resolved;
    } catch (e) {
      return target;
    }
  }

  function refreshProfileInBackground(id, profile, items) {
    if (profileRefreshes.has(id)) return;
    const refresh = loadMissingStats(items, true).then(async (loaded) => {
      if (!loaded.fetched) return;
      const latestProfiles = await getProfiles();
      if (latestProfiles[id] && JSON.stringify(latestProfiles[id]) === JSON.stringify(profile)) {
        const updated = { ...latestProfiles[id], statsVersion: PROFILE_STATS_VERSION, items: loaded.items.map(storageItem) };
        await saveProfiles({ [id]: updated }, { [id]: profile });
      }
    }).catch(() => {}).finally(() => profileRefreshes.delete(id));
    profileRefreshes.set(id, refresh);
  }

  async function getProfileById(id) {
    if (!id) return null;
    const profiles = await getProfiles();
    const p = profiles[id];
    if (!p) return null;
    const originalItems = (p.items || []).map(normalizeItemStats);
    const refreshAll = p.statsVersion !== PROFILE_STATS_VERSION;
    if (refreshAll && originalItems.some(hasNumericStats)) {
      refreshProfileInBackground(id, p, originalItems);
      return { ...p, id, items: originalItems };
    }
    const loaded = await loadMissingStats(originalItems, refreshAll);
    const items = loaded.items;
    if (refreshAll || loaded.fetched || items.some((item, index) => hasNumericStats(item) && !hasNumericStats(originalItems[index]))) {
      const latestProfiles = await getProfiles();
      if (latestProfiles[id] && JSON.stringify(latestProfiles[id]) === JSON.stringify(p)) {
        const updated = { ...latestProfiles[id], statsVersion: PROFILE_STATS_VERSION, items: items.map(storageItem) };
        await saveProfiles({ [id]: updated }, { [id]: p });
      }
    }
    return { ...p, id, items };
  }
  async function getSelectedProfile() {
    return await getProfileById(await getSelectedId());
  }
  // Every selected character, in the order picked. The legacy single
  // "active character" selection migrates into the compare list once.
  async function getSelectedProfiles() {
    let ids = await getCompareIds();
    if (!ids.length) {
      const legacy = await getSelectedId();
      if (legacy) {
        ids = [legacy];
        await setCompareIds(ids);
      }
    }
    const loaded = await Promise.all(ids.map((id) => getProfileById(id)));
    return loaded.filter(Boolean);
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
    LC.currentProfiles = [];
    LC.currentBadgeLayout = 'collapsed';
    LC.currentFormula = null;
    const profiles = await getSelectedProfiles();
    if (generation !== profileLoadGeneration) return;
    const formula = await getFormula();
    const badgeLayout = await getBadgeLayout();
    if (generation !== profileLoadGeneration) return;
    // The first selected profile is the reference for per-stat indicators.
    LC.currentProfile = profiles[0] || null;
    LC.currentProfiles = profiles;
    LC.currentBadgeLayout = badgeLayout;
    if (profiles.length) LC.currentFormula = formula;
  }

  LC.state = {
    PROFILES_KEY,
    SELECTED_KEY,
    COMPARE_KEY,
    LAYOUT_KEY,
    SCORE_KEY,
    getProfiles,
    saveProfiles,
    getSelectedId,
    setSelectedId,
    getCompareIds,
    setCompareIds,
    getBadgeLayout,
    getProfileById,
    getSelectedProfile,
    getSelectedProfiles,
    getFormulaKey: getScoreFormulaKey,
    setFormulaKey: setScoreFormulaKey,
    getFormula,
    loadAndCacheProfile,
    normalizeWishlistEntry,
    wishlistMatches,
    findWishlistEntry,
    compatibleWishlistItem,
    wishlistTargets,
    wishlistTargetPairs,
    wishlistNeedsMerge,
    mergeWishlistCandidate,
    toggleWishlist,
    enrichWishlistEntry,
  };
})();
