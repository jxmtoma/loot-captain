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
  // OpenDKP links item names to its own #/items/{id} route on tables, but the
  // live auction panel links them to Magelo instead, tagged with the EQ item id.
  const ITEM_LINK_SELECTOR = 'a[href*="/items/"], a[data-lucy^="item="], a[rel^="eq:item:"]';
  const ITEM_HOST_SELECTOR = 'td, .p-cell, .item-cell, li, .p-listbox-item';
  const LC_UI_SELECTOR = '.lc-badge, .lc-compare-panel, .lc-wishlist-toggle, .lc-wishlist-compare, .lc-armor-variant-picker, .lc-armor-variant-select';
  const OPENDKP_HOST = location.hostname.toLowerCase();
  let consented = false;
  let started = false;
  let itemCache = new Map(); // OpenDKP item id -> parsed item
  let lookupCache = new Map(); // OpenDKP item id/name + class -> Promise<parsed item>
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
    const sourceName = String(item.opendkpSourceName || item.sourceName || item.name || '');
    return {
      ...item,
      id: opendkpId || item.id || '',
      opendkpHost: OPENDKP_HOST,
      opendkpId,
      opendkpSourceName: sourceName,
    };
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

  function itemLinkId(link) {
    const href = (link.getAttribute('href') || '').match(/\/items\/([^/?#]+)/);
    if (href) return href[1];
    const lucy = (link.getAttribute('data-lucy') || '').match(/^item=(\d+)$/);
    if (lucy) return lucy[1];
    const rel = (link.getAttribute('rel') || '').match(/^eq:item:(\S+)$/);
    return rel ? rel[1] : '';
  }

  function itemLinkHost(link) {
    return link.closest(ITEM_HOST_SELECTOR) || link.parentElement;
  }

  function openDkpItemId() {
    const match = location.hash.match(/^#\/items\/([^/?#]+)/);
    return match ? match[1] : '';
  }

  function normalizedName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function profileClass() {
    return LC.parser && LC.parser.normalizeClass(LC.currentProfile && LC.currentProfile.cls) || '';
  }

  function normalizeResolvedStats(stats) {
    const out = {};
    for (const [key, value] of Object.entries(LC.parser.normalizeStats(stats || {}))) {
      if (value && typeof value === 'object' && 'num' in value) {
        out[key] = value;
        continue;
      }
      const num = parseFloat(value);
      out[key] = { raw: String(value), num: Number.isNaN(num) ? null : num };
    }
    return out;
  }

  function candidateHasData(item) {
    return Object.values(item && item.stats || {}).some((value) => {
      const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
      return num != null && !Number.isNaN(num);
    }) || !!(item && Array.isArray(item.effects) && item.effects.length);
  }

  function sourceCandidate(item, itemId) {
    if (item && item.opendkpSourceName && item.raidlootId) return item;
    return openDkpCandidate(item, itemId);
  }

  function resolvedCandidate(source, resolved) {
    const raidlootId = String(resolved && (resolved.raidlootId || resolved.id) || '');
    const candidate = {
      ...source,
      ...resolved,
      id: raidlootId || source.id || '',
      raidlootId,
      opendkpHost: OPENDKP_HOST,
      opendkpId: source.opendkpId || '',
      opendkpSourceName: source.opendkpSourceName || source.name || '',
      stats: normalizeResolvedStats(resolved && resolved.stats),
      effects: LC.parser.normalizeEffects(resolved && resolved.effects || []),
    };
    candidate.slotKey = candidate.slotKey || LC.slots.canonicalSlot(candidate.slot);
    return candidate;
  }

  async function resolveItem(itemId, fallback) {
    const cached = itemCache.get(itemId);
    if (cached && !cached.raidlootId && cached.slotKey && candidateHasData(cached)) return sourceCandidate(cached, itemId);
    fallback = sourceCandidate(fallback, itemId);
    const key = String(itemId || normalizedName(fallback && fallback.name) || '');
    if (!fallback || !fallback.name) return fallback;
    const cls = profileClass();
    const cacheKey = key + '|' + (cls || 'none');
    if (!lookupCache.has(cacheKey)) {
      lookupCache.set(cacheKey, chrome.runtime.sendMessage({
        type: 'LOOKUP_ITEM_STATS',
        itemId,
        name: fallback.name,
        characterClass: cls,
      }).then((response) => {
        if (!response || !response.item) {
          if (response && response.error) fallback.lookupError = String(response.error);
          return fallback;
        }
        const items = [response.item, ...(Array.isArray(response.alternatives) ? response.alternatives : [])]
          .map((item) => resolvedCandidate(fallback, item))
          .filter((item) => item.raidlootId && item.slotKey && candidateHasData(item))
          .filter((item) => !fallback.slotKey || item.slotKey.key === fallback.slotKey.key);
        if (!items.length) {
          fallback.lookupError = response.error || 'Resolved item data is invalid';
          return fallback;
        }
        const alternatives = [...new Map(items.map((item) => [item.raidlootId || item.name, item])).values()]
          .sort((a, b) => normalizedName(a.name).localeCompare(normalizedName(b.name)));
        const item = alternatives[0];
        item.alternatives = alternatives;
        return item;
      }).catch(() => {
        fallback.lookupError = fallback.lookupError || 'Could not resolve item stats';
        return fallback;
      }));
    }
    return lookupCache.get(cacheKey);
  }

  // A class-specific armor result may have a different RaidLoot name. Keep
  // the source token name in the wishlist record while comparison uses cand.
  function wishlistCandidate(cand) {
    const isResolvedToken = cand.opendkpSourceName &&
      (normalizedName(cand.opendkpSourceName) !== normalizedName(cand.name) ||
        (Array.isArray(cand.alternatives) && cand.alternatives.length > 1));
    return isResolvedToken ? {
      ...cand,
      name: cand.opendkpSourceName,
      // Variant IDs are comparison data; wishlist identity is the source token.
      raidlootId: '',
    } : cand;
  }

  function highlightWanted(host, wishlistCand, target) {
    const wanted = (LC.currentProfiles || [])
      .some((profile) => LC.state.findWishlistEntry(profile, wishlistCand));
    const highlightHost = target || host.closest('tr, li, .p-listbox-item') || host;
    const liveAuction = !!(highlightHost.matches && highlightHost.matches('tr') && highlightHost.querySelector(LIVE_AUCTION_TIMER)) ||
      !!host.closest('app-auctions');
    highlightHost.classList.toggle('lc-wanted', !!wanted && liveAuction);
  }

  function decorateWishlist(host, cand) {
    if (!LC.currentProfiles.length || !host || !cand) return;
    const wishlistCand = wishlistCandidate(cand);
    const wanted = LC.currentProfiles
      .map((profile) => ({ profile, entry: LC.state.findWishlistEntry(profile, wishlistCand) }))
      .filter((match) => match.entry);
    highlightWanted(host, wishlistCand);
    for (const { profile, entry } of wanted) {
      if (LC.state.wishlistNeedsMerge(entry, wishlistCand, profile)) {
        LC.state.mergeWishlistCandidate(wishlistCand, profile.id).catch(() => {});
      }
    }
    if (host.querySelector(':scope > .lc-wishlist-toggle')) return;
    const toggles = LC.currentProfiles.map((profile) =>
      LC.ui.buildWishlistToggle(wishlistCand, wanted.some((match) => match.profile === profile), profile.id, profile.name));
    const pairs = LC.state.wishlistTargetPairs(LC.currentProfiles, wishlistCand);
    const compare = pairs.length ? LC.ui.buildWishlistCompareButton(cand, pairs, LC.currentFormula) : null;
    if (compare) compare.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const existing = host.querySelector(':scope > .lc-wishlist-compare-panel');
      if (existing) { existing.remove(); return; }
      host.appendChild(LC.ui.buildWishlistComparePanel(cand, pairs, LC.currentFormula));
    });
    host.prepend(...[...toggles, compare].filter(Boolean));
  }

  function removeComparisonUI(host) {
    host.querySelectorAll(':scope > .lc-badge, :scope > .lc-compare-panel:not(.lc-wishlist-compare-panel)').forEach((el) => el.remove());
  }

  function addArmorVariantPicker(host, candidates, render) {
    if (!candidates || candidates.length < 2 || host.querySelector(':scope > .lc-armor-variant-picker')) return;
    const picker = document.createElement('label');
    picker.className = 'lc-armor-variant-picker';
    picker.appendChild(document.createTextNode('Armor variant'));
    const select = document.createElement('select');
    select.className = 'lc-armor-variant-select';
    select.setAttribute('aria-label', 'Armor variant');
    candidates.forEach((candidate, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = [candidate.name, candidate.armorSetLabel ? '(' + candidate.armorSetLabel + ')' : '']
        .filter(Boolean).join(' ') || ('Armor variant ' + (index + 1));
      select.appendChild(option);
    });
    select.addEventListener('change', () => render(candidates[Number(select.value)]));
    picker.appendChild(select);
    host.prepend(picker);
  }

  // Builds the verdict badges for one candidate. onBadge wires up the expandable
  // compare panel; callers without room for a panel (tab headers) leave it out.
  // With several characters selected, badges honor the badge layout setting:
  // 'collapsed' reflects the best character (plus aggregated focus/proc) and
  // 'expanded' shows every character's own labeled badges.
  function comparisonBadges(selected, onBadge) {
    const badge = LC.ui.buildBadge('nomatch', 'no char', 'Pick characters in the popup');
    if (!LC.currentProfiles.length) return [badge];
    if (selected.lookupError) {
      badge.textContent = '?';
      badge.title = selected.lookupError;
      return [badge];
    }
    if (!selected.slotKey) return [];
    const f = LC.currentFormula;
    if (LC.currentProfiles.length > 1) {
      const multi = LC.diff.compareCandidateMulti(LC.currentProfiles, selected, f);
      if (!multi.results.length) return [];
      const compact = (!selected.isAugment && (multi.best ? multi.best.comparison.rows.length : 0) > 1) ||
        LC.diff.weaponType(selected) != null;
      const badges = [];
      if (LC.currentBadgeLayout === 'expanded') {
        for (const rowBadge of LC.ui.buildPerCharacterBadges(multi, selected, f, compact)) {
          if (onBadge) onBadge(rowBadge, null, 0, null, multi);
          badges.push(rowBadge);
        }
        return badges;
      }
      if (!multi.best) {
        badge.textContent = '?';
        badge.title = 'Item stats are unresolved; no comparison is available';
        return [badge];
      }
      if (multi.best.empty) {
        badge.dataset.state = 'empty';
        badge.textContent = 'empty slot';
        badge.title = 'No worn item in slot ' + selected.slotKey.key + ' for any compared character';
        return [badge];
      }
      for (const rowBadge of LC.ui.buildMultiComparisonBadges(multi, selected, f, compact)) {
        rowBadge.dataset.lcRow = 'multi';
        if (onBadge) onBadge(rowBadge, null, 0, null, multi);
        badges.push(rowBadge);
      }
      return badges;
    }
    const comparison = LC.diff.compareCandidate(LC.currentProfile, selected, f);
    if (!comparison.eligible) return [];
    const summary = LC.diff.summarizeComparisons(comparison);
    if (!summary.hasWorn && !summary.hasEffects) {
      badge.dataset.state = 'empty';
      badge.textContent = 'empty slot';
      badge.title = 'No worn item in slot ' + selected.slotKey.key;
      return [badge];
    }
    if (!summary.comparable) {
      badge.textContent = '?';
      badge.title = 'Item stats are unresolved; no comparison is available';
      return [badge];
    }
    const compact = (!selected.isAugment && comparison.rows.length > 1) || LC.diff.weaponType(selected) != null;
    const badges = [];
    for (const [index, row] of comparison.rows.entries()) {
      if (selected.isAugment && index) break;
      if (!row.diff || (!row.diff.comparable && !row.diff.effectsComparable)) continue;
      for (const rowBadge of LC.ui.buildComparisonBadges(row, f, compact)) {
        if (onBadge) onBadge(rowBadge, row, index, comparison);
        badges.push(rowBadge);
      }
    }
    return badges;
  }

  function annotateCandidate(host, cand, prepend) {
    if (!host || !cand) return;
    cand = sourceCandidate(cand, cand.opendkpId || cand.id);
    decorateWishlist(host, cand);
    const candidates = Array.isArray(cand.alternatives) && cand.alternatives.length > 1 ? cand.alternatives : [cand];
    const render = (selected) => {
      removeComparisonUI(host);
      const f = LC.currentFormula;
      const badges = comparisonBadges(selected, (rowBadge, row, index, comparison, multi) => {
        rowBadge.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const existing = host.querySelector(':scope > .lc-compare-panel:not(.lc-wishlist-compare-panel)');
          if (existing) {
            const same = rowBadge.dataset.lcProfile
              ? (existing.dataset.lcView === rowBadge.dataset.lcView &&
                 existing.dataset.lcProfile === rowBadge.dataset.lcProfile &&
                 existing.dataset.lcRow === rowBadge.dataset.lcRow)
              : (multi
                ? (existing.dataset.lcView === rowBadge.dataset.lcView && existing.dataset.lcRow === 'multi')
                : (existing.dataset.lcView === rowBadge.dataset.lcView && existing.dataset.lcRow === String(index)));
            existing.remove();
            if (same) return;
          }
          // Expanded-layout badges open their own character's diff.
          if (rowBadge.dataset.lcProfile && multi) {
            const result = multi.results.find((entry) => String(entry.profile.id) === rowBadge.dataset.lcProfile);
            const charRow = result && result.comparison.rows[Number(rowBadge.dataset.lcRow)];
            if (!result || !charRow || !charRow.diff) return;
            const panel = LC.ui.buildComparePanel(selected, charRow.target, charRow.diff, charRow.slotKey && charRow.slotKey.key,
              charRow.isAugment ? result.comparison.rows : null, Number(rowBadge.dataset.lcRow), rowBadge.dataset.lcView);
            panel.dataset.lcProfile = rowBadge.dataset.lcProfile;
            host.appendChild(panel);
            return;
          }
          if (multi) {
            host.appendChild(LC.ui.buildMultiComparePanel(multi, selected, f, rowBadge.dataset.lcView));
            return;
          }
          host.appendChild(LC.ui.buildComparePanel(selected, row.target, row.diff, row.slotKey && row.slotKey.key,
            row.isAugment ? comparison.rows : null, index, rowBadge.dataset.lcView));
        });
      });
      if (prepend) host.prepend(...badges); else host.append(...badges);
    };
    addArmorVariantPicker(host, candidates, render);
    if (host.querySelector(':scope > .lc-badge')) return;
    render(candidates[0]);
  }

  // ---------- Annotation ----------
  function scheduleAnnotate(force) {
    clearTimeout(scheduleAnnotate._t);
    scheduleAnnotate._t = setTimeout(() => annotatePage(force), 200);
  }

  async function annotatePage(force) {
    if (!LC.currentProfiles.length) return;
    const now = Date.now();
    if (!force && now - lastAnnotate < 300) return;
    lastAnnotate = now;
    const generation = ++annotationGeneration;
    await annotateItemDetailPage(generation);
    if (generation !== annotationGeneration) return;
    await annotateItemTooltips(generation);
    if (generation !== annotationGeneration) return;
    await annotateItemTables(generation);
    if (generation !== annotationGeneration) return;
    await annotateAuctionTabs(generation);
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

  // Auction lists + raid result pages: items appear inline in tables, and on
  // the live auction panel as a heading link next to the bid timer.
  async function annotateItemTables(generation) {
    const links = document.querySelectorAll(ITEM_LINK_SELECTOR);
    for (const link of links) {
      const itemId = itemLinkId(link);
      if (!itemId) continue;
      const cell = itemLinkHost(link);
      if (!cell) continue;
      // Get candidate from cache or parse the link. Only the name is reliable
      // here: the auction heading wraps it in bid prose, so parse just the link.
      let cand = itemCache.get(itemId);
      if (!cand) {
        cand = LC.parser.parseOpenDkpDom(link);
        if (cand) cand.id = itemId;
      }
      cand = await resolveItem(itemId, cand);
      if (generation !== annotationGeneration) return;
      if (!cand || !document.documentElement.contains(link) ||
          itemLinkHost(link) !== cell || itemLinkId(link) !== itemId) continue;
      annotateCandidate(cell, cand, false);
    }
  }

  // Live auction tab headers carry the timer and the item name, but PrimeNG
  // only renders a tab's body once it is opened, so the wanted highlight has to
  // come from the header itself -- resolved by name, since it carries no id.
  // PrimeNG builds the tab's <li> class from an ngClass binding, so the nav link
  // is the only stable handle on a tab -- and the only safe thing to class.
  function auctionTabNameEl(link) {
    // <div class="flex flex-column"><p-progressBar><div *ngIf>bidder</div>
    // <div> {name} x {quantity} </div></div>
    const bar = link.querySelector(LIVE_AUCTION_TIMER);
    const box = bar && bar.closest('p-progressbar');
    return box && box.parentElement && box.parentElement.lastElementChild;
  }

  function auctionTabName(nameEl) {
    if (!nameEl) return '';
    // Text nodes only: the badges we append here are not part of the name.
    return Array.from(nameEl.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent).join('')
      .replace(/\s+x\s+\d+\s*$/i, '').trim();
  }

  async function annotateAuctionTabs(generation) {
    for (const link of document.querySelectorAll('a.p-tabview-nav-link')) {
      const nameEl = auctionTabNameEl(link);
      const name = auctionTabName(nameEl);
      if (!name) continue;
      const cand = await resolveItem('', { id: '', name, slot: '', slotKey: null, stats: {} });
      if (generation !== annotationGeneration) return;
      if (!cand || !document.documentElement.contains(link)) continue;
      highlightWanted(link, wishlistCandidate(cand), link);
      // Badges only: the compare panel needs the room the tab body has.
      if (nameEl.querySelector(':scope > .lc-badge')) continue;
      nameEl.append(...comparisonBadges(cand));
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
      if (host.querySelector(':scope > .lc-wishlist-toggle, :scope > .lc-armor-variant-picker')) continue;
      const text = host.textContent || '';
      if (text.length > 2500) continue;
      let cand = LC.parser.parseOpenDkpTooltip(host);
      if (!cand) {
        const heading = host.querySelector('h1, h2, h3, h4, h5, h6, strong, b, .item-name, .itemname');
        const name = heading && heading.textContent.trim();
        if (!name) continue;
        cand = { name, slot: '', slotKey: null, stats: {} };
      }
      const trigger = Array.from(document.querySelectorAll(ITEM_LINK_SELECTOR))
        .find((link) => link.textContent.trim().toLowerCase() === cand.name.trim().toLowerCase());
      const itemId = trigger ? itemLinkId(trigger) : '';
      const expectedName = cand.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const resolved = await resolveItem(itemId, cand);
      if (generation !== annotationGeneration) return;
      const currentCandidate = LC.parser.parseOpenDkpTooltip(host);
      const currentHeading = host.querySelector('h1, h2, h3, h4, h5, h6, strong, b, .item-name, .itemname');
      const currentName = String(currentCandidate && currentCandidate.name || currentHeading && currentHeading.textContent || '')
        .trim().toLowerCase().replace(/\s+/g, ' ');
      const currentTrigger = Array.from(document.querySelectorAll(ITEM_LINK_SELECTOR))
        .find((link) => link.textContent.trim().toLowerCase().replace(/\s+/g, ' ') === currentName);
      const currentItemId = currentTrigger ? itemLinkId(currentTrigger) : '';
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
      if (event.target.closest && event.target.closest(ITEM_LINK_SELECTOR)) scheduleAnnotate(true);
    }, true);
    window.addEventListener('hashchange', () => {
      annotationGeneration++;
      document.querySelectorAll('.lc-badge, .lc-compare-panel, .lc-wishlist-toggle, .lc-wishlist-compare, .lc-armor-variant-picker, .lc-armor-variant-select').forEach((el) => el.remove());
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
    const relevant = ['profiles', 'compareProfileIds', 'compareBadgeLayout', 'scoreFormula'].some((k) => changes[k]);
    if (!relevant) return;
    await LC.state.loadAndCacheProfile();
    // Clear badges and re-annotate
    document.querySelectorAll('.lc-badge, .lc-compare-panel, .lc-wishlist-toggle, .lc-wishlist-compare, .lc-armor-variant-picker, .lc-armor-variant-select').forEach((el) => el.remove());
    document.querySelectorAll('.lc-wanted').forEach((el) => el.classList.remove('lc-wanted'));
    annotatePage(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
