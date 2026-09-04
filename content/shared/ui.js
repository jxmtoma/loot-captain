// Loot Captain - UI rendering + storage helpers (shared)

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};

  // ---------- Storage (chrome.storage.local) ----------
  const store = {
    async get(key, def) {
      const res = await chrome.storage.local.get(key);
      return res[key] === undefined ? def : res[key];
    },
    async set(key, val) {
      await chrome.storage.local.set({ [key]: val });
    },
  };

  // ---------- Styles ----------
  const CSS = [
    '.lc-badge{display:inline-block;padding:2px 6px;margin:0 4px;border:1px solid rgba(224,190,112,.55);border-radius:3px;font:10px/1.2 sans-serif;font-weight:bold;cursor:pointer;vertical-align:middle;user-select:none;box-shadow:0 1px 2px rgba(0,0,0,.25);}',
    '.lc-badge[data-state="upgrade"]{background:#315c4a;color:#eff8db;}',
    '.lc-badge[data-state="downgrade"]{background:#673c36;color:#ffe3d0;}',
    '.lc-badge[data-state="sidegrade"]{background:#655735;color:#fff1c8;}',
    '.lc-badge[data-state="empty"]{background:#315369;color:#e0f2f0;}',
    '.lc-badge[data-state="nomatch"]{background:#30393a;color:#d4cfbb;}',
    '.lc-wishlist-toggle,.lc-wishlist-compare{display:inline-block;padding:2px 6px;margin:0 4px;border:1px solid #9d8248;border-radius:3px;background:#252d2e;color:#ead69c;font:10px/1.2 Tahoma,sans-serif;font-weight:bold;cursor:pointer;vertical-align:middle;user-select:none;box-shadow:inset 0 1px rgba(255,255,255,.12),0 1px 2px rgba(0,0,0,.25);}',
    '.lc-wishlist-toggle{display:inline-block !important;width:auto !important;min-width:0 !important;max-width:none !important;height:auto !important;min-height:0 !important;padding:0 !important;margin:0 4px !important;border:0 !important;border-radius:0 !important;background:transparent !important;color:#b7974f !important;box-shadow:none !important;text-shadow:none !important;font:16px/1 sans-serif !important;appearance:none !important;}',
    '.lc-wishlist-toggle[aria-pressed="true"]{background:transparent !important;color:#e0b95f !important;border:0 !important;}',
    '.lc-wishlist-toggle:focus-visible{outline:1px solid #e0b95f !important;outline-offset:2px;}',
    '.lc-wishlist-compare[data-state="upgrade"]{background:linear-gradient(#3f765d,#244d3d);color:#d9f4d6;border-color:#c8a85a;}',
    '.lc-wishlist-compare[data-state="downgrade"]{background:linear-gradient(#804942,#4e2d2b);color:#ffe0d6;border-color:#b78162;}',
    '.lc-wishlist-toggle:disabled{cursor:wait;opacity:.65;}',
    '.lc-wanted:not(tr){outline:2px solid rgba(224,188,104,.8) !important;outline-offset:1px;background-color:rgba(132,101,35,.12) !important;}',
    'tr.lc-wanted > td{background-image:linear-gradient(rgba(132,101,35,.22),rgba(132,101,35,.22)) !important;}',
    // The auction tab's nav link paints its own theme background over ours.
    '.p-tabview-nav-link.lc-wanted{background-image:linear-gradient(rgba(132,101,35,.3),rgba(132,101,35,.3)) !important;}',
    '.lc-wishlist-compare-panel > .lc-compare-panel{margin:6px 0 0;box-shadow:none;}',
    '.lc-multi-compare-panel > .lc-compare-panel{margin:6px 0 0;box-shadow:none;}',
    '.lc-compare-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px;}',
    '.lc-compare-chip{padding:1px 6px;border:1px solid rgba(224,190,112,.55);border-radius:3px;background:#202a2b;color:#dbe3dc;font:10px/1.5 monospace;cursor:pointer;user-select:none;}',
    '.lc-compare-chip[data-state="upgrade"]{background:#315c4a;color:#eff8db;}',
    '.lc-compare-chip[data-state="downgrade"]{background:#673c36;color:#ffe3d0;}',
    '.lc-compare-chip[data-state="sidegrade"]{background:#655735;color:#fff1c8;}',
    '.lc-compare-chip[data-state="empty"]{background:#315369;color:#e0f2f0;}',
    '.lc-compare-chip.lc-active{outline:2px solid #e0b95f;outline-offset:0;}',
    '.lc-wishlist-picker{display:flex;align-items:center;gap:8px;color:#e0b96b;font-weight:bold;}',
    '.lc-wishlist-picker select{max-width:360px;background:#101d2e;color:#f0d18a;border:1px solid #8b7547;font:inherit;padding:2px 4px;}',
    '.lc-wishlist-message{padding:6px 0;color:#d4cfbb;}',
    '.lc-character-picker-panel{min-width:150px;}',
    '.lc-character-picker-row{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;color:#e9e1ca;font:inherit;text-align:left;cursor:pointer;padding:2px 0;}',
    '.lc-character-picker-row:hover{color:#f0d18a;}',
    '.lc-character-picker-row:disabled{cursor:wait;opacity:.65;}',
    '.lc-compare-panel{background:#151d1e;color:#e9e1ca;border:1px solid #8b7547;border-radius:4px;padding:8px 10px;margin:6px 0;font:11px/1.35 monospace;max-width:720px;box-shadow:0 3px 12px rgba(0,0,0,.25);}',
    '.lc-compare-panel table{border-collapse:collapse;table-layout:fixed !important;width:100%;background:#202a2b !important;color:#dbe3dc !important;}',
    '.lc-compare-panel tr{background:#202a2b !important;}',
    '.lc-compare-panel th,.lc-compare-panel td{padding:2px 8px 2px 0 !important;text-align:right !important;background:#202a2b !important;color:#dbe3dc !important;border-bottom:1px solid #46524f !important;}',
    '.lc-compare-panel th:first-child,.lc-compare-panel td:first-child{text-align:left !important;}',
    '.lc-compare-panel th{color:#c6a45e !important;font-weight:bold;}',
    '.lc-compare-panel td:first-child{color:#b9c4bc !important;}',
    '.lc-compare-panel .lc-pos{color:#84d7a2 !important;}',
    '.lc-compare-panel .lc-neg{color:#f28b79 !important;}',
    '.lc-compare-panel .lc-zero{color:#aaaeb0 !important;}',
    '.lc-compare-panel .lc-head{display:flex;align-items:flex-start;gap:8px;color:#e0b96b !important;font-weight:bold;}',
    '.lc-compare-title{min-width:0;flex:1 1 auto;}',
    '.lc-compare-nav{display:inline-flex;flex:0 0 auto;align-items:center;gap:4px;color:#c3ceda;}',
    '.lc-compare-nav button{padding:0 6px;border:1px solid #8b7547;background:#101d2e;color:#f0d18a;cursor:pointer;font:inherit;}',
    '.lc-stat-indicator{display:inline-block;font:11px/1.2 sans-serif;margin-left:8px;padding:0 6px;border-radius:3px;}',
    '.lc-stat-indicator[data-dir="up"]{color:#6cdc6c;background:rgba(108,220,108,.12);}',
    '.lc-stat-indicator[data-dir="down"]{color:#ff7676;background:rgba(255,118,118,.12);}',
    '.lc-stat-indicator[data-dir="zero"]{color:#888;background:rgba(255,255,255,.04);}',
    '.lc-wishlist-vert{flex-direction:column !important;align-items:stretch !important;height:auto !important;width:auto !important;max-width:720px !important;gap:2px;}',
    '.lc-wishlist-vert > div{display:flex !important;flex-direction:row;align-items:center;gap:8px;width:100%;height:auto !important;min-height:34px;padding:2px 4px;border-radius:3px;}',
    '.lc-wishlist-vert > div:hover{background:rgba(255,255,255,.06);}',
    '.lc-wishlist-vert > div.selected{background:rgba(255,255,255,.12);outline:1px solid #666;}',
    '.lc-wish-meta{display:inline-flex;flex-direction:row;align-items:center;gap:8px;flex:1 1 auto;font:12px/1.3 sans-serif;}',
    '.lc-wish-name{flex:1 1 auto;color:#ddd;}',
    '.lc-wish-slot{flex:0 0 auto;color:#888;font-size:11px;text-transform:capitalize;}',
    '.lc-statified > br{display:none;}',
    '.lc-stat-line{display:block;line-height:1.45;margin:1px 0;}',
    '.lc-stat-line > label{display:inline-block;min-width:96px;opacity:.85;}',
    '.lc-badge{border-radius:2px;font-family:Tahoma,sans-serif;text-shadow:1px 1px rgba(0,0,0,.65);box-shadow:inset 0 1px rgba(255,255,255,.18),0 2px 4px rgba(0,0,0,.35);}',
    '.lc-badge[data-state="upgrade"]{background:linear-gradient(#3f765d,#244d3d);color:#d9f4d6;border-color:#c8a85a;}',
    '.lc-badge[data-state="downgrade"]{background:linear-gradient(#804942,#4e2d2b);color:#ffe0d6;border-color:#b78162;}',
    '.lc-badge[data-state="sidegrade"]{background:linear-gradient(#806b3b,#514324);color:#fff0bd;border-color:#d0aa5b;}',
    '.lc-compare-panel{background:linear-gradient(145deg,#15253a,#0a1422);border-color:#a38348;border-radius:2px;padding:10px 12px;box-shadow:inset 0 1px rgba(255,255,255,.1),inset 0 0 0 1px rgba(0,0,0,.35),0 5px 14px rgba(0,0,0,.4);font-family:Tahoma,monospace;}',
    '.lc-compare-panel table,.lc-compare-panel tr,.lc-compare-panel th,.lc-compare-panel td{background:#101d2e !important;}',
    '.lc-compare-panel tr:nth-child(even) td{background:#14243a !important;}',
    '.lc-compare-panel th{color:#e6c26d !important;text-transform:uppercase;letter-spacing:.06em;}',
    '.lc-compare-panel td:first-child{color:#c3ceda !important;font-weight:bold;}',
    '.lc-compare-panel .lc-head{color:#f0d18a !important;text-shadow:1px 1px #07101b;}',
    '.lc-effect-details{margin-top:6px;color:#dbe3dc;}',
    '.lc-effect-details summary{cursor:pointer;color:#c6a45e;font-weight:bold;}',
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('lc-styles')) return;
    const s = document.createElement('style');
    s.id = 'lc-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- Formatting ----------
  function fmtStat(v) {
    if (v == null) return '-';
    if (Number.isInteger(v)) return v.toLocaleString();
    return v.toFixed(2);
  }
  function fmtDelta(d) {
    if (d == null) return '';
    const sign = d > 0 ? '+' : '';
    return sign + (Number.isInteger(d) ? d.toLocaleString() : d.toFixed(2));
  }

  // ---------- Badge ----------
  function buildBadge(state, text, title) {
    const badge = document.createElement('span');
    badge.className = 'lc-badge';
    badge.dataset.state = state;
    badge.textContent = text;
    if (title) badge.title = title;
    return badge;
  }

  // ---------- Compare panel ----------
  function effectValue(effect, effective, level, damage) {
    if (!effect) return '—';
    const name = effect.name || effect.raw || 'Unnamed effect';
    const rank = effect.rank == null || name.includes(String(effect.rank)) ? '' : ' [' + effect.rank + ']';
    const source = effect.source ? ' · ' + effect.source : '';
    const adjusted = effective ? ' · effective ' +
      (effective.min === effective.max ? effective.max : effective.min + '-' + effective.max) + '% @ L' + level : '';
    const procDamage = damage == null ? '' : ' · ' + damage + ' dmg';
    return name + rank + adjusted + procDamage + source;
  }

  function effectStatus(status) {
    return { added: 'added', removed: 'removed', changed: 'changed', covered: 'covered', different: 'different', same: 'same' }[status] || status;
  }

  function buildEffectDetails(label, group) {
    if (!group || !group.rows || !group.rows.length) return null;
    const details = document.createElement('details');
    details.className = 'lc-effect-details';
    const summary = document.createElement('summary');
    const changes = group.rows.filter((row) => row.status !== 'same' && row.status !== 'covered').length;
    summary.textContent = label + ' (' + (changes ? changes + ' change' + (changes === 1 ? '' : 's') : 'covered') + ')';
    details.appendChild(summary);
    const table = document.createElement('table');
    const header = document.createElement('tr');
    for (const label of ['status', 'current', 'candidate']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      header.appendChild(cell);
    }
    const thead = document.createElement('thead');
    thead.appendChild(header);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const effectRow of group.rows) {
      const row = document.createElement('tr');
      const comparison = effectRow.focusComparison;
      const procComparison = effectRow.procComparison;
      const status = effectRow.direction > 0 ? 'upgrade' : effectRow.direction < 0 ? 'downgrade' : effectStatus(effectRow.status);
      for (const value of [status,
        effectValue(effectRow.current, comparison && comparison.current, comparison && comparison.level, procComparison && procComparison.current),
        effectValue(effectRow.candidate, comparison && comparison.candidate, comparison && comparison.level, procComparison && procComparison.candidate)]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    details.appendChild(table);
    return details;
  }

  function buildComparePanel(cand, worn, diff, slotLabel, alternatives, selectedIndex = 0, view = 'stats', baselineLabel = 'worn') {
    const div = document.createElement('div');
    div.className = 'lc-compare-panel';
    div.dataset.lcView = view;
    div.dataset.lcRow = String(selectedIndex);
    const head = document.createElement('div');
    head.className = 'lc-head';
    if (!worn) {
      head.textContent = 'No worn item in ' + (slotLabel || ((cand.slotKey && cand.slotKey.key) || '?')) + '.';
      div.appendChild(head);
      return div;
    }
    const seen = new Set();
    const ordered = [];
    for (const k of LC.diff.STAT_ORDER) if (k in diff.diffs) { ordered.push(k); seen.add(k); }
    for (const k of Object.keys(diff.diffs)) if (!seen.has(k)) ordered.push(k);
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const header = document.createElement('tr');
    for (const label of ['stat', baselineLabel, 'candidate', 'delta']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      header.appendChild(cell);
    }
    thead.appendChild(header);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const k of ordered) {
      const d = diff.diffs[k];
      let cls;
      if (d.delta == null || d.delta === 0) cls = 'lc-zero';
      else if ((d.delta > 0) === d.positive) cls = 'lc-pos';
      else cls = 'lc-neg';
      const row = document.createElement('tr');
      for (const [tag, value, className] of [
        ['td', k], ['td', fmtStat(d.worn)], ['td', fmtStat(d.cand)], ['td', fmtDelta(d.delta), cls],
      ]) {
        const cell = document.createElement(tag);
        cell.textContent = value;
        if (className) cell.className = className;
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    const title = document.createElement('span');
    title.className = 'lc-compare-title';
    title.appendChild(document.createTextNode(
      (view === 'focus' ? 'Spell focus: ' : view === 'proc' ? 'Proc: ' : '') + (slotLabel ? slotLabel + ': ' : '') +
      (worn.name || ('#' + worn.id)) + ' -> ' + (cand.name || ('#' + cand.id)) + ' '
    ));
    if (view === 'stats' && diff.comparable) {
      const scoreCls = diff.score > 0 ? 'lc-pos' : (diff.score < 0 ? 'lc-neg' : 'lc-zero');
      const fLabel = (diff.formula && diff.formula.label) || 'score';
      const ratio = diff.weaponRatioDelta == null ? '' : '; Weapon ratio delta: ' + fmtDelta(diff.weaponRatioDelta);
      const score = document.createElement('span');
      score.className = scoreCls;
      score.textContent = '(' + fLabel + ' delta: ' + fmtDelta(diff.score) + ratio + ')';
      title.appendChild(score);
    } else if (view === 'stats' && diff.effectsComparable) {
      title.appendChild(document.createTextNode('(effects only; not scored)'));
    }
    head.appendChild(title);
    if (view === 'stats' && alternatives && alternatives.length > 1) {
      const nav = document.createElement('span');
      nav.className = 'lc-compare-nav';
      const move = (offset) => {
        const index = (selectedIndex + offset + alternatives.length) % alternatives.length;
        const row = alternatives[index];
        div.replaceWith(buildComparePanel(cand, row.target, row.diff,
          row.slotKey && row.slotKey.key, alternatives, index, view, baselineLabel));
      };
      for (const [label, title, offset] of [['‹', 'Previous worn augment', -1], ['›', 'Next worn augment', 1]]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.title = title;
        button.setAttribute('aria-label', title);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          move(offset);
        });
        nav.appendChild(button);
        if (offset < 0) nav.appendChild(document.createTextNode((selectedIndex + 1) + ' / ' + alternatives.length));
      }
      head.appendChild(nav);
    }
    div.appendChild(head);
    if (view === 'stats' && diff.comparable) div.appendChild(table);
    const focusDetails = buildEffectDetails('Spell focus', diff.effects && diff.effects.focus);
    const procDetails = buildEffectDetails('Proc', diff.effects && diff.effects.proc);
    if (view === 'focus' && focusDetails) {
      focusDetails.open = true;
      div.appendChild(focusDetails);
    }
    if (view === 'proc' && procDetails) {
      procDetails.open = true;
      div.appendChild(procDetails);
    }
    if (view === 'stats' && baselineLabel === 'wishlist') {
      if (focusDetails) div.appendChild(focusDetails);
      if (procDetails) div.appendChild(procDetails);
    }
    return div;
  }

  function setWishlistToggleState(button, wanted) {
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-label', wanted ? 'Remove from wishlist' : 'Add to wishlist');
    button.textContent = wanted ? '★' : '☆';
    button.title = button.dataset.lcMulti ? 'Wishlist (pick a character)' : 'Wishlist';
  }

  // One wishlist star per item. profiles: [{ profile, wanted }]. Characters
  // that cannot wear the item (class or required level) are excluded, and if
  // none can wear it the star renders disabled. With a single eligible
  // character the star toggles directly; with several, clicking opens a
  // picker so the user can choose which character's wishlist to update. The
  // picker also closes when clicking anywhere outside it.
  function buildWishlistToggle(cand, profiles) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lc-wishlist-toggle';
    const eligible = profiles.filter((entry) => LC.parser.canWear(cand, entry.profile));
    if (!eligible.length) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.textContent = '☆';
      button.title = 'No selected character can wear this item';
      return button;
    }
    const multi = eligible.length > 1;
    if (multi) button.dataset.lcMulti = '1';
    setWishlistToggleState(button, eligible.some((entry) => entry.wanted));
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (multi) {
        const host = button.parentNode;
        const existing = host && host.querySelector(':scope > .lc-character-picker-panel');
        if (existing) { existing.remove(); return; }
        if (!host) return;
        const picker = buildWishlistCharacterPicker(cand, eligible, button);
        host.appendChild(picker);
        const onDocClick = (event) => {
          if (!picker.isConnected) {
            document.removeEventListener('click', onDocClick, true);
            return;
          }
          if (picker.contains(event.target) || button.contains(event.target)) return;
          picker.remove();
          document.removeEventListener('click', onDocClick, true);
        };
        document.addEventListener('click', onDocClick, true);
        return;
      }
      button.disabled = true;
      try {
        const entry = eligible[0];
        const result = await LC.state.toggleWishlist(cand, entry && entry.profile.id);
        if (result.ok) {
          if (entry) entry.wanted = result.wanted;
          setWishlistToggleState(button, eligible.some((item) => item.wanted));
        } else {
          button.title = 'Could not update the wishlist';
        }
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  function buildWishlistCharacterPicker(cand, profiles, starButton) {
    const wrapper = document.createElement('div');
    wrapper.className = 'lc-compare-panel lc-character-picker-panel';
    for (const entry of profiles) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'lc-character-picker-row';
      const star = document.createElement('span');
      star.textContent = entry.wanted ? '★' : '☆';
      star.setAttribute('aria-hidden', 'true');
      row.appendChild(star);
      row.appendChild(document.createTextNode((entry.profile && entry.profile.name) || 'Unnamed'));
      row.setAttribute('aria-label', ((entry.profile && entry.profile.name) || 'Unnamed') +
        (entry.wanted ? ': remove from wishlist' : ': add to wishlist'));
      row.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (row.disabled) return;
        row.disabled = true;
        try {
          const result = await LC.state.toggleWishlist(cand, entry.profile.id);
          if (result.ok) {
            entry.wanted = result.wanted;
            star.textContent = result.wanted ? '★' : '☆';
            setWishlistToggleState(starButton, profiles.some((item) => item.wanted));
          }
        } finally {
          row.disabled = false;
        }
      });
      wrapper.appendChild(row);
    }
    return wrapper;
  }

  // pairs: [{ target, profile }] -- wishlist entries paired with the character
  // that wants them, so each comparison uses the owner's level.
  function buildWishlistCompareButton(cand, pairs, formula) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lc-wishlist-compare';
    const directions = (pairs || []).map((pair) =>
      LC.diff.compareItemPair(cand, pair.target, formula, pair.profile && pair.profile.level))
      .filter((diff) => diff.comparable)
      .map((diff) => Math.sign(diff.score));
    const direction = directions.length && directions.every((value) => value > 0) ? 1
      : directions.length && directions.every((value) => value < 0) ? -1 : 0;
    const arrow = direction > 0 ? ' ↑' : direction < 0 ? ' ↓' : '';
    button.dataset.state = direction > 0 ? 'upgrade' : direction < 0 ? 'downgrade' : 'sidegrade';
    button.textContent = 'vs wishlist' + arrow + (pairs.length > 1 ? ' (' + pairs.length + ')' : '');
    button.title = (direction > 0 ? 'Upgrade' : direction < 0 ? 'Downgrade' : 'Compare') + ' versus wishlist';
    return button;
  }

  function buildWishlistComparePanel(cand, pairs, formula) {
    const wrapper = document.createElement('div');
    wrapper.className = 'lc-compare-panel lc-wishlist-compare-panel';
    wrapper.dataset.lcView = 'wishlist';
    const body = document.createElement('div');
    let renderGeneration = 0;
    const render = async (pair) => {
      const generation = ++renderGeneration;
      body.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'lc-wishlist-message';
      loading.textContent = 'Loading wishlist item…';
      body.appendChild(loading);
      const owner = pair.profile;
      const resolved = await LC.state.enrichWishlistEntry(pair.target, owner && owner.id);
      if (generation !== renderGeneration || !wrapper.isConnected) return;
      if (!LC.state.compatibleWishlistItem(cand, resolved)) {
        loading.textContent = 'Wishlist item uses an incompatible slot or weapon layout.';
        return;
      }
      const diff = LC.diff.compareItemPair(cand, resolved, formula, owner && owner.level);
      if (!diff.comparable && !diff.effectsComparable) {
        loading.textContent = 'Wishlist item stats unavailable.';
        return;
      }
      body.replaceChildren(buildComparePanel(cand, resolved, diff,
        (resolved.slotKey && resolved.slotKey.key) || resolved.slot, null, 0, 'stats', 'wishlist'));
    };
    if (pairs.length > 1) {
      const picker = document.createElement('label');
      picker.className = 'lc-wishlist-picker';
      picker.appendChild(document.createTextNode('Compare against'));
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Wishlist comparison item');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Choose a wishlist item';
      select.appendChild(placeholder);
      pairs.forEach((pair, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = [pair.target.name || ('Wishlist item ' + (index + 1)),
          pair.profile && pair.profile.name ? '(' + pair.profile.name + ')' : ''].join(' ');
        select.appendChild(option);
      });
      select.addEventListener('change', () => {
        if (select.value !== '') render(pairs[Number(select.value)]);
        else { renderGeneration++; body.replaceChildren(); }
      });
      picker.appendChild(select);
      wrapper.appendChild(picker);
    } else if (pairs[0]) {
      render(pairs[0]);
    }
    wrapper.appendChild(body);
    return wrapper;
  }

  function slotShort(slotKey) {
    return { primary: 'P', secondary: 'S', range: 'R' }[slotKey && slotKey.key] || '';
  }

  function comparisonBadgeText(row, formula, compact) {
    const diff = row.diff;
    if (!diff.comparable && diff.effectsComparable) return [slotShort(row.slotKey), 'effects'].filter(Boolean).join(' ');
    const arrow = diff.score > 0 ? 'up' : diff.score < 0 ? 'dn' : 'eq';
    const slot = slotShort(row.slotKey);
    if (row.isAugment) return 'aug ' + arrow + ' ' + fmtDelta(diff.score);
    if (compact) {
      return [slot, arrow, fmtDelta(diff.score), diff.weaponRatioDelta == null ? '' : 'r ' + fmtDelta(diff.weaponRatioDelta)]
        .filter(Boolean).join(' ');
    }
    return arrow + ' ' + fmtDelta(diff.score) +
      (diff.weaponRatioDelta == null ? '' : ' · ratio ' + fmtDelta(diff.weaponRatioDelta));
  }

  function comparisonBadgeTitle(row, formula) {
    const slot = row.slotKey && row.slotKey.key;
    const ratio = row.diff.weaponRatioDelta == null ? '' : '; weapon ratio delta ' + fmtDelta(row.diff.weaponRatioDelta);
    if (row.isAugment) {
      const compatible = (row.compatibleSlots || []).join(', ');
      return 'Augment; fits ' + compatible + '; ' + (slot || '?') + ': vs ' +
        (row.target && (row.target.name || ('#' + row.target.id)) || 'worn augment') +
        ' (delta ' + fmtDelta(row.diff.score) + ') -- click for full diff';
    }
    return (slot ? slot + ': ' : '') + 'vs ' + (row.target && (row.target.name || ('#' + row.target.id)) || 'worn item') +
      ' (delta ' + fmtDelta(row.diff.score) + ratio + ') -- click for full diff';
  }

  function buildComparisonBadge(row, formula, compact) {
    const effectOnly = !row.diff.comparable && row.diff.effectsComparable;
    const badge = buildBadge(
      effectOnly ? 'sidegrade' : (row.diff.score > 0 ? 'upgrade' : row.diff.score < 0 ? 'downgrade' : 'sidegrade'),
      comparisonBadgeText(row, formula, compact), comparisonBadgeTitle(row, formula));
    badge.dataset.lcView = 'stats';
    return badge;
  }

  function focusRankValue(effect) {
    const raw = String(effect && effect.rank || '');
    const number = raw.match(/-?\d+(?:\.\d+)?/);
    if (number) return parseFloat(number[0]);
    const roman = raw.match(/^[ivxlcdm]+$/i);
    if (!roman) return null;
    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    return roman[0].toUpperCase().split('').reduce((total, char, index, chars) =>
      total + (values[char] < (values[chars[index + 1]] || 0) ? -values[char] : values[char]), 0);
  }

  function focusPositiveNegative(rows) {
    let positive = false;
    let negative = false;
    for (const effectRow of rows || []) {
      if (effectRow.direction > 0) { positive = true; continue; }
      if (effectRow.direction < 0) { negative = true; continue; }
      if (effectRow.status === 'added') positive = true;
      if (effectRow.status === 'removed') negative = true;
      if (effectRow.status === 'changed') {
        const current = focusRankValue(effectRow.current);
        const candidate = focusRankValue(effectRow.candidate);
        if (current != null && candidate != null) candidate > current ? (positive = true) : (negative = true);
        else positive = negative = true;
      }
    }
    return { positive, negative };
  }

  function focusStateLabel(positive, negative) {
    return positive && negative ? 'focus change' : positive ? 'focus up' : 'focus dn';
  }

  function buildFocusBadge(row) {
    const rows = row.diff.effects && row.diff.effects.focus && row.diff.effects.focus.rows || [];
    const { positive, negative } = focusPositiveNegative(rows);
    if (!positive && !negative) return null;
    const state = positive && negative ? 'sidegrade' : positive ? 'upgrade' : 'downgrade';
    const text = focusStateLabel(positive, negative);
    const badge = buildBadge(state, text, 'Spell focus ' + (state === 'sidegrade' ? 'changed' : state) + '; click for details');
    badge.dataset.lcView = 'focus';
    return badge;
  }

  function procPositiveNegative(rows) {
    let positive = false;
    let negative = false;
    let unknown = false;
    for (const effectRow of rows || []) {
      if (effectRow.status === 'same') continue;
      if (effectRow.direction > 0 || effectRow.status === 'added') positive = true;
      else if (effectRow.direction < 0 || effectRow.status === 'removed') negative = true;
      else unknown = true;
    }
    return { positive, negative, unknown };
  }

  function procStateText(positive, negative, unknown) {
    return !unknown && positive !== negative
      ? (positive ? 'proc up' : 'proc dn') : 'proc change';
  }

  function buildProcBadge(row) {
    const rows = row.diff.effects && row.diff.effects.proc && row.diff.effects.proc.rows || [];
    if (!rows.length) return null;
    const changed = rows.filter((effectRow) => effectRow.status !== 'same');
    const slot = slotShort(row.slotKey);
    if (!changed.length) {
      const badge = buildBadge('sidegrade', [slot, 'proc eq'].filter(Boolean).join(' '), 'Weapon proc damage is equal; click for proc-only details');
      badge.dataset.lcView = 'proc';
      return badge;
    }
    const { positive, negative, unknown } = procPositiveNegative(changed);
    const state = !unknown && positive !== negative ? (positive ? 'upgrade' : 'downgrade') : 'sidegrade';
    const text = [slot, procStateText(positive, negative, unknown)].filter(Boolean).join(' ');
    const badge = buildBadge(state, text, 'Weapon proc ' + (state === 'sidegrade' ? 'changed' : state) + '; click for proc-only details');
    badge.dataset.lcView = 'proc';
    return badge;
  }

  function buildComparisonBadges(row, formula, compact) {
    const main = row.diff.comparable ? buildComparisonBadge(row, formula, compact) : null;
    return [main, buildFocusBadge(row), buildProcBadge(row)].filter(Boolean);
  }

  // ---------- Multi-character badges + panel ----------
  // One-line summary of one profile's comparison, for tooltips and chips.
  function multiResultSummary(result) {
    const name = (result.profile && result.profile.name) || 'Unnamed';
    if (result.empty) return name + ': empty slot';
    const row = result.summary.rows.find((entry) => entry.diff && entry.diff.comparable) || result.summary.rows[0];
    const worn = row && row.target;
    return name + ': ' + fmtDelta(result.summary.score) + (worn ? ' vs ' + (worn.name || ('#' + worn.id)) : '');
  }

  function multiComparisonSummary(multi) {
    return multi.results.map(multiResultSummary).join('; ');
  }

  function resultEffectRows(result, kind) {
    const rows = [];
    for (const row of result.comparison.rows) {
      const group = row.diff && row.diff.effects && row.diff.effects[kind];
      if (group && group.rows && group.rows.length) rows.push(...group.rows);
    }
    return rows;
  }

  // Aggregate spell-focus badge across every compared character, not just the
  // best one: focus is character-specific (it depends on each character's worn
  // item), so one character may gain focus while another loses it.
  function buildMultiFocusBadge(multi) {
    let positive = false;
    let negative = false;
    const parts = [];
    for (const result of multi.results) {
      const { positive: up, negative: down } = focusPositiveNegative(resultEffectRows(result, 'focus'));
      positive = positive || up;
      negative = negative || down;
      parts.push(((result.profile && result.profile.name) || 'Unnamed') + ': ' +
        (up && down ? 'focus change' : up ? 'focus up' : down ? 'focus dn' : 'focus same'));
    }
    if (!positive && !negative) return null;
    const state = positive && negative ? 'sidegrade' : positive ? 'upgrade' : 'downgrade';
    const text = focusStateLabel(positive, negative);
    const badge = buildBadge(state, text,
      'Spell focus across compared characters (' + parts.join(', ') + '); click for details');
    badge.dataset.lcView = 'focus';
    return badge;
  }

  // Aggregate weapon-proc badge across every compared character.
  function buildMultiProcBadge(multi) {
    let hasRows = false;
    let allSame = true;
    const parts = [];
    for (const result of multi.results) {
      const rows = resultEffectRows(result, 'proc');
      if (!rows.length) continue;
      hasRows = true;
      const changed = rows.some((effectRow) => effectRow.status !== 'same');
      allSame = allSame && !changed;
      const { positive, negative, unknown } = procPositiveNegative(rows);
      parts.push(((result.profile && result.profile.name) || 'Unnamed') + ': ' +
        (!changed ? 'proc eq' : procStateText(positive, negative, unknown)));
    }
    if (!hasRows) return null;
    let positive = false;
    let negative = false;
    let unknown = false;
    for (const result of multi.results) {
      const { positive: up, negative: down, unknown: unk } = procPositiveNegative(resultEffectRows(result, 'proc'));
      positive = positive || up;
      negative = negative || down;
      unknown = unknown || unk;
    }
    const state = !unknown && positive !== negative ? (positive ? 'upgrade' : 'downgrade') : 'sidegrade';
    const text = allSame ? 'proc eq' : procStateText(positive, negative, unknown);
    const badge = buildBadge(state, text, allSame
      ? 'Weapon proc damage is equal for every compared character; click for proc-only details'
      : 'Weapon proc across compared characters (' + parts.join(', ') + '); click for proc-only details');
    badge.dataset.lcView = 'proc';
    return badge;
  }

  // Collapsed layout: the best character's badges stand alone so the page
  // stays uncluttered, with the number of compared characters appended to the
  // main badge, every character listed in its tooltip, and focus/proc
  // aggregated across all characters.
  function buildMultiComparisonBadges(multi, cand, formula, compact) {
    const best = multi && multi.best;
    if (!best) return [];
    const badges = [];
    for (const [index, row] of best.comparison.rows.entries()) {
      if (cand.isAugment && index) break;
      if (!row.diff || !row.diff.comparable) continue;
      badges.push(buildComparisonBadge(row, formula, compact));
    }
    const focusBadge = buildMultiFocusBadge(multi);
    if (focusBadge) badges.push(focusBadge);
    const procBadge = buildMultiProcBadge(multi);
    if (procBadge) badges.push(procBadge);
    if (multi.results.length > 1 && badges.length) {
      const main = badges[0];
      main.textContent += ' · ' + multi.results.length;
      main.title = 'Best of ' + multi.results.length + ' characters: ' +
        multiComparisonSummary(multi) + ' -- click for full diff';
    }
    return badges;
  }

  // Expanded layout: every compared character gets its own labeled badges
  // directly in the row. Each badge carries its character id (lcProfile) and
  // row index (lcRow) so the click handler can open that character's diff.
  function buildPerCharacterBadges(multi, cand, formula, compact) {
    const badges = [];
    for (const result of multi.results) {
      const name = (result.profile && result.profile.name) || 'Unnamed';
      const profileId = String((result.profile && result.profile.id) || '');
      if (result.empty) {
        const badge = buildBadge('empty', name + ' empty',
          name + ': no worn item in slot ' + (cand.slotKey ? cand.slotKey.key : '?') + '. Score is the raw item value.');
        badge.dataset.lcView = 'stats';
        badge.dataset.lcProfile = profileId;
        badge.dataset.lcRow = '0';
        badges.push(badge);
        continue;
      }
      if (!result.summary.comparable) {
        const badge = buildBadge('nomatch', name + ' ?',
          name + ': item stats are unresolved; no comparison is available');
        badge.dataset.lcView = 'stats';
        badge.dataset.lcProfile = profileId;
        badge.dataset.lcRow = '0';
        badges.push(badge);
        continue;
      }
      for (const [index, row] of result.comparison.rows.entries()) {
        if (cand.isAugment && index) break;
        if (!row.diff || (!row.diff.comparable && !row.diff.effectsComparable)) continue;
        for (const badge of buildComparisonBadges(row, formula, compact)) {
          if (badge.dataset.lcView === 'stats') badge.textContent = name + ' ' + badge.textContent;
          badge.title = name + ': ' + badge.title;
          badge.dataset.lcProfile = profileId;
          badge.dataset.lcRow = String(index);
          badges.push(badge);
        }
      }
    }
    return badges;
  }

  // Expandable panel for a multi-character comparison: a compact chip row
  // switches between characters above the regular per-character panels.
  function buildMultiComparePanel(multi, cand, formula, view = 'stats') {
    const wrapper = document.createElement('div');
    wrapper.className = 'lc-compare-panel lc-multi-compare-panel';
    wrapper.dataset.lcView = view;
    wrapper.dataset.lcRow = 'multi';
    const chips = document.createElement('div');
    chips.className = 'lc-compare-chips';
    const body = document.createElement('div');
    const render = (result) => {
      for (const chip of chips.children) {
        chip.classList.toggle('lc-active', chip.dataset.lcProfileId === result.profile.id);
      }
      const panels = [];
      for (const [index, row] of result.comparison.rows.entries()) {
        if (cand.isAugment && index) break;
        if (!row.diff || (!row.diff.comparable && !row.diff.effectsComparable)) continue;
        panels.push(buildComparePanel(cand, row.target, row.diff, row.slotKey && row.slotKey.key,
          row.isAugment ? result.comparison.rows : null, index, view));
      }
      if (!panels.length) {
        const empty = document.createElement('div');
        empty.className = 'lc-wishlist-message';
        empty.textContent = 'No comparable comparison for this character.';
        panels.push(empty);
      }
      body.replaceChildren(...panels);
    };
    for (const result of multi.results) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lc-compare-chip';
      chip.dataset.lcProfileId = (result.profile && result.profile.id) || '';
      chip.dataset.state = result.empty ? 'empty'
        : result.summary.score > 0 ? 'upgrade' : result.summary.score < 0 ? 'downgrade' : 'sidegrade';
      chip.textContent = (((result.profile && result.profile.name) || 'Unnamed') + ' ' + fmtDelta(result.summary.score)).trim();
      chip.title = multiResultSummary(result);
      chip.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        render(result);
      });
      chips.appendChild(chip);
    }
    wrapper.appendChild(chips);
    wrapper.appendChild(body);
    render(multi.best || multi.results[0]);
    return wrapper;
  }

  // ---------- Stat indicators ----------
  const NON_STAT_LABELS = new Set(['Slot', 'Class', 'Race', 'Type', 'Deity', 'Skill', 'Effect', 'Focus', 'Click']);

  function addStatIndicators(container, cand, profile, formula) {
    container.querySelectorAll('.lc-stat-indicator').forEach((el) => el.remove());
    if (!profile || !cand || !cand.slotKey) return;
    const comparison = LC.diff.compareCandidate(profile, cand, formula);
    const row = comparison.rows.find((item) => item.diff && item.diff.comparable);
    if (!comparison.eligible || !row) return;
    const worn = row.target;
    const diff = row.diff;
    const lines = container.querySelectorAll('.lc-stat-line');
    for (const line of lines) {
      const lbl = line.querySelector(':scope > label');
      if (!lbl) continue;
      const key = lbl.textContent.replace(/:\s*$/, '').trim();
      if (!key || NON_STAT_LABELS.has(key)) continue;
      const cs = cand.stats && cand.stats[key];
      const ws = worn.stats && worn.stats[key];
      if (!cs && !ws) continue;
      const cv = cs && cs.num;
      const wv = ws && ws.num;
      if (cv == null && wv == null) continue;
      const delta = (cv || 0) - (wv || 0);
      const positive = LC.diff.POSITIVE_STATS.has(key);
      const ind = document.createElement('span');
      ind.className = 'lc-stat-indicator';
      if (delta === 0) {
        ind.dataset.dir = 'zero';
        ind.textContent = '=';
        ind.title = 'Same as ' + (worn.name || 'worn');
      } else {
        const isUp = (delta > 0) === positive;
        ind.dataset.dir = isUp ? 'up' : 'down';
        const sign = delta > 0 ? '+' : '';
        ind.textContent = sign + fmtStat(delta);
        ind.title = 'Worn (' + (worn.name || 'item') + '): ' + fmtStat(wv == null ? 0 : wv);
      }
      line.appendChild(ind);
    }
  }

  // ---------- Statify (raidloot detail rewrap) ----------
  function statifyItemDetail(detail) {
    if (detail.classList.contains('lc-statified')) return;
    detail.classList.add('lc-statified');
    detail.querySelectorAll('span.more').forEach((span) => {
      const p = span.parentNode;
      if (!p) return;
      while (span.firstChild) p.insertBefore(span.firstChild, span);
      span.remove();
    });
    const labels = Array.from(detail.querySelectorAll('label'));
    for (const lbl of labels) {
      if (lbl.closest('.lc-stat-line')) continue;
      const parent = lbl.parentNode;
      if (!parent) continue;
      const nodes = [];
      let cur = lbl;
      while (cur) {
        if (cur.nodeType === 1) {
          if (nodes.length && cur.tagName === 'LABEL') break;
          if (cur.classList && (cur.classList.contains('itemflag') || cur.classList.contains('note'))) break;
        }
        const next = cur.nextSibling;
        nodes.push(cur);
        cur = next;
      }
      if (!nodes.length) continue;
      const line = document.createElement('div');
      line.className = 'lc-stat-line';
      parent.insertBefore(line, nodes[0]);
      for (const n of nodes) line.appendChild(n);
    }
  }

  LC.ui = {
    store,
    injectCSS,
    fmtStat,
    fmtDelta,
    buildBadge,
    buildComparePanel,
    buildWishlistToggle,
    buildWishlistCompareButton,
    buildWishlistComparePanel,
    comparisonBadgeText,
    comparisonBadgeTitle,
    buildComparisonBadge,
    buildComparisonBadges,
    buildMultiComparisonBadges,
    buildPerCharacterBadges,
    buildMultiComparePanel,
    multiComparisonSummary,
    addStatIndicators,
    statifyItemDetail,
  };
})();
