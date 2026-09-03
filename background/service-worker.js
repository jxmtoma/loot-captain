// Loot Captain - background service worker
// Handles cross-origin fetches (raidloot profile scrape) and storage.

const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;
const MAX_ID_LENGTH = 12;
const MAX_NAME_LENGTH = 200;
const MAX_ITEM_COUNT = 128;
const RAIDLOOT_ITEM_CACHE_KEY = 'raidlootItemCache';
const MAX_RAIDLOOT_CACHE_ENTRIES = 256;
const MAX_RAIDLOOT_CACHE_BYTES = 2 * 1024 * 1024;
const MAX_WISHLIST_ITEM_BYTES = 128 * 1024;
const MAX_PROFILE_MUTATION_BYTES = 4 * 1024 * 1024;
let profileMutationQueue = Promise.resolve();

importScripts('raidloot-parser.js', 'armor-token-catalog.js');

const ARMOR_CLASS_NAMES = {
  WAR: 'Warrior', CLR: 'Cleric', PAL: 'Paladin', RNG: 'Ranger', SHD: 'ShadowKnight',
  DRU: 'Druid', MNK: 'Monk', BRD: 'Bard', ROG: 'Rogue', SHM: 'Shaman', NEC: 'Necro',
  WIZ: 'Wizard', MAG: 'Mage', ENC: 'Enchanter', BST: 'Beastlord', BER: 'Berserker',
};
const ARMOR_SET_SLOTS = new Set(['head', 'arms', 'wrist', 'hands', 'chest', 'legs', 'feet']);
const ARMOR_VISIBLE_SLOTS = new Set(['head', 'face', 'shoulders', 'arms', 'back', 'wrist', 'hands', 'chest', 'legs', 'feet', 'waist', 'ear', 'neck']);
const armorTokenCatalog = globalThis.LOOT_CAPTAIN_ARMOR_TOKEN_CATALOG || { catalogVersion: 'missing', items: [] };
const armorCatalogVersion = String(armorTokenCatalog.catalogVersion || armorTokenCatalog.version || 'missing');
const armorTokenById = new Map();
const armorTokenByName = new Map();
const armorTokenAmbiguousNames = new Set();
const armorSetRequests = new Map();
let raidlootCacheMutationQueue = Promise.resolve();

function normalizedLookupName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function validArmorTokenRecord(value) {
  if (!value || typeof value !== 'object' || !/^\d{1,12}$/.test(String(value.id || '').trim())) return null;
  const name = boundedName(String(value.name || ''), true);
  const slot = parserCanonicalSlot(value.slot);
  if (!slot || !slot.key || !ARMOR_VISIBLE_SLOTS.has(slot.key)) return null;
  const setQuery = boundedName(String(value.setQuery || ''), true);
  if (!setQuery || armorCatalogVersion.length > 80) return null;
  const expansion = boundedName(String(value.expansion || ''), false);
  const track = boundedName(String(value.track || ''), false).toLowerCase();
  const tier = Number.isInteger(value.tier) ? value.tier : String(value.tier || '').trim();
  if (!expansion || !['group', 'raid'].includes(track) || !Number.isInteger(tier) || tier < 1) return null;
  const alternatives = value.alternativeSets === undefined ? [] : value.alternativeSets;
  if (!Array.isArray(alternatives)) return null;
  const normalizedAlternatives = [];
  const seenSets = new Set([normalizedLookupName(setQuery)]);
  for (const alternative of alternatives) {
    if (!alternative || typeof alternative !== 'object' || typeof alternative.track !== 'string' ||
        typeof alternative.setQuery !== 'string') return null;
    const alternativeTrack = boundedName(alternative.track, true).toLowerCase();
    const alternativeTier = alternative.tier;
    if (!['group', 'raid'].includes(alternativeTrack) || !Number.isInteger(alternativeTier) || alternativeTier < 1) return null;
    const alternativeSetQuery = boundedName(alternative.setQuery, true);
    const setKey = normalizedLookupName(alternativeSetQuery);
    if (!setKey || seenSets.has(setKey)) return null;
    seenSets.add(setKey);
    normalizedAlternatives.push({ track: alternativeTrack, tier: alternativeTier, setQuery: alternativeSetQuery });
  }
  return { id: String(value.id).trim(), name, expansion, track, tier, setQuery, slot: slot.key, alternativeSets: normalizedAlternatives };
}

function buildArmorTokenIndexes() {
  const values = Array.isArray(armorTokenCatalog.items)
    ? armorTokenCatalog.items
    : armorTokenCatalog.items && typeof armorTokenCatalog.items === 'object'
      ? Object.values(armorTokenCatalog.items) : [];
  for (const value of values) {
    let record;
    try { record = validArmorTokenRecord(value); } catch (e) { continue; }
    if (!record || armorTokenById.has(record.id)) continue;
    armorTokenById.set(record.id, record);
    const key = normalizedLookupName(record.name);
    if (!key) continue;
    const matches = armorTokenByName.get(key) || [];
    matches.push(record);
    armorTokenByName.set(key, matches);
    if (matches.length > 1) armorTokenAmbiguousNames.add(key);
  }
}
buildArmorTokenIndexes();

// ---------- Storage helpers ----------
async function storageGet(key, def) {
  const res = await chrome.storage.local.get(key);
  return res[key] === undefined ? def : res[key];
}
// ---------- Cross-origin fetch ----------
async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);
  return resp.text();
}

let offscreenReady = null;

async function hasOffscreenDocument() {
  const url = chrome.runtime.getURL('background/offscreen.html');
  if (chrome.offscreen.hasDocument) return chrome.offscreen.hasDocument();
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [url],
    });
    return contexts.length > 0;
  }
  const matchedClients = await clients.matchAll();
  return matchedClients.some((client) => client.url === url);
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) throw new Error('Chrome offscreen document API is unavailable');
  if (await hasOffscreenDocument()) return;
  if (!offscreenReady) {
    offscreenReady = chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse RaidLoot HTML for item and profile imports',
    }).finally(() => {
      offscreenReady = null;
    });
  }
  await offscreenReady;
}

async function parseHtmlInOffscreen(message) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ target: 'loot-captain-offscreen', ...message });
  if (!response || !response.ok) throw new Error(response && response.error || 'RaidLoot HTML parser failed');
  return response.value;
}

function numericItemStatCount(item) {
  return Object.values(item && item.stats || {}).filter((value) => {
    const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
    return num != null && !isNaN(num);
  }).length;
}

function hasNumericItemStats(item) {
  return numericItemStatCount(item) > 0;
}

function hasItemData(item) {
  return hasNumericItemStats(item) || (item && Array.isArray(item.effects) && item.effects.length > 0);
}

function raidlootCacheKey(item) {
  if (item && item.id) return 'id:' + String(item.id);
  const name = String(item && item.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return name ? 'name:' + name : '';
}

async function getRaidlootItemCache() {
  try {
    const cache = await storageGet(RAIDLOOT_ITEM_CACHE_KEY, {});
    const validCache = cache && typeof cache === 'object' ? cache : {};
    const trimmedCache = trimRaidlootItemCache(validCache);
    if (Object.keys(trimmedCache).length !== Object.keys(validCache).length) return updateRaidlootItemCache(() => {});
    return trimmedCache;
  } catch (e) {
    return {};
  }
}

function trimRaidlootItemCache(cache) {
  let bytes = 2;
  const kept = [];
  const entries = Object.entries(cache || {});
  for (let index = entries.length - 1; index >= 0 && kept.length < MAX_RAIDLOOT_CACHE_ENTRIES; index--) {
    const entryBytes = new TextEncoder().encode(JSON.stringify(entries[index])).byteLength + 1;
    if (bytes + entryBytes > MAX_RAIDLOOT_CACHE_BYTES) continue;
    bytes += entryBytes;
    kept.push(entries[index]);
  }
  return Object.fromEntries(kept.reverse());
}

async function saveRaidlootItemCache(cache) {
  try {
    await chrome.storage.local.set({ [RAIDLOOT_ITEM_CACHE_KEY]: trimRaidlootItemCache(cache) });
  } catch (e) {}
}

function updateRaidlootItemCache(updater) {
  const mutation = raidlootCacheMutationQueue.then(async () => {
    let cache = {};
    try {
      const stored = await storageGet(RAIDLOOT_ITEM_CACHE_KEY, {});
      cache = trimRaidlootItemCache(stored && typeof stored === 'object' ? stored : {});
    } catch (e) {}
    await updater(cache);
    await saveRaidlootItemCache(cache);
    return cache;
  });
  raidlootCacheMutationQueue = mutation.catch(() => {});
  return mutation;
}

function normalizeArmorClass(value) {
  return typeof parserNormalizeClass === 'function' ? parserNormalizeClass(value) : '';
}

function armorTokenRecord(itemId, name) {
  if (itemId !== undefined && itemId !== '') {
    const exact = armorTokenById.get(String(itemId).trim());
    if (exact) return exact;
  }
  const matches = armorTokenByName.get(normalizedLookupName(name)) || [];
  return matches.length === 1 ? matches[0] : null;
}

function armorTokenNameIsAmbiguous(name) {
  return armorTokenAmbiguousNames.has(normalizedLookupName(name));
}

function armorSetCacheKey(set, characterClass) {
  return 'armor-set:' + armorCatalogVersion + ':' + normalizedLookupName(set.setQuery) + ':' + characterClass;
}

function armorSetUrl(set, characterClass) {
  return 'https://www.raidloot.com/items?name=' + encodeURIComponent(set.setQuery) +
    '&class=' + encodeURIComponent(ARMOR_CLASS_NAMES[characterClass] || characterClass) + '&view=Table';
}

function armorSetItemInSet(item, record, characterClass) {
  if (!item || !/^\d{1,12}$/.test(String(item.id || '')) || !item.name || String(item.name).length > MAX_NAME_LENGTH) return false;
  const slot = parserCanonicalSlot(item.slot);
  if (!slot || !slot.key || !ARMOR_VISIBLE_SLOTS.has(slot.key) || !item.slotKey || slot.key !== item.slotKey.key) return false;
  if (!hasItemData(item)) return false;
  if (!Array.isArray(item.classes) || !item.classes.length || (!item.classes.includes('ALL') && !item.classes.includes(characterClass))) return false;
  const metadata = [item.setQuery, ...Object.entries(item.stats || {}).filter(([key]) => /^(?:quest|set|setname)$/i.test(key))
    .map(([, value]) => value && typeof value === 'object' ? (value.raw || value.text || value.name || '') : value)]
    .filter(Boolean).join(' ');
  return !!metadata && normalizedLookupName(metadata).includes(normalizedLookupName(record.setQuery));
}

function armorSetItemMatches(item, record, set, characterClass) {
  return !!item && item.slotKey && item.slotKey.key === record.slot && armorSetItemInSet(item, set, characterClass);
}

function completeArmorSet(items, set, characterClass) {
  if (!Array.isArray(items) || !items.length) return false;
  const slots = new Set();
  for (const item of items) {
    if (!armorSetItemInSet(item, set, characterClass)) return false;
    slots.add(item.slotKey.key);
  }
  return [...ARMOR_SET_SLOTS].every((slot) => slots.has(slot));
}

async function fetchArmorSet(set, characterClass, cacheKey) {
  if (armorSetRequests.has(cacheKey)) return armorSetRequests.get(cacheKey);
  const request = (async () => {
    const html = await fetchText(armorSetUrl(set, characterClass));
    const items = await parseHtmlInOffscreen({ type: 'PARSE_ITEM_SET', html });
    if (!Array.isArray(items)) throw new Error('RaidLoot armor set response was invalid');
    const validItems = items.filter((item) => armorSetItemInSet(item, set, characterClass));
    if (!completeArmorSet(validItems, set, characterClass)) throw new Error('RaidLoot armor set response was incomplete');
    return validItems;
  })().finally(() => armorSetRequests.delete(cacheKey));
  armorSetRequests.set(cacheKey, request);
  return request;
}

async function resolveArmorToken(record, characterClass, itemCache) {
  const sets = [{ track: record.track, tier: record.tier, setQuery: record.setQuery }, ...(record.alternativeSets || [])];
  const uniqueSets = [...new Map(sets.map((set) => [normalizedLookupName(set.setQuery), set])).values()];
  const settledSets = await Promise.allSettled(uniqueSets.map(async (set) => {
    const cacheKey = armorSetCacheKey(set, characterClass);
    let setItems = itemCache[cacheKey];
    if (!completeArmorSet(setItems, set, characterClass)) {
      setItems = await fetchArmorSet(set, characterClass, cacheKey);
      if (!setItems.length) throw new Error('RaidLoot armor set item not found: ' + record.name + ' (' + set.setQuery + ')');
      await updateRaidlootItemCache((cache) => {
        if (!completeArmorSet(cache[cacheKey], set, characterClass)) cache[cacheKey] = setItems;
      });
      itemCache[cacheKey] = setItems;
    }
    const matches = setItems.filter((item) => armorSetItemMatches(item, record, set, characterClass));
    if (!matches.length) throw new Error('RaidLoot armor set item not found: ' + record.name + ' (' + set.setQuery + ')');
    return { set, matches };
  }));
  const failedSet = settledSets.find((result) => result.status === 'rejected');
  if (failedSet) throw failedSet.reason;
  const loadedSets = settledSets.map((result) => result.value);
  const matches = [...new Map(loadedSets.flatMap(({ set, matches: setMatches }) => setMatches.map((item) => [String(item.id), {
    ...item,
    armorSetLabel: set.setQuery,
  }]))).values()]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.armorSetLabel).localeCompare(String(b.armorSetLabel)) || String(a.id).localeCompare(String(b.id)));
  if (!matches.length) throw new Error('RaidLoot armor set item not found: ' + record.name);
  return { item: matches[0], alternatives: matches.slice(1) };
}

async function lookupOrdinaryItem(name, sourceId) {
  const itemCache = await getRaidlootItemCache();
  const cachedById = sourceId && itemCache[raidlootCacheKey({ id: sourceId })];
  if (cachedById && sameItemName(cachedById.name, name)) return cachedById;
  const key = raidlootCacheKey({ name });
  const cached = key && itemCache[key];
  if (cached && sameItemName(cached.name, name)) return cached;
  const item = await lookupItemStats(name);
  if (item && (hasItemData(item) || item.icon)) {
    await updateRaidlootItemCache((cache) => {
      const idKey = raidlootCacheKey({ id: item.id });
      const nameKey = raidlootCacheKey({ name: item.name });
      if (idKey) cache[idKey] = item;
      if (nameKey) cache[nameKey] = item;
    });
  }
  return item;
}

async function lookupItemStats(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('OpenDKP item has no name');
  if (cleanName.length > MAX_NAME_LENGTH) throw new Error('Item name is too long');

  const searchUrl = 'https://www.raidloot.com/items?name=' + encodeURIComponent(cleanName);
  const searchHtml = await fetchText(searchUrl);
  const searchItem = await parseHtmlInOffscreen({ type: 'PARSE_SEARCH_ITEM', html: searchHtml, name: cleanName });
  if (!searchItem) throw new Error('RaidLoot item not found: ' + cleanName);
  let item = searchItem;
  let detailWarning = '';
  try {
    const detailHtml = await fetchText('https://www.raidloot.com/items/' + encodeURIComponent(searchItem.id));
    item = await parseHtmlInOffscreen({ type: 'PARSE_ITEM', html: detailHtml, expectedId: searchItem.id }) || searchItem;
  } catch (e) {
    if (!hasItemData(searchItem)) throw e;
    detailWarning = e && e.message || String(e);
  }
  if (detailWarning) item.lookupWarning = 'detail fallback: ' + detailWarning;
  return item;
}

async function fetchItemStats(itemId) {
  const id = String(itemId || '').trim();
  if (!/^\d{1,12}$/.test(id)) throw new Error('Invalid RaidLoot item id');
  const html = await fetchText('https://www.raidloot.com/items/' + encodeURIComponent(id));
  const item = await parseHtmlInOffscreen({ type: 'PARSE_ITEM', html, expectedId: id });
  if (!item) throw new Error('Item not found: ' + id);
  return item;
}

function senderUrl(sender) {
  return String(sender && sender.url || '');
}

function isExtensionPage(sender) {
  return senderUrl(sender) === 'chrome-extension://' + chrome.runtime.id + '/options/options.html' ||
    senderUrl(sender) === 'chrome-extension://' + chrome.runtime.id + '/popup/popup.html';
}

function isRaidLootPage(sender) {
  try {
    const host = new URL(senderUrl(sender)).hostname.toLowerCase();
    return host === 'raidloot.com' || host === 'www.raidloot.com';
  } catch (e) {
    return false;
  }
}

function isOpenDkpPage(sender) {
  try {
    return new URL(senderUrl(sender)).hostname.toLowerCase().endsWith('.opendkp.com');
  } catch (e) {
    return false;
  }
}

function allowedSender(type, sender) {
  if (type === 'SCRAPE_PROFILE') return isExtensionPage(sender);
  if (type === 'ENRICH_PROFILE_ITEMS') return isExtensionPage(sender) || isRaidLootPage(sender) || isOpenDkpPage(sender);
  if (type === 'LOOKUP_ITEM_STATS') return isOpenDkpPage(sender);
  if (type === 'MUTATE_WISHLIST') return isExtensionPage(sender) || isRaidLootPage(sender) || isOpenDkpPage(sender);
  if (type === 'SAVE_PROFILES') return isExtensionPage(sender) || isRaidLootPage(sender) || isOpenDkpPage(sender);
  return false;
}

function numericId(value, label) {
  const id = String(value == null ? '' : value).trim();
  if (!new RegExp('^\\d{1,' + MAX_ID_LENGTH + '}$').test(id)) throw new Error('Invalid ' + label);
  return id;
}

function boundedName(value, required) {
  if (typeof value !== 'string') throw new Error('Invalid item name');
  const name = value.trim();
  if (required && !name) throw new Error('Item name is required');
  if (name.length > MAX_NAME_LENGTH) throw new Error('Item name is too long');
  return name;
}

function sanitizeEnrichmentItems(value) {
  if (!Array.isArray(value) || value.length > MAX_ITEM_COUNT) throw new Error('Invalid equipment list');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid equipment item');
    const id = item.id ? numericId(item.id, 'item ID') : '';
    const name = item.name == null ? '' : boundedName(item.name, false);
    const slot = item.slot == null ? '' : boundedName(item.slot, false);
    if (slot.length > 40) throw new Error('Item slot is too long');
    if (!id && !name) throw new Error('Equipment item needs an ID or name');
    return { id, name, slot };
  });
}

function cleanWishlistId(value, maxLength) {
  const id = String(value || '').trim();
  if (id.length > maxLength || /[\u0000-\u001f]/.test(id)) throw new Error('Invalid wishlist item ID');
  return id;
}

function wishlistSlotKey(item) {
  const slot = parserCanonicalSlot(item && item.slot);
  return slot && slot.key || '';
}

function wishlistName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sanitizeWishlistItem(value) {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > MAX_WISHLIST_ITEM_BYTES) {
    throw new Error('Invalid wishlist item');
  }
  const raidlootId = value.raidlootId ? numericId(value.raidlootId, 'RaidLoot item ID') : '';
  const opendkpId = cleanWishlistId(value.opendkpId, 100);
  const opendkpHost = String(value.opendkpHost || '').trim().toLowerCase();
  if (opendkpHost && !/^(?:[a-z0-9-]+\.)+opendkp\.com$/.test(opendkpHost)) throw new Error('Invalid OpenDKP host');
  const name = value.name == null ? '' : boundedName(value.name, false);
  const slot = value.slot == null ? '' : boundedName(value.slot, false);
  if (slot.length > 80) throw new Error('Wishlist slot is too long');
  if (!raidlootId && !(opendkpHost && opendkpId) && !(name && parserCanonicalSlot(slot))) {
    throw new Error('Wishlist item needs a source ID or a name and slot');
  }
  const stats = {};
  const entries = Object.entries(value.stats || {});
  if (entries.length > 128) throw new Error('Too many wishlist stats');
  for (const [key, raw] of entries) {
    const cleanKey = String(key || '').trim();
    const value = raw && typeof raw === 'object' && 'num' in raw ? raw.num : raw;
    const num = parseFloat(value);
    if (cleanKey && cleanKey.length <= 80 && Number.isFinite(num)) stats[cleanKey] = num;
  }
  const augmentTypes = [...new Set((Array.isArray(value.augmentTypes) ? value.augmentTypes : [])
    .slice(0, 32).map((type) => cleanWishlistId(type, 10)).filter(Boolean))];
  const effects = parserNormalizeEffects(Array.isArray(value.effects) ? value.effects.slice(0, 64) : []);
  return {
    raidlootId,
    opendkpHost,
    opendkpId,
    name,
    slot,
    isAugment: !!value.isAugment,
    augmentTypes,
    stats,
    effects,
    addedAt: Number(value.addedAt) > 0 ? Number(value.addedAt) : Date.now(),
  };
}

function wishlistMatches(entry, item) {
  if (entry.raidlootId && item.raidlootId) return entry.raidlootId === item.raidlootId;
  if (entry.opendkpId && item.opendkpId && entry.opendkpHost && entry.opendkpHost === item.opendkpHost) {
    return entry.opendkpId === item.opendkpId;
  }
  return !!wishlistName(entry.name) && wishlistName(entry.name) === wishlistName(item.name) &&
    !!wishlistSlotKey(entry) && wishlistSlotKey(entry) === wishlistSlotKey(item);
}

function mergeWishlistItem(item, current) {
  const itemEffects = parserNormalizeEffects(item.effects || []);
  const currentEffects = parserNormalizeEffects(current.effects || []);
  return {
    raidlootId: item.raidlootId || current.raidlootId || '',
    opendkpHost: item.opendkpHost || current.opendkpHost || '',
    opendkpId: item.opendkpId || current.opendkpId || '',
    name: item.name || current.name || '',
    slot: item.slot || current.slot || '',
    isAugment: !!item.isAugment || !!current.isAugment,
    augmentTypes: [...new Set([...(current.augmentTypes || []), ...(item.augmentTypes || [])])],
    stats: { ...(current.stats || {}), ...(item.stats || {}) },
    effects: itemEffects.length >= currentEffects.length ? itemEffects : currentEffects,
    addedAt: Math.min(Number(item.addedAt) || Date.now(), Number(current.addedAt) || Date.now()),
  };
}

function queueProfileMutation(callback) {
  const mutation = profileMutationQueue.then(callback, callback);
  profileMutationQueue = mutation.catch(() => {});
  return mutation;
}

function mutateWishlist(profileId, action, value) {
  return queueProfileMutation(async () => {
    const item = sanitizeWishlistItem(value);
    const profiles = await storageGet('profiles', {});
    const profile = profiles[profileId];
    if (!profile) throw new Error('Character profile not found');
    const wishlist = (Array.isArray(profile.wishlist) ? profile.wishlist : []).map(sanitizeWishlistItem);
    const matches = wishlist.map((entry, index) => wishlistMatches(entry, item) ? index : -1).filter((index) => index >= 0);
    let wanted = action !== 'remove';
    if (action === 'toggle' && matches.length) wanted = false;
    if (!['toggle', 'merge', 'remove'].includes(action)) throw new Error('Invalid wishlist mutation');
    if (action === 'merge' && !matches.length) return { wanted: false, entry: null, profiles };
    let next = wishlist.filter((entry, index) => !matches.includes(index));
    let merged = item;
    for (const index of matches) merged = mergeWishlistItem(merged, wishlist[index]);
    if (action === 'merge' && matches.length === 1 && JSON.stringify(merged) === JSON.stringify(wishlist[matches[0]])) {
      return { wanted: true, entry: merged, profiles };
    }
    if (wanted) next.splice(matches[0] == null ? next.length : Math.min(matches[0], next.length), 0, merged);
    profiles[profileId] = { ...profile, wishlist: next };
    await chrome.storage.local.set({ profiles });
    return { wanted, entry: wanted ? merged : null, profiles };
  });
}

function comparableProfile(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const { wishlist, ...rest } = profile;
  return rest;
}

function saveProfiles(records, deletedIds, expectedRecords) {
  return queueProfileMutation(async () => {
    if (!records || typeof records !== 'object' || JSON.stringify(records).length > MAX_PROFILE_MUTATION_BYTES) {
      throw new Error('Invalid profile update');
    }
    const profiles = await storageGet('profiles', {});
    for (const [id, profile] of Object.entries(records)) {
      if (!id || id.length > 100 || !profile || typeof profile !== 'object') throw new Error('Invalid profile');
      if (expectedRecords && expectedRecords[id] &&
          JSON.stringify(comparableProfile(profiles[id])) !== JSON.stringify(comparableProfile(expectedRecords[id]))) continue;
      profiles[id] = {
        ...(profiles[id] || {}),
        ...profile,
        wishlist: Array.isArray(profiles[id] && profiles[id].wishlist)
          ? profiles[id].wishlist : (Array.isArray(profile.wishlist) ? profile.wishlist : []),
      };
    }
    for (const id of deletedIds || []) delete profiles[String(id)];
    await chrome.storage.local.set({ profiles });
    return profiles;
  });
}

// ---------- Message handling ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.target === 'loot-captain-offscreen') return false;
  if (!msg || typeof msg.type !== 'string' || !allowedSender(msg.type, sender)) {
    sendResponse({ ok: false, error: 'Message sender is not allowed' });
    return false;
  }
  (async () => {
    try {
      if (await storageGet(CONSENT_KEY, 0) !== CONSENT_VERSION) {
        sendResponse({ ok: false, error: 'Consent is required' });
        return;
      }
      switch (msg.type) {
      case 'SCRAPE_PROFILE': {
        const profileId = numericId(msg.profileId, 'profile ID');
        const html = await fetchText('https://www.raidloot.com/profile/' + profileId);
        const profile = await parseHtmlInOffscreen({ type: 'PARSE_PROFILE', html, profileId });
        sendResponse({ ok: true, profile });
        break;
      }
      case 'ENRICH_PROFILE_ITEMS': {
        const items = sanitizeEnrichmentItems(msg.items);
        const itemCache = await getRaidlootItemCache();
        const results = await Promise.all(items.map(async (item) => {
          const debug = { id: item && item.id || '', name: item && item.name || '', result: 'unchanged' };
          if (!item || (!item.id && !item.name)) {
            debug.result = 'skipped';
            debug.message = 'missing item ID and name';
            return { item, debug };
          }
          let loaded = null;
          let idError = '';
          const cacheKey = raidlootCacheKey(item);
          const cached = cacheKey && itemCache[cacheKey];
          if (cached && (!item.name || !cached.name || sameItemName(cached.name, item.name))) {
            loaded = cached;
            debug.source = 'cache';
          }
          try {
            if (!loaded && item.id) {
              try {
                loaded = await fetchItemStats(item.id);
                if (loaded && item.name && !sameItemName(loaded.name, item.name)) {
                  loaded = null;
                  idError = 'ID result name mismatch';
                  debug.message = idError;
                }
                if (loaded) debug.source = 'id';
              } catch (e) {
                idError = 'ID lookup failed: ' + (e && e.message || String(e));
              }
            }
            if (!loaded && item.name) {
              try {
                loaded = await lookupItemStats(item.name);
                if (loaded) debug.source = 'name';
              } catch (e) {
                debug.message = [idError, 'name lookup failed: ' + (e && e.message || String(e))].filter(Boolean).join('; ');
              }
            }
          } catch (e) {
            debug.message = e && e.message || String(e);
          }
          if (!loaded) {
            debug.result = 'not-found';
            debug.message = debug.message || idError || 'no RaidLoot match';
            return { item, debug };
          }
          debug.result = 'loaded';
          debug.statCount = numericItemStatCount(loaded);
          debug.message = [...new Set([debug.message, idError, loaded.lookupWarning].filter(Boolean))].join('; ') || 'stats found';
          return {
            item: {
              ...item,
              id: debug.source === 'name' ? loaded.id : (item.id || loaded.id),
              name: item.name || loaded.name,
              icon: item.icon || loaded.icon || '',
              slot: item.slot || loaded.slot,
              augmentTypes: (Array.isArray(loaded.augmentTypes) && loaded.augmentTypes.length)
                ? [...loaded.augmentTypes] : (item.augmentTypes || []),
              stats: loaded.stats || item.stats,
              effects: Array.isArray(loaded.effects) ? loaded.effects : (item.effects || []),
            },
            debug,
            cacheItem: debug.source === 'cache' ? null : (hasItemData(loaded) || loaded.icon ? loaded : null),
          };
        }));
        const cacheUpdates = results.filter((result) => result.cacheItem);
        if (cacheUpdates.length) {
          await updateRaidlootItemCache((cache) => {
            for (const result of cacheUpdates) {
              const item = result.cacheItem;
              const idKey = raidlootCacheKey({ id: item.id });
              const nameKey = raidlootCacheKey({ name: item.name });
              if (idKey) cache[idKey] = item;
              if (nameKey) cache[nameKey] = item;
            }
          });
        }
        sendResponse({ ok: true, items: results.map((result) => result.item), debug: results.map((result) => result.debug) });
        break;
      }
      case 'LOOKUP_ITEM_STATS': {
        const name = boundedName(msg.name, true);
        const itemId = msg.itemId !== undefined && msg.itemId !== '' ? numericId(msg.itemId, 'item ID') : '';
        const token = armorTokenRecord(itemId, name);
        if (!token && armorTokenNameIsAmbiguous(name)) {
          sendResponse({ ok: false, error: 'Armor token name is ambiguous; use its item ID to resolve it' });
          break;
        }
        if (token) {
          const characterClass = normalizeArmorClass(msg.characterClass);
          if (!characterClass) {
            sendResponse({ ok: false, error: 'Set a class on the selected character to resolve this armor token' });
            break;
          }
          const itemCache = await getRaidlootItemCache();
          const resolved = await resolveArmorToken(token, characterClass, itemCache);
          sendResponse({ ok: true, item: resolved.item, alternatives: resolved.alternatives });
          break;
        }
        const item = await lookupOrdinaryItem(name, itemId);
        sendResponse({ ok: true, item });
        break;
      }
      case 'MUTATE_WISHLIST': {
        const profileId = cleanWishlistId(msg.profileId, 100);
        if (!profileId) throw new Error('Character profile is required');
        const result = await mutateWishlist(profileId, msg.action, msg.item);
        sendResponse({ ok: true, ...result });
        break;
      }
      case 'SAVE_PROFILES': {
        const profiles = await saveProfiles(msg.profiles, Array.isArray(msg.deletedIds) ? msg.deletedIds : [], msg.expectedProfiles);
        sendResponse({ ok: true, profiles });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type: ' + msg.type });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  })();
  return true; // async response
});
