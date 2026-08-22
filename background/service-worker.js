// Loot Captain - background service worker
// Handles cross-origin fetches (raidloot profile scrape) and storage.

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;
const MAX_ID_LENGTH = 12;
const MAX_NAME_LENGTH = 200;
const MAX_ITEM_COUNT = 32;

importScripts('raidloot-parser.js');

const EQUIPMENT_SLOTS = new Set([
  'charm', 'ear', 'head', 'face', 'neck', 'shoulders', 'arms', 'back',
  'wrist', 'range', 'hands', 'primary', 'finger', 'chest', 'legs', 'feet',
  'waist', 'secondary', 'powersource',
]);
const PAIRED_SLOTS = new Set(['ear', 'wrist', 'finger']);

function canonicalSlot(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  const aliases = {
    shoulder: 'shoulders',
    arm: 'arms',
    hand: 'hands',
    leg: 'legs',
    foot: 'feet',
    finger: 'finger',
    fingers: 'finger',
    'power-source': 'powersource',
  };
  s = aliases[s] || s;
  const m = s.match(/^(ear|wrist|finger|fingers)(-[12])?$/);
  if (m) return { key: m[1] === 'fingers' ? 'finger' : m[1], paired: true };
  return EQUIPMENT_SLOTS.has(s) ? { key: s, paired: PAIRED_SLOTS.has(s) } : null;
}

// ---------- Storage helpers ----------
async function storageGet(key, def) {
  const res = await chrome.storage.local.get(key);
  return res[key] === undefined ? def : res[key];
}
async function storageSet(key, val) {
  await chrome.storage.local.set({ [key]: val });
}

// ---------- Cross-origin fetch ----------
async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);
  return resp.text();
}

let offscreenReady = null;

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) throw new Error('Chrome offscreen document API is unavailable');
  if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
  if (!offscreenReady) {
    offscreenReady = chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse RaidLoot HTML for item and profile imports',
    }).catch((e) => {
      offscreenReady = null;
      throw e;
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
    if (!hasNumericItemStats(searchItem)) throw e;
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
  if (type === 'ENRICH_PROFILE_ITEMS') return isExtensionPage(sender) || isRaidLootPage(sender);
  if (type === 'LOOKUP_ITEM_STATS') return isOpenDkpPage(sender);
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
        if (msg.force !== undefined && typeof msg.force !== 'boolean') throw new Error('Invalid force flag');
        const force = msg.force === true;
        const cacheKey = 'profile:' + profileId;
        const cached = await storageGet(cacheKey, null);
        if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          sendResponse({ ok: true, profile: cached });
          break;
        }
        const html = await fetchText('https://www.raidloot.com/profile/' + profileId);
        const profile = await parseHtmlInOffscreen({ type: 'PARSE_PROFILE', html, profileId });
        await storageSet(cacheKey, profile);
        sendResponse({ ok: true, profile });
        break;
      }
      case 'ENRICH_PROFILE_ITEMS': {
        const items = sanitizeEnrichmentItems(msg.items);
        const results = await Promise.all(items.map(async (item) => {
          const debug = { id: item && item.id || '', name: item && item.name || '', result: 'unchanged' };
          if (!item || (!item.id && !item.name)) {
            debug.result = 'skipped';
            debug.message = 'missing item ID and name';
            return { item, debug };
          }
          let loaded = null;
          let idError = '';
          try {
            if (item.id) {
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
              slot: item.slot || loaded.slot,
              stats: loaded.stats || item.stats,
            },
            debug,
          };
        }));
        sendResponse({ ok: true, items: results.map((result) => result.item), debug: results.map((result) => result.debug) });
        break;
      }
      case 'LOOKUP_ITEM_STATS': {
        const name = boundedName(msg.name, true);
        if (msg.itemId !== undefined && msg.itemId !== '') numericId(msg.itemId, 'item ID');
        const item = await lookupItemStats(name);
        sendResponse({ ok: true, item });
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
