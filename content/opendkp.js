// Loot Captain - openDKP content script
// Annotates item detail pages, auction lists, and raid result pages with
// upgrade/downgrade badges + stat diffs against the selected local profile.

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};

  // ---------- State ----------
  const ITEM_EVENT = 'loot-captain-opendkp-item-data';
  const CONSENT_FRAME_ID = 'loot-captain-opendkp-consent';
  const CONSENT_KEY = 'consentVersion';
  const CONSENT_VERSION = 1;
  const MAX_ITEM_EVENT_LENGTH = 512 * 1024;
  const MAX_CAPTURE_ITEMS = 64;
  let consented = false;
  let started = false;
  let itemCache = new Map(); // OpenDKP item id -> parsed item
  let lookupCache = new Map(); // OpenDKP item id/name -> Promise<parsed item>
  let lastAnnotate = 0;

  const consentFrame = document.createElement('iframe');
  consentFrame.id = CONSENT_FRAME_ID;
  consentFrame.hidden = true;
  consentFrame.setAttribute('aria-hidden', 'true');
  consentFrame.src = chrome.runtime.getURL('content/opendkp-consent.html');
  document.documentElement.appendChild(consentFrame);

  // ---------- Page-world bridge ----------
  function hookNetwork() {
    document.addEventListener(ITEM_EVENT, (event) => {
      if (!consented) return;
      if (typeof event.detail !== 'string' || event.detail.length > MAX_ITEM_EVENT_LENGTH) return;
      try {
        const payload = JSON.parse(event.detail);
        if (!payload || typeof payload !== 'object') return;
        const data = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
        if (!data || typeof data !== 'object') return;
        captureItemData(data);
      } catch (e) {}
    });
  }

  hookNetwork();

  async function enableAfterConsent() {
    if (consented) return true;
    try {
      const result = await chrome.storage.local.get(CONSENT_KEY);
      if (result[CONSENT_KEY] !== CONSENT_VERSION) return false;
      consented = true;
      return true;
    } catch (e) {
      if (String(e && e.message) === 'Extension context invalidated.') return false;
      throw e;
    }
  }

  const initialConsent = enableAfterConsent();

  // Capture item data from API responses (handles single item or list).
  function captureItemData(data) {
    if (!data) return;
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items :
      Array.isArray(data.Items) ? data.Items : Array.isArray(data.results) ? data.results :
      Array.isArray(data.Results) ? data.Results : (data.item || data.Item ? [data.item || data.Item] : [data]));
    if (items.length > MAX_CAPTURE_ITEMS) return;
    for (const it of items) {
      if (it && typeof it === 'object') {
        const parsed = LC.parser.parseOpenDkpJson(it);
        if (parsed && parsed.id) itemCache.set(parsed.id, parsed);
      }
    }
    scheduleAnnotate();
  }

  function openDkpItemId() {
    const match = location.hash.match(/^#\/items\/([^/?#]+)/);
    return match ? match[1] : '';
  }

  async function resolveItem(itemId, fallback) {
    const cached = itemCache.get(itemId);
    if (cached && cached.slotKey && Object.keys(cached.stats || {}).length) return cached;
    const key = (fallback && fallback.name) || itemId || '';
    if (!fallback || !fallback.name) return fallback;
    if (!lookupCache.has(key)) {
      lookupCache.set(key, chrome.runtime.sendMessage({
        type: 'LOOKUP_ITEM_STATS',
        itemId,
        name: fallback && fallback.name,
      }).then((response) => {
        if (!response || !response.ok || !response.item) return fallback;
        const item = {
          ...response.item,
          id: itemId || response.item.id,
          stats: LC.parser.normalizeStats(response.item.stats || {}),
        };
        if (itemId) itemCache.set(itemId, item);
        return item;
      }).catch(() => fallback));
    }
    return lookupCache.get(key);
  }

  function annotateCandidate(host, cand, prepend) {
    if (!host || !cand || !cand.slotKey || host.querySelector(':scope > .lc-badge')) return;
    const badge = LC.ui.buildBadge('nomatch', 'no char', 'Pick a character in the popup');
    if (!LC.currentProfile) {
      if (prepend) host.prepend(badge); else host.appendChild(badge);
      return;
    }
    const f = LC.currentFormula;
    const comparison = LC.diff.compareCandidate(LC.currentProfile, cand, f);
    if (!comparison.eligible) return;
    const summary = LC.diff.summarizeComparisons(comparison);
    if (!summary.hasWorn) {
      badge.dataset.state = 'empty';
      badge.textContent = 'empty slot';
      badge.title = 'No worn item in slot ' + cand.slotKey.key;
      if (prepend) host.prepend(badge); else host.appendChild(badge);
      return;
    }
    if (!summary.comparable) {
      badge.textContent = '?';
      badge.title = 'Item stats are unresolved; no comparison is available';
      if (prepend) host.prepend(badge); else host.appendChild(badge);
      return;
    }
    const compact = (!cand.isAugment && comparison.rows.length > 1) || LC.diff.weaponType(cand) != null;
    const badges = [];
    for (const [index, row] of comparison.rows.entries()) {
      if (cand.isAugment && index) break;
      if (!row.diff || !row.diff.comparable) continue;
      const rowBadge = LC.ui.buildBadge(row.diff.score > 0 ? 'upgrade' : row.diff.score < 0 ? 'downgrade' : 'sidegrade',
        LC.ui.comparisonBadgeText(row, f, compact), LC.ui.comparisonBadgeTitle(row, f));
      rowBadge.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const existing = host.querySelector(':scope > .lc-compare-panel');
        if (existing) { existing.remove(); return; }
        host.appendChild(LC.ui.buildComparePanel(cand, row.target, row.diff, row.slotKey && row.slotKey.key,
          row.isAugment ? comparison.rows : null, index));
      });
      badges.push(rowBadge);
    }
    if (prepend) host.prepend(...badges); else host.append(...badges);
  }

  // ---------- Annotation ----------
  function scheduleAnnotate(force) {
    clearTimeout(scheduleAnnotate._t);
    scheduleAnnotate._t = setTimeout(() => annotatePage(force), 200);
  }

  async function annotatePage(force) {
    if (!LC.currentProfile) return;
    const now = Date.now();
    if (!force && now - lastAnnotate < 300) return;
    lastAnnotate = now;
    await annotateItemDetailPage();
    await annotateItemTooltips();
    await annotateItemTables();
  }

  // Item detail page: #/items/{id}
  async function annotateItemDetailPage() {
    const itemId = openDkpItemId();
    if (!itemId) return;
    // Try cache first
    let cand = itemCache.get(itemId);
    if (!cand) {
      // Fallback: parse the rendered DOM
      const container = document.querySelector('app-root') || document.body;
      cand = LC.parser.parseOpenDkpDom(container);
      if (cand) cand.id = itemId;
    }
    cand = await resolveItem(itemId, cand);
    if (!cand || !cand.slotKey) return;
    // Find a good host element: the item name heading or the main content area
    const host = findItemDetailHost();
    annotateCandidate(host, cand, true);
  }

  function findItemDetailHost() {
    // Try common heading patterns
    const heading = document.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) return heading.parentElement || heading;
    // Fallback: first card/panel
    const card = document.querySelector('.card, .p-card, .panel, .item-detail');
    if (card) return card;
    return document.querySelector('app-root') || document.body;
  }

  // Auction lists + raid result pages: items appear inline in tables.
  // We look for table cells containing links to /items/{id}.
  async function annotateItemTables() {
    const links = document.querySelectorAll('a[href*="/items/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const m = href.match(/\/items\/([^/?#]+)/);
      if (!m) continue;
      const itemId = m[1];
      // Skip if already annotated
      const cell = link.closest('td, .p-cell, .item-cell, li, .p-listbox-item');
      if (!cell) continue;
      if (cell.querySelector(':scope > .lc-badge')) continue;
      // Get candidate from cache or parse the cell
      let cand = itemCache.get(itemId);
      if (!cand) {
        cand = LC.parser.parseOpenDkpDom(cell);
        if (cand) cand.id = itemId;
      }
      cand = await resolveItem(itemId, cand);
      if (!cand || !cand.slotKey) continue;
      annotateCandidate(cell, cand, false);
    }
  }

  async function annotateItemTooltips() {
    const knownSelector = '[role="tooltip"], [class*="tooltip" i], [class*="popover" i], [class*="item-detail" i], .cdk-overlay-pane';
    const selector = knownSelector + ', body > div, body > div > div, body > div > div > div';
    const hosts = Array.from(document.querySelectorAll(selector)).filter((host) => {
      if (host.matches(knownSelector)) return true;
      if (host.querySelector(knownSelector)) return false;
      return !host.parentElement?.closest(knownSelector);
    });
    for (const host of hosts) {
      if (!document.documentElement.contains(host)) continue;
      const text = host.textContent || '';
      if (text.length > 2500) continue;
      let cand = LC.parser.parseOpenDkpTooltip(host);
      if (!cand) {
        const heading = host.querySelector('h1, h2, h3, h4, h5, h6, strong, b, .item-name, .itemname');
        const name = heading && heading.textContent.trim();
        if (!name) continue;
        cand = { name, slot: '', slotKey: null, stats: {} };
      }
      const trigger = Array.from(document.querySelectorAll('a[rel^="eq:item:"], a[href*="/items/"]'))
        .find((link) => link.textContent.trim().toLowerCase() === cand.name.trim().toLowerCase());
      const rel = trigger && (trigger.getAttribute('rel') || '').match(/^eq:item:([^\s]+)$/);
      const href = trigger && (trigger.getAttribute('href') || '').match(/\/items\/([^/?#]+)/);
      const itemId = rel ? rel[1] : (href ? href[1] : '');
      const resolved = await resolveItem(itemId, cand);
      if (resolved && resolved.slotKey && document.documentElement.contains(host)) {
        annotateCandidate(host, resolved, false);
      }
    }
  }

  // ---------- Init ----------
  async function init() {
    if (started) return;
    if (!(await initialConsent) && !(await enableAfterConsent())) return;
    if (started) return;
    started = true;
    LC.ui.injectCSS();
    await LC.state.loadAndCacheProfile();
    annotatePage();
    const mo = new MutationObserver(() => {
      clearTimeout(init._t);
      init._t = setTimeout(annotatePage, 300);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('mouseover', (event) => {
      if (event.target.closest && event.target.closest('a[href*="/items/"]')) scheduleAnnotate(true);
    }, true);
    window.addEventListener('hashchange', () => {
      document.querySelectorAll('.lc-badge, .lc-compare-panel').forEach((el) => el.remove());
      scheduleAnnotate();
    });
  }

  // Listen for storage changes (profile switch in popup/options)
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes[CONSENT_KEY] && changes[CONSENT_KEY].newValue === CONSENT_VERSION) {
      await init();
      return;
    }
    if (!started) return;
    const relevant = ['profiles', 'selectedProfileId', 'scoreFormula'].some((k) => changes[k]);
    if (!relevant) return;
    await LC.state.loadAndCacheProfile();
    // Clear badges and re-annotate
    document.querySelectorAll('.lc-badge, .lc-compare-panel').forEach((el) => el.remove());
    annotatePage();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
