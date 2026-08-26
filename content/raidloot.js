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
    const f = LC.currentFormula;
    const comparison = LC.diff.compareCandidate(LC.currentProfile, cand, f);
    if (!comparison.eligible) return;
    const summary = LC.diff.summarizeComparisons(comparison);
    if (!summary.hasWorn && !summary.hasEffects) {
      badge.dataset.state = 'empty';
      badge.textContent = 'empty slot';
      badge.title = 'No worn item in slot ' + cand.slotKey.key;
      host.prepend(badge);
      return;
    }
    if (!summary.comparable) {
      badge.textContent = '?';
      badge.title = 'Item stats are unresolved; no comparison is available';
      host.prepend(badge);
      return;
    }
    const compact = (!cand.isAugment && comparison.rows.length > 1) || LC.diff.weaponType(cand) != null;
    const badges = [];
    for (const [index, row] of comparison.rows.entries()) {
      if (cand.isAugment && index) break;
      if (!row.diff || (!row.diff.comparable && !row.diff.effectsComparable)) continue;
      for (const rowBadge of LC.ui.buildComparisonBadges(row, f, compact)) {
        rowBadge.dataset.lcRow = index;
        if (attachPanel) rowBadge.addEventListener('click', (ev) => {
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
    host.prepend(...badges);
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
    const badges = nameCell.querySelectorAll(':scope > .lc-badge');
    badges.forEach((badge) => {
      if (badge.dataset.rewired) return;
      badge.dataset.rewired = '1';
      badge.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const compareRow = Array.from(tr.parentNode.children).find((node) =>
          node.classList && node.classList.contains('lc-compare-row') && node.dataset.lcOwner === id);
        if (compareRow) {
          const same = compareRow.dataset.lcRow === badge.dataset.lcRow && compareRow.dataset.lcView === badge.dataset.lcView;
          compareRow.remove();
          if (same) return;
        }
        if (!LC.currentProfile) return;
        const f = LC.currentFormula;
        const comparison = LC.diff.compareCandidate(LC.currentProfile, cand, f);
        const summary = LC.diff.summarizeComparisons(comparison);
        const row = comparison.rows[Number(badge.dataset.lcRow)];
        if (!comparison.eligible || !summary.comparable || !row) return;
        const newRow = document.createElement('tr');
        newRow.className = 'lc-compare-row';
        newRow.dataset.lcOwner = id;
        newRow.dataset.lcRow = badge.dataset.lcRow;
        newRow.dataset.lcView = badge.dataset.lcView;
        const td = document.createElement('td');
        td.colSpan = tr.cells.length;
        td.appendChild(LC.ui.buildComparePanel(cand, row.target, row.diff, row.slotKey && row.slotKey.key,
          row.isAugment ? comparison.rows : null, Number(badge.dataset.lcRow), badge.dataset.lcView));
        newRow.appendChild(td);
        const nativeDetailRow = detail.closest('tr');
        if (nativeDetailRow && nativeDetailRow !== tr && nativeDetailRow.parentNode === tr.parentNode) {
          tr.parentNode.insertBefore(newRow, nativeDetailRow.nextElementSibling);
        } else {
          tr.parentNode.appendChild(newRow);
        }
      }, true);
    });
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
        const comparison = LC.diff.compareCandidate(LC.currentProfile, cand, f);
        if (!comparison.eligible) {
          rows.push({ icon, sortKey });
          continue;
        }
        const summary = LC.diff.summarizeComparisons(comparison);
        if (!summary.hasWorn && !summary.hasEffects) {
          const emptyDiff = LC.diff.diffItems(cand, null, f);
          const hasEffects = comparison.rows.some((row) => row.diff && row.diff.effectsComparable);
          if (!emptyDiff.comparable && !hasEffects) {
            badge.dataset.state = 'nomatch';
            badge.textContent = '?';
            badge.title = 'Item stats are unresolved; no comparison is available';
            meta.appendChild(badge);
            rows.push({ icon, sortKey });
            continue;
          }
          sortKey = emptyDiff.score || 0;
          badge.dataset.state = hasEffects && !emptyDiff.comparable ? 'sidegrade' : 'empty';
          const emptyRow = { slotKey: cand.slotKey, diff: comparison.rows[0].diff };
          badge.textContent = emptyDiff.comparable ? 'empty ' + LC.ui.comparisonBadgeText(emptyRow, f, LC.diff.weaponType(cand) != null) : 'effects';
          badge.title = 'No worn item in slot ' + cand.slotKey.key + (hasEffects && !emptyDiff.comparable ? '; effect comparison available' : '. Score is the raw item value.');
        } else {
          if (!summary.comparable) {
            badge.dataset.state = 'nomatch';
            badge.textContent = '?';
            badge.title = 'Item stats are unresolved; no comparison is available';
            meta.appendChild(badge);
            rows.push({ icon, sortKey });
            continue;
          }
          sortKey = summary.score;
          const compact = (!cand.isAugment && comparison.rows.length > 1) || LC.diff.weaponType(cand) != null;
          for (const [index, row] of comparison.rows.entries()) {
            if (cand.isAugment && index) break;
            meta.append(...LC.ui.buildComparisonBadges(row, f, compact));
          }
          rows.push({ icon, sortKey });
          continue;
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
