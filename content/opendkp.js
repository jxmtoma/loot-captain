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
  const LIVE_AUCTION_TIMER = '.p-progressbar-value.p-progressbar-value-animate';
  const LC_UI_SELECTOR = '.lc-badge, .lc-compare-panel, .lc-wishlist-toggle, .lc-wishlist-compare';
  const OPENDKP_HOST = location.hostname.toLowerCase();
  let consented = false;
  let started = false;
  let itemCache = new Map(); // OpenDKP item id -> parsed item
  let lookupCache = new Map(); // OpenDKP item id/name -> Promise<parsed item>
  let lastAnnotate = 0;
  let annotationGeneration = 0;

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
  function openDkpCandidate(item, itemId) {
    if (!item) return item;
    const opendkpId = String(itemId || item.opendkpId || item.id || '');
    return { ...item, id: opendkpId || item.id || '', opendkpHost: OPENDKP_HOST, opendkpId };
  }

  function captureItemData(data) {
    if (!data) return;
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items :
      Array.isArray(data.Items) ? data.Items : Array.isArray(data.results) ? data.results :
      Array.isArray(data.Results) ? data.Results : (data.item || data.Item ? [data.item || data.Item] : [data]));
    if (items.length > MAX_CAPTURE_ITEMS) return;
    for (const it of items) {
      if (it && typeof it === 'object') {
        const parsed = LC.parser.parseOpenDkpJson(it);
        if (parsed && parsed.id) itemCache.set(parsed.id, openDkpCandidate(parsed, parsed.id));
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
    if (cached && cached.slotKey && Object.keys(cached.stats || {}).length) return openDkpCandidate(cached, itemId);
    fallback = openDkpCandidate(fallback, itemId);
    const key = itemId || (fallback && fallback.name) || '';
    if (!fallback || !fallback.name) return fallback;
    if (!lookupCache.has(key)) {
      lookupCache.set(key, chrome.runtime.sendMessage({
        type: 'LOOKUP_ITEM_STATS',
        itemId,
        name: fallback && fallback.name,
      }).then((response) => {
        if (!response || !response.ok || !response.item) return fallback;
        const raidlootId = response.item.id || '';
        const item = {
          ...response.item,
          id: itemId || response.item.id,
          raidlootId,
          opendkpHost: OPENDKP_HOST,
          opendkpId: itemId || '',
          stats: LC.parser.normalizeStats(response.item.stats || {}),
        };
        if (itemId) itemCache.set(itemId, item);
        return item;
      }).catch(() => fallback));
    }
    return lookupCache.get(key);
  }

  function decorateWishlist(host, cand) {
    if (!LC.currentProfile || !host || !cand) return;
    const wantedEntry = LC.state.findWishlistEntry(LC.currentProfile, cand);
    const highlightHost = host.closest('tr, li, .p-listbox-item') || host;
    const liveAuction = !!(highlightHost.matches && highlightHost.matches('tr') && highlightHost.querySelector(LIVE_AUCTION_TIMER));
    highlightHost.classList.toggle('lc-wanted', !!wantedEntry && liveAuction);
    if (wantedEntry && LC.state.wishlistNeedsMerge(wantedEntry, cand, LC.currentProfile)) {
      LC.state.mergeWishlistCandidate(cand, LC.currentProfile.id).catch(() => {});
    }
    if (host.querySelector(':scope > .lc-wishlist-toggle')) return;
    const toggle = LC.ui.buildWishlistToggle(cand, !!wantedEntry, LC.currentProfile.id);
    const targets = LC.state.wishlistTargets(LC.currentProfile, cand);
    const compare = targets.length ? LC.ui.buildWishlistCompareButton(cand, targets, LC.currentFormula, LC.currentProfile.level) : null;
    if (compare) compare.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const existing = host.querySelector(':scope > .lc-wishlist-compare-panel');
      if (existing) { existing.remove(); return; }
      host.appendChild(LC.ui.buildWishlistComparePanel(cand, targets, LC.currentProfile, LC.currentFormula));
    });
    host.prepend(...[toggle, compare].filter(Boolean));
  }

  function annotateCandidate(host, cand, prepend) {
    cand = openDkpCandidate(cand, cand && (cand.opendkpId || cand.id));
    if (!host || !cand) return;
    decorateWishlist(host, cand);
    if (!cand.slotKey || host.querySelector(':scope > .lc-badge')) return;
    const badge = LC.ui.buildBadge('nomatch', 'no char', 'Pick a character in the popup');
    if (!LC.currentProfile) {
      if (prepend) host.prepend(badge); else host.appendChild(badge);
      return;
    }
    const f = LC.currentFormula;
    const comparison = LC.diff.compareCandidate(LC.currentProfile, cand, f);
    if (!comparison.eligible) return;
    const summary = LC.diff.summarizeComparisons(comparison);
    if (!summary.hasWorn && !summary.hasEffects) {
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
      if (!row.diff || (!row.diff.comparable && !row.diff.effectsComparable)) continue;
      for (const rowBadge of LC.ui.buildComparisonBadges(row, f, compact)) {
        rowBadge.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const existing = host.querySelector(':scope > .lc-compare-panel');
          if (existing) {
            const same = existing.dataset.lcView === rowBadge.dataset.lcView && existing.dataset.lcRow === String(index);
            existing.remove();
            if (same) return;
          }
          host.appendChild(LC.ui.buildComparePanel(cand, row.target, row.diff, row.slotKey && row.slotKey.key,
            row.isAugment ? comparison.rows : null, index, rowBadge.dataset.lcView));
        });
        badges.push(rowBadge);
      }
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
    const generation = ++annotationGeneration;
    await annotateItemDetailPage(generation);
    if (generation !== annotationGeneration) return;
    await annotateItemTooltips(generation);
    if (generation !== annotationGeneration) return;
    await annotateItemTables(generation);
  }

  // Item detail page: #/items/{id}
  async function annotateItemDetailPage(generation) {
    const itemId = openDkpItemId();
    if (!itemId) return;
    const route = location.hash;
    // Try cache first
    let cand = itemCache.get(itemId);
    if (!cand) {
      // Fallback: parse the rendered DOM
      const container = document.querySelector('app-root') || document.body;
      cand = LC.parser.parseOpenDkpDom(container);
      if (cand) cand.id = itemId;
    }
    cand = await resolveItem(itemId, cand);
    if (!cand || generation !== annotationGeneration || location.hash !== route || openDkpItemId() !== itemId) return;
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
  async function annotateItemTables(generation) {
    const links = document.querySelectorAll('a[href*="/items/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const m = href.match(/\/items\/([^/?#]+)/);
      if (!m) continue;
      const itemId = m[1];
      const cell = link.closest('td, .p-cell, .item-cell, li, .p-listbox-item');
      if (!cell) continue;
      // Get candidate from cache or parse the cell
      let cand = itemCache.get(itemId);
      if (!cand) {
        cand = LC.parser.parseOpenDkpDom(cell);
        if (cand) cand.id = itemId;
      }
      cand = await resolveItem(itemId, cand);
      if (generation !== annotationGeneration) return;
      if (!cand || !document.documentElement.contains(link) ||
          link.closest('td, .p-cell, .item-cell, li, .p-listbox-item') !== cell ||
          (link.getAttribute('href') || '') !== href) continue;
      annotateCandidate(cell, cand, false);
    }
  }

  async function annotateItemTooltips(generation) {
    const knownSelector = '[role="tooltip"], [class*="tooltip" i], [class*="popover" i], [class*="item-detail" i], .cdk-overlay-pane';
    const selector = knownSelector + ', body > div, body > div > div, body > div > div > div';
    const hosts = Array.from(document.querySelectorAll(selector)).filter((host) => {
      if (host.matches(knownSelector)) return true;
      if (host.querySelector(knownSelector)) return false;
      return !host.parentElement?.closest(knownSelector);
    });
    for (const host of hosts) {
      if (!document.documentElement.contains(host)) continue;
      if (host.querySelector(':scope > .lc-wishlist-toggle')) continue;
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
      const expectedName = cand.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const resolved = await resolveItem(itemId, cand);
      if (generation !== annotationGeneration) return;
      const currentCandidate = LC.parser.parseOpenDkpTooltip(host);
      const currentHeading = host.querySelector('h1, h2, h3, h4, h5, h6, strong, b, .item-name, .itemname');
      const currentName = String(currentCandidate && currentCandidate.name || currentHeading && currentHeading.textContent || '')
        .trim().toLowerCase().replace(/\s+/g, ' ');
      const currentTrigger = Array.from(document.querySelectorAll('a[rel^="eq:item:"], a[href*="/items/"]'))
        .find((link) => link.textContent.trim().toLowerCase().replace(/\s+/g, ' ') === currentName);
      const currentRel = currentTrigger && (currentTrigger.getAttribute('rel') || '').match(/^eq:item:([^\s]+)$/);
      const currentHref = currentTrigger && (currentTrigger.getAttribute('href') || '').match(/\/items\/([^/?#]+)/);
      const currentItemId = currentRel ? currentRel[1] : (currentHref ? currentHref[1] : '');
      const stillSameItem = currentName === expectedName && (!itemId || !currentItemId || currentItemId === itemId);
      if (resolved && document.documentElement.contains(host) &&
          stillSameItem) {
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
    const mo = new MutationObserver((records) => {
      const onlyExtensionChanges = records.every((record) => {
        if (record.target.nodeType === 1 && record.target.closest(LC_UI_SELECTOR)) return true;
        return [...record.addedNodes, ...record.removedNodes].every((node) =>
          node.nodeType !== 1 || node.matches(LC_UI_SELECTOR) || node.querySelector(LC_UI_SELECTOR));
      });
      if (onlyExtensionChanges) return;
      clearTimeout(init._t);
      init._t = setTimeout(annotatePage, 300);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('mouseover', (event) => {
      if (event.target.closest && event.target.closest('a[href*="/items/"]')) scheduleAnnotate(true);
    }, true);
    window.addEventListener('hashchange', () => {
      annotationGeneration++;
      document.querySelectorAll('.lc-badge, .lc-compare-panel, .lc-wishlist-toggle, .lc-wishlist-compare').forEach((el) => el.remove());
      document.querySelectorAll('.lc-wanted').forEach((el) => el.classList.remove('lc-wanted'));
      scheduleAnnotate(true);
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
    document.querySelectorAll('.lc-badge, .lc-compare-panel, .lc-wishlist-toggle, .lc-wishlist-compare').forEach((el) => el.remove());
    document.querySelectorAll('.lc-wanted').forEach((el) => el.classList.remove('lc-wanted'));
    annotatePage(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
