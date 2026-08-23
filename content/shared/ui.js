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
    '.lc-compare-panel{background:#151d1e;color:#e9e1ca;border:1px solid #8b7547;border-radius:4px;padding:8px 10px;margin:6px 0;font:11px/1.35 monospace;max-width:720px;box-shadow:0 3px 12px rgba(0,0,0,.25);}',
    '.lc-compare-panel table{border-collapse:collapse;width:100%;background:#202a2b !important;color:#dbe3dc !important;}',
    '.lc-compare-panel tr{background:#202a2b !important;}',
    '.lc-compare-panel th,.lc-compare-panel td{padding:2px 8px 2px 0;text-align:right;background:#202a2b !important;color:#dbe3dc !important;border-bottom:1px solid #46524f !important;}',
    '.lc-compare-panel th:first-child,.lc-compare-panel td:first-child{text-align:left;}',
    '.lc-compare-panel th{color:#c6a45e !important;font-weight:bold;}',
    '.lc-compare-panel td:first-child{color:#b9c4bc !important;}',
    '.lc-compare-panel .lc-pos{color:#84d7a2 !important;}',
    '.lc-compare-panel .lc-neg{color:#f28b79 !important;}',
    '.lc-compare-panel .lc-zero{color:#aaaeb0 !important;}',
    '.lc-compare-panel .lc-head{color:#e0b96b !important;font-weight:bold;}',
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
  function buildComparePanel(cand, worn, diff, slotLabel) {
    const div = document.createElement('div');
    div.className = 'lc-compare-panel';
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
    for (const label of ['stat', 'worn', 'candidate', 'delta']) {
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
    const scoreCls = diff.score > 0 ? 'lc-pos' : (diff.score < 0 ? 'lc-neg' : 'lc-zero');
    const fLabel = (diff.formula && diff.formula.label) || 'score';
    const ratio = diff.weaponRatioDelta == null ? '' : '; Weapon ratio delta: ' + fmtDelta(diff.weaponRatioDelta);
    head.appendChild(document.createTextNode(
      (slotLabel ? slotLabel + ': ' : '') + (worn.name || ('#' + worn.id)) + ' -> ' + (cand.name || ('#' + cand.id)) + ' '
    ));
    const score = document.createElement('span');
    score.className = scoreCls;
    score.textContent = '(' + fLabel + ' delta: ' + fmtDelta(diff.score) + ratio + ')';
    head.appendChild(score);
    div.appendChild(head);
    div.appendChild(table);
    return div;
  }

  function slotShort(slotKey) {
    return { primary: 'P', secondary: 'S', range: 'R' }[slotKey && slotKey.key] || '';
  }

  function comparisonBadgeText(row, formula, compact) {
    const diff = row.diff;
    const arrow = diff.score > 0 ? 'up' : diff.score < 0 ? 'dn' : 'eq';
    const slot = slotShort(row.slotKey);
    if (compact) {
      return [slot, arrow, fmtDelta(diff.score), diff.weaponRatioDelta == null ? formula.label : 'r ' + fmtDelta(diff.weaponRatioDelta)]
        .filter(Boolean).join(' ');
    }
    return arrow + ' ' + fmtDelta(diff.score) + ' ' + formula.label +
      (diff.weaponRatioDelta == null ? '' : ' · ratio ' + fmtDelta(diff.weaponRatioDelta));
  }

  function comparisonBadgeTitle(row, formula) {
    const slot = row.slotKey && row.slotKey.key;
    const ratio = row.diff.weaponRatioDelta == null ? '' : '; weapon ratio delta ' + fmtDelta(row.diff.weaponRatioDelta);
    return (slot ? slot + ': ' : '') + 'vs ' + (row.target && (row.target.name || ('#' + row.target.id)) || 'worn item') +
      ' (' + formula.label + ' delta ' + fmtDelta(row.diff.score) + ratio + ') -- click for full diff';
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
    comparisonBadgeText,
    comparisonBadgeTitle,
    addStatIndicators,
    statifyItemDetail,
  };
})();
