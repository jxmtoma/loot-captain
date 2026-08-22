// Loot Captain - raidloot.com content script
// Port of the original userscript, using local profiles instead of raidloot accounts.

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};
  const LC_UI_SELECTOR = '.lc-badge, .lc-compare-panel, .lc-compare-row, .lc-wish-meta, .lc-stat-indicator, .lc-stat-line, .lc-statified';
  const CONSENT_KEY = 'consentVersion';
  const CONSENT_VERSION = 1;
  let started = false;

  async function hasConsent() {
    const result = await chrome.storage.local.get(CONSENT_KEY);
    return result[CONSENT_KEY] === CONSENT_VERSION;
  }

  // ---------- Init ----------
  async function init() {
    if (started || !(await hasConsent())) return;
    started = true;
    LC.ui.injectCSS();
    await LC.state.loadAndCacheProfile();
    rerunPageAnnotations();
    const mo = new MutationObserver((records) => {
      // Ignore DOM changes made by the extension itself. Otherwise opening a
      // diff panel triggers a full rerun, which immediately removes the panel.
      const onlyExtensionChanges = records.every((record) => {
        if (record.target.nodeType === 1 && record.target.closest(LC_UI_SELECTOR)) return true;
        return [...record.addedNodes, ...record.removedNodes].every((node) =>
          node.nodeType !== 1 || node.matches(LC_UI_SELECTOR) || node.querySelector(LC_UI_SELECTOR));
      });
      if (onlyExtensionChanges) return;
      clearTimeout(init._t);
      init._t = setTimeout(rerunPageAnnotations, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- Annotators ----------
  function annotateItemElement(host, cand, attachPanel = true) {
    if (!cand || !cand.slotKey) return;
    if (host.querySelector(':scope > .lc-badge')) return;
    const badge = LC.ui.buildBadge('nomatch', 'no char', 'Pick a character in the popup');
    if (!LC.currentProfile) {
      host.prepend(badge);
      return;
    }
    const worn = LC.diff.findWornInSlot(LC.currentProfile, cand.slotKey);
    if (!worn.length) {
      badge.dataset.state = 'empty';
      badge.textContent = 'empty slot';
      badge.title = 'No worn item in slot ' + cand.slotKey.key;
      host.prepend(badge);
      return;
    }
    const f = LC.currentFormula;
    const target = LC.diff.bestComparisonTarget(cand, worn, f);
    if (!target) {
      badge.textContent = '?';
      badge.title = 'Item stats are unresolved; no comparison is available';
      host.prepend(badge);
      return;
    }
    const diff = LC.diff.diffItems(cand, target, f);
    if (!diff.comparable) {
      badge.textContent = '?';
      badge.title = 'Item stats are unresolved; no comparison is available';
      host.prepend(badge);
      return;
    }
    let state;
    if (diff.score > 0) state = 'upgrade';
    else if (diff.score < 0) state = 'downgrade';
    else state = 'sidegrade';
    badge.dataset.state = state;
    const arrow = state === 'upgrade' ? 'up' : state === 'downgrade' ? 'dn' : 'eq';
    badge.textContent = arrow + ' ' + LC.ui.fmtDelta(diff.score) + ' ' + f.label;
    badge.title = 'vs ' + target.name + '  (' + f.label + ' score)  -- click for full diff';
    if (attachPanel) badge.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const existing = host.querySelector(':scope > .lc-compare-panel');
      if (existing) { existing.remove(); return; }
      host.appendChild(LC.ui.buildComparePanel(cand, target, diff));
    });
    host.prepend(badge);
  }

  function annotateSearchRow(tr) {
    const m = tr.id.match(/^row-item(\d+)$/);
    if (!m) return;
    const id = m[1];
    const detail = document.getElementById('item' + id);
    if (!detail) return;
    const cand = LC.parser.parseRaidlootNode(detail);
    const nameAnchor = tr.querySelector('a[href*="/items/"]');
    const nameCell = nameAnchor ? nameAnchor.closest('td') : null;
    if (!nameCell) return;
    annotateItemElement(nameCell, cand, false);
    const badge = nameCell.querySelector(':scope > .lc-badge');
    if (badge && !badge.dataset.rewired) {
      badge.dataset.rewired = '1';
      badge.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const next = tr.nextSibling;
        if (next && next.classList && next.classList.contains('lc-compare-row')) {
          next.remove(); return;
        }
        if (!LC.currentProfile) return;
        const worn = LC.diff.findWornInSlot(LC.currentProfile, cand.slotKey);
        if (!worn.length) return;
        const f = LC.currentFormula;
        const target = LC.diff.bestComparisonTarget(cand, worn, f);
        if (!target) return;
        const diff = LC.diff.diffItems(cand, target, f);
        if (!diff.comparable) return;
        const newRow = document.createElement('tr');
        newRow.className = 'lc-compare-row';
        const td = document.createElement('td');
        td.colSpan = tr.cells.length;
        td.appendChild(LC.ui.buildComparePanel(cand, target, diff));
        newRow.appendChild(td);
        tr.parentNode.insertBefore(newRow, tr.nextSibling);
      }, true);
    }
  }

  function annotateLinkedItemRows() {
    for (const link of document.querySelectorAll('a[href*="/items/"]')) {
      if (link.closest('#inv')) continue;
      const match = (link.getAttribute('href') || '').match(/\/items\/(\d+)/);
      if (!match) continue;
      const detail = document.getElementById('item' + match[1]);
      const host = link.closest('td') || link.parentElement;
      if (!detail || !host) continue;
      annotateItemElement(host, LC.parser.parseRaidlootNode(detail));
    }
  }

  function annotateStandaloneItem(div) {
    const cand = LC.parser.parseRaidlootNode(div);
    if (!cand) return;
    annotateItemElement(div, cand);
    LC.ui.statifyItemDetail(div);
    LC.ui.addStatIndicators(div, cand, LC.currentProfile, LC.currentFormula);
  }

  // ---------- Wishlist ----------
  function findWishlistIcons() {
    const containers = document.querySelectorAll('.icons');
    for (const c of containers) {
      const kids = c.children;
      if (kids.length === 0) continue;
      let isWish = true;
      for (const k of kids) {
        const t = (k.dataset && k.dataset.target) || '';
        if (!/^#item\d+$/.test(t)) { isWish = false; break; }
      }
      if (isWish) return c;
    }
    return null;
  }

  function annotateWishlistIcons() {
    const c = findWishlistIcons();
    if (!c) return;
    c.classList.add('lc-wishlist-vert');
    const f = LC.currentFormula;
    const rows = [];
    for (const icon of c.children) {
      const targetSel = icon.dataset && icon.dataset.target;
      if (!targetSel) continue;
      const itemDiv = document.querySelector(targetSel);
      if (!itemDiv) continue;
      const cand = LC.parser.parseRaidlootNode(itemDiv);
      if (!cand) continue;
      let meta = icon.querySelector(':scope > .lc-wish-meta');
      if (!meta) {
        meta = document.createElement('span');
        meta.className = 'lc-wish-meta';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'lc-wish-name';
        nameSpan.textContent = cand.name || ('#' + cand.id);
        meta.appendChild(nameSpan);
        const slotSpan = document.createElement('span');
        slotSpan.className = 'lc-wish-slot';
        slotSpan.textContent = cand.slotKey ? cand.slotKey.key : (cand.slot || '?');
        meta.appendChild(slotSpan);
        icon.appendChild(meta);
      }
      const badge = document.createElement('span');
      badge.className = 'lc-badge';
      let sortKey = -Infinity;
      if (!LC.currentProfile) {
        badge.dataset.state = 'nomatch';
        badge.textContent = 'no char';
        badge.title = 'Pick a character in the popup';
      } else if (!cand.slotKey) {
        badge.dataset.state = 'nomatch';
        badge.textContent = '?';
        badge.title = 'Unknown slot for this item';
      } else {
        const worn = LC.diff.findWornInSlot(LC.currentProfile, cand.slotKey);
        if (!worn.length) {
          const emptyDiff = LC.diff.diffItems(cand, null, f);
          if (!emptyDiff.comparable) {
            badge.dataset.state = 'nomatch';
            badge.textContent = '?';
            badge.title = 'Item stats are unresolved; no comparison is available';
            meta.appendChild(badge);
            rows.push({ icon, sortKey });
            continue;
          }
          sortKey = emptyDiff.score;
          badge.dataset.state = 'empty';
          badge.textContent = 'empty ' + LC.ui.fmtDelta(emptyDiff.score) + ' ' + f.label;
          badge.title = 'No worn item in slot ' + cand.slotKey.key + '. Score is the raw item value.';
        } else {
          const target = LC.diff.bestComparisonTarget(cand, worn, f);
          if (!target) {
            badge.dataset.state = 'nomatch';
            badge.textContent = '?';
            badge.title = 'Item stats are unresolved; no comparison is available';
            meta.appendChild(badge);
            rows.push({ icon, sortKey });
            continue;
          }
          const diff = LC.diff.diffItems(cand, target, f);
          if (!diff.comparable) {
            badge.dataset.state = 'nomatch';
            badge.textContent = '?';
            badge.title = 'Item stats are unresolved; no comparison is available';
            meta.appendChild(badge);
            rows.push({ icon, sortKey });
            continue;
          }
          sortKey = diff.score;
          let state;
          if (diff.score > 0) state = 'upgrade';
          else if (diff.score < 0) state = 'downgrade';
          else state = 'sidegrade';
          badge.dataset.state = state;
          const arrow = state === 'upgrade' ? 'up' : state === 'downgrade' ? 'dn' : 'eq';
          badge.textContent = arrow + ' ' + LC.ui.fmtDelta(diff.score) + ' ' + f.label;
          badge.title = 'vs ' + target.name + ' (' + f.label + ' score) - click icon to expand details';
        }
      }
      meta.appendChild(badge);
      rows.push({ icon, sortKey });
    }
    rows.sort((a, b) => (b.sortKey - a.sortKey) || 0);
    for (const r of rows) c.appendChild(r.icon);
  }

  // ---------- Rerun ----------
  function rerunPageAnnotations(clearPanels) {
    const selectors = ['.lc-badge', '.lc-compare-row', '.lc-wish-meta', '.lc-stat-indicator'];
    if (clearPanels) selectors.push('.lc-compare-panel');
    document.querySelectorAll(selectors.join(', '))
      .forEach((el) => el.remove());
    document.querySelectorAll('tr[id^="row-item"]').forEach(annotateSearchRow);
    annotateLinkedItemRows();
    document.querySelectorAll('div.item[id^="item"][data-id]').forEach((div) => {
      if (div.classList.contains('augment')) return;
      if (div.classList.contains('Total') || div.id === 'item0') return;
      if (document.getElementById('row-item' + div.dataset.id)) return;
      if (div.closest('#inv') && !div.querySelector('.wish-remove')) return;
      annotateStandaloneItem(div);
    });
    annotateWishlistIcons();
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
    rerunPageAnnotations(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
