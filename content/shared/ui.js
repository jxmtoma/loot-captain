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
    '.lc-projection{margin-top:12px;padding-top:10px;border-top:1px solid #657382;white-space:normal;text-align:left;}',
    '.lc-projection > summary{cursor:pointer;color:#ecd38b;font-weight:bold;}',
    '.lc-projection a{color:#ecd38b !important;text-decoration:underline;}',
    '.lc-projection [hidden]{display:none !important;}',
    '.lc-projection p,.lc-projection label{display:block;margin:8px 0;white-space:normal;}',
    '.lc-projection input[type="checkbox"]{width:auto;margin-right:8px;}',
    '.lc-badge{display:inline-block;padding:2px 6px;margin:0 4px;border:1px solid #64717e;border-radius:3px;background:#16212b;color:#c7cdd4;font:10px/1.2 sans-serif;font-weight:bold;cursor:pointer;vertical-align:middle;user-select:none;box-shadow:none;appearance:none;text-align:center;text-shadow:none;}',
    '.lc-badge[data-state="upgrade"]{background:#16212b;color:#86d99a;}',
    '.lc-badge[data-state="downgrade"]{background:#16212b;color:#ffaaa0;}',
    '.lc-badge[data-state="sidegrade"]{background:#16212b;color:#f3d775;}',
    '.lc-badge[data-state="empty"]{background:#16212b;color:#90c8f4;}',
    '.lc-badge[data-state="nomatch"]{background:#16212b;color:#c7cdd4;}',
    '.lc-wishlist-toggle,.lc-wishlist-compare{display:inline-block;padding:2px 6px;margin:0 4px;border:1px solid #64717e;border-radius:3px;background:#16212b;color:#c7cdd4;font:10px/1.2 Tahoma,sans-serif;font-weight:bold;cursor:pointer;vertical-align:middle;user-select:none;box-shadow:none;}',
    '.lc-wishlist-toggle{display:inline-block !important;width:auto !important;min-width:0 !important;max-width:none !important;height:auto !important;min-height:0 !important;padding:0 !important;margin:0 4px !important;border:0 !important;border-radius:0 !important;background:transparent !important;color:#b7974f !important;box-shadow:none !important;text-shadow:none !important;font:16px/1 sans-serif !important;appearance:none !important;}',
    '.lc-wishlist-toggle[aria-pressed="true"]{background:transparent !important;color:#e0b95f !important;border:0 !important;}',
    '.lc-wishlist-toggle:focus-visible{outline:1px solid #e0b95f !important;outline-offset:2px;}',
    '.lc-wishlist-compare[data-state="upgrade"]{background:#16212b;color:#86d99a;border-color:#64717e;}',
    '.lc-wishlist-compare[data-state="downgrade"]{background:#16212b;color:#ffaaa0;border-color:#64717e;}',
    '.lc-wishlist-compare[data-state="sidegrade"]{background:#16212b;color:#f3d775;border-color:#64717e;}',
    '.lc-wishlist-compare[data-state="nomatch"]{background:#16212b;color:#c7cdd4;border-color:#64717e;}',
    '.lc-wishlist-toggle:disabled{cursor:wait;opacity:.65;}',
    '.lc-wanted:not(tr){outline:2px solid rgba(224,188,104,.8) !important;outline-offset:1px;background-color:rgba(132,101,35,.12) !important;}',
    'tr.lc-wanted > td{background-image:linear-gradient(rgba(132,101,35,.22),rgba(132,101,35,.22)) !important;}',
    // The auction tab's nav link paints its own theme background over ours.
    '.p-tabview-nav-link.lc-wanted{background-image:linear-gradient(rgba(132,101,35,.3),rgba(132,101,35,.3)) !important;}',
    '.lc-wishlist-compare-panel > .lc-compare-panel{margin:6px 0 0;box-shadow:none;}',
    '.lc-multi-compare-panel > .lc-compare-panel{margin:6px 0 0;box-shadow:none;}',
    '.lc-compare-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px;}',
    '.lc-compare-chip{padding:1px 6px;border:1px solid #64717e;border-radius:3px;background:#16212b;color:#c7cdd4;font:10px/1.5 monospace;cursor:pointer;user-select:none;}',
    '.lc-compare-chip[data-state="upgrade"]{background:#16212b;color:#86d99a;}',
    '.lc-compare-chip[data-state="downgrade"]{background:#16212b;color:#ffaaa0;}',
    '.lc-compare-chip[data-state="sidegrade"]{background:#16212b;color:#f3d775;}',
    '.lc-compare-chip[data-state="nomatch"]{background:#16212b;color:#c7cdd4;border-color:#64717e;}',
    '.lc-compare-chip[data-state="empty"]{background:#16212b;color:#90c8f4;}',
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
    '.lc-compare-nav button:disabled{cursor:wait;opacity:.65;}',
    '.lc-compare-nav button.lc-equipped:disabled{cursor:default;}',
    '.lc-compare-nav button{white-space:nowrap;}',
    '.lc-equip{flex:0 1 auto;min-width:0;margin-left:auto;}',
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
    '.lc-statified .itemname{display:block;}',
    '.lc-stat-line{display:block;line-height:1.45;margin:1px 0;}',
    '.lc-stat-line > label{display:inline-block;min-width:96px;opacity:.85;}',
    '.lc-badge{border-radius:2px;font-family:Tahoma,sans-serif;text-shadow:none;box-shadow:none;}',
    '.lc-badge[data-state="upgrade"]{background:#16212b;color:#86d99a;border-color:#64717e;}',
    '.lc-badge[data-state="downgrade"]{background:#16212b;color:#ffaaa0;border-color:#64717e;}',
    '.lc-badge[data-state="sidegrade"]{background:#16212b;color:#f3d775;border-color:#64717e;}',
    '.lc-badge[data-state="nomatch"]{background:#16212b;color:#c7cdd4;border-color:#64717e;}',
    '.lc-badge[data-state="empty"]{background:#16212b;color:#90c8f4;border-color:#64717e;}',
    '.lc-compare-panel{background:linear-gradient(145deg,#15253a,#0a1422);border-color:#a38348;border-radius:2px;padding:10px 12px;box-shadow:inset 0 1px rgba(255,255,255,.1),inset 0 0 0 1px rgba(0,0,0,.35),0 5px 14px rgba(0,0,0,.4);font-family:Tahoma,monospace;}',
    '.lc-compare-panel table,.lc-compare-panel tr,.lc-compare-panel th,.lc-compare-panel td{background:#101d2e !important;}',
    '.lc-compare-panel tr:nth-child(even) td{background:#14243a !important;}',
    '.lc-compare-panel th{color:#e6c26d !important;text-transform:uppercase;letter-spacing:.06em;}',
    '.lc-compare-panel td:first-child{color:#c3ceda !important;font-weight:bold;}',
    '.lc-compare-panel .lc-head{color:#f0d18a !important;text-shadow:1px 1px #07101b;}',
    '.lc-effect-details{margin-top:6px;color:#dbe3dc;}',
    '.lc-effect-details summary{cursor:pointer;color:#c6a45e;font-weight:bold;}',
    '.lc-score-breakdown{margin-top:6px;color:#dbe3dc;}',
    '.lc-score-breakdown summary{cursor:pointer;color:#c6a45e;font-weight:bold;}',
    '.lc-dps-metric[data-state="upgrade"],.lc-dps-overview[data-state="upgrade"]{color:#86d99a !important;}',
    '.lc-dps-metric[data-state="downgrade"],.lc-dps-overview[data-state="downgrade"]{color:#ffaaa0 !important;}',
    '.lc-dps-metric[data-state="sidegrade"],.lc-dps-overview[data-state="sidegrade"]{color:#f3d775 !important;}',
    '.lc-dps-metric[data-state="nomatch"],.lc-dps-overview[data-state="nomatch"]{color:#c7cdd4 !important;}',
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
    if (d == null) return '—';
    const sign = d > 0 ? '+' : '';
    return sign + (Number.isInteger(d) ? d.toLocaleString() : d.toFixed(2));
  }

  // Reference DPS is deliberately a small, per-profile cache. The profile and
  // item objects are replaced when storage changes, so WeakMap identity also
  // gives us the invalidation we need after a saved scenario/equipment edit.
  const dpsReferenceCache = new WeakMap();

  function resolvedProfileFormula(profile, formula) {
    return LC.diff && LC.diff.resolveFormula
      ? LC.diff.resolveFormula(profile, formula)
      : formula;
  }

  function dpsProfileRole(profile, formula) {
    const key = resolvedProfileFormula(profile, formula)?.key;
    return key === 'role-melee' || key === 'role-caster' ? key : '';
  }

  function dpsEligibility(cand, worn, profile, formula) {
    const selectedRole = dpsProfileRole(profile, formula);
    const supportedProfile = profile && ['beastlord', 'bst', 'wizard', 'wiz', 'magician', 'mag', 'enchanter', 'enc', 'necromancer', 'nec', 'berserker', 'ber', 'monk', 'mnk', 'rogue', 'rog'].includes(String(profile.cls || '').trim().toLowerCase()) && Number(profile.level) === 100;
    if (!supportedProfile) return { role: selectedRole, supported: false, kind: 'unsupported', reason: 'Player DPS estimate supports only cataloged level-100 class models.' };
    return { role: selectedRole || 'player-dps', supported: true, reason: '' };
  }

  function cachedDpsReference(cand, profile, worn) {
    if (!LC.state || typeof LC.state.getCharacterProjection !== 'function' || !cand || !profile || !worn) {
      return Promise.resolve(null);
    }
    let byCandidate = dpsReferenceCache.get(profile);
    if (!byCandidate) { byCandidate = new WeakMap(); dpsReferenceCache.set(profile, byCandidate); }
    let byWorn = byCandidate.get(cand);
    if (!byWorn) { byWorn = new WeakMap(); byCandidate.set(cand, byWorn); }
    let request = byWorn.get(worn);
    if (!request) {
      request = Promise.resolve(LC.state.getCharacterProjection(cand, profile, worn, false, 'dps-reference'))
        .catch(() => null);
      byWorn.set(worn, request);
    }
    return request;
  }

  function dpsOutput(projection) {
    const outputs = projection && Array.isArray(projection.outputs) ? projection.outputs : [];
    const order = ['Player DPS', 'Melee + procs DPS', 'Melee DPS', 'Melee stats DPS', 'Spell DPS', 'Spell stats DPS', 'Weapon melee DPS'];
    return order.map((metric) => outputs.find((output) => output && output.available && output.metric === metric)).find(Boolean) || null;
  }

  function dpsMetricDescriptor(output) {
    if (!output) return { label: 'Melee DPS est.', partial: false, scope: 'Reference DPS estimate is unavailable.' };
    const partial = output.metric === 'Melee stats DPS' || output.partial === true;
    if (output.metric === 'Player DPS') {
      const included = Array.isArray(output.includedComponents) ? output.includedComponents.join(', ') : '';
      const excluded = Array.isArray(output.excludedComponents) ? output.excludedComponents.join(', ') : '';
      return { label: 'DPS est.', partial, scope: (included ? 'Includes ' + included + '.' : 'Includes the best known player-damage components.') +
        (excluded ? ' Excludes ' + excluded + '.' : '') };
    }
    if (output.metric === 'Spell stats DPS') return { label: 'Spell stats est.', partial: true, scope: 'Unfocused spell reference; focus modifiers excluded.' };
    if (output.metric === 'Spell DPS') return { label: 'Spell DPS est.', partial, scope: 'Includes the shared spell rotation and known spell stats/focus; melee and pets remain excluded.' };
    if (output.metric === 'Melee + procs DPS') return { label: 'Melee + procs DPS est.', partial, scope: 'Includes known melee stats, worn effects and cataloged weapon procs; spell focus and pets remain unmodeled.' };
    if (output.metric === 'Melee stats DPS') return { label: 'Melee stats est.', partial: true, scope: 'Includes known melee stats only; worn effects and weapon procs remain unresolved; spell focus and pets remain unmodeled.' };
    return { label: 'Melee DPS est.', partial, scope: 'Includes known melee stats and worn effects; weapon procs may remain unresolved; spell focus and pets remain unmodeled.' };
  }

  function dpsState(delta) {
    return Number.isFinite(delta) ? (delta > 0 ? 'upgrade' : delta < 0 ? 'downgrade' : 'sidegrade') : 'nomatch';
  }

  function dpsMetricLabel(projection, eligibility) {
    const output = dpsOutput(projection);
    if (output) {
      const descriptor = dpsMetricDescriptor(output);
      return { text: ' · ' + descriptor.label + ' ' + fmtDelta(output.delta) + (descriptor.partial ? ' (partial)' : ''), state: dpsState(output.delta) };
    }
    return { text: ' · ' + (eligibility && eligibility.kind === 'unsupported' ? 'DPS not modeled' : 'DPS unavailable'), state: 'nomatch' };
  }

  function setDpsMetric(metric, projection, eligibility) {
    const value = dpsMetricLabel(projection, eligibility);
    metric.dataset.state = value.state;
    metric.textContent = value.text;
  }

  function prependBadgeText(badge, text) {
    const metric = badge.__lcDpsMetric;
    if (metric && typeof badge.insertBefore === 'function') {
      // The test DOM stores the original text separately; real DOM nodes do not.
      if (Object.prototype.hasOwnProperty.call(badge, '_text')) badge._text = text + badge._text;
      else badge.insertBefore(document.createTextNode(text), badge.firstChild || metric);
    } else {
      badge.textContent = text + badge.textContent;
    }
  }

  function dpsMetricReason(projection, fallback) {
    const output = projection && Array.isArray(projection.outputs)
      ? projection.outputs.find((entry) => entry && /dps/i.test(String(entry.metric || '')))
      : null;
    return (output && output.reason) || (projection && projection.reason) || fallback || 'Reference DPS scenario is unavailable.';
  }

  function appendDpsMetric(badge, cand, worn, profile, formula) {
    const eligibility = dpsEligibility(cand, worn, profile, formula);
    if (!profile || !eligibility.role) return;
    const metric = document.createElement('span');
    metric.className = 'lc-dps-metric';
    badge.appendChild(metric);
    badge.__lcDpsMetric = metric;
    const apply = (projection, asynchronous = false) => {
      if (asynchronous && !badge.isConnected) return;
      setDpsMetric(metric, eligibility.supported ? projection : null, eligibility);
      const currentTitle = badge.title || '';
      const scenarioBasis = projection
        ? projection.scenarioDefault ? 'Illustrative default reference scenario.' : 'Saved character reference scenario.' : '';
      const selectedOutput = dpsOutput(projection);
      const reason = eligibility.supported && selectedOutput
        ? (scenarioBasis ? scenarioBasis + ' ' : '') + dpsMetricDescriptor(selectedOutput).scope
        : eligibility.supported ? (scenarioBasis ? scenarioBasis + ' ' : '') + dpsMetricReason(projection, 'Reference melee DPS is unavailable.') : eligibility.reason;
      badge.title = currentTitle + '; ' + reason;
      badge.setAttribute('aria-label', badge.title);
    };
    if (!eligibility.supported) { apply(null); return; }
    metric.dataset.state = 'nomatch';
    metric.textContent = ' · DPS est. loading…';
    badge.dataset.lcDps = 'pending';
    cachedDpsReference(cand, profile, worn).then((response) => {
      if (!response || !response.ok || !response.projection) apply(null, true);
      else apply(response.projection, true);
      delete badge.dataset.lcDps;
    });
  }

  function invalidateDpsReference(profile) {
    if (profile) dpsReferenceCache.delete(profile);
  }

  // ---------- Badge ----------
  function buildBadge(state, text, title) {
    const badge = document.createElement('span');
    badge.className = 'lc-badge';
    badge.dataset.state = state;
    badge.textContent = text;
    if (title) { badge.title = title; badge.setAttribute('aria-label', title); }
    return badge;
  }

  function buildCompareButton(state, text, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lc-badge';
    button.dataset.state = state;
    button.textContent = text;
    if (title) { button.title = title; button.setAttribute('aria-label', title); }
    return button;
  }

  function formulaSignature(formula) {
    return formula && formula.key != null ? String(formula.key) + ':' + String(formula.version || '') : '';
  }

  function comparisonVerdict(diff, formula) {
    const resolved = diff && diff.formula || formula;
    if (!diff || diff.numericScoreAvailable !== true || !Number.isFinite(diff.score) ||
        !resolved || resolved.recommendation === false || resolved.warning) {
      const explanation = resolved && resolved.recommendation === false
        ? 'No recommendation is available for this comparison'
        : resolved && resolved.warning
          ? 'Comparison unavailable; formula is unsupported'
          : 'Comparison score is unavailable';
      return { state: 'nomatch', explanation };
    }
    if (diff.score > 0) return { state: 'upgrade', explanation: 'Higher stat preference score; not a DPS estimate' };
    if (diff.score < 0) return { state: 'downgrade', explanation: 'Lower stat preference score; not a DPS estimate' };
    return { state: 'sidegrade', explanation: 'Equal stat preference score' };
  }

  function relevantRows(result) {
    return (result && result.comparison && result.comparison.rows || []).filter((row) =>
      row.diff && (row.diff.comparable || row.diff.hasData || row.diff.effectsComparable));
  }

  function resultVerdict(result, formula) {
    const resolved = LC.diff && LC.diff.resolveFormula
      ? LC.diff.resolveFormula(result && result.profile, formula)
      : formula;
    if (result && result.empty) return { state: 'empty', explanation: 'No worn item in this slot' };
    if (!result || !result.summary || !result.summary.numericScoreAvailable ||
        result.summary.recommendationAvailable === false || !Number.isFinite(result.summary.score) ||
        !resolved || resolved.recommendation === false || resolved.warning) {
      return { state: 'nomatch', explanation: comparisonVerdict(null, resolved).explanation };
    }
    const states = relevantRows(result).map((row) => comparisonVerdict(row.diff, resolved).state);
    if (!states.length || states.some((state) => state === 'nomatch' || state === 'empty') || new Set(states).size > 1) {
      return { state: 'nomatch', explanation: 'Comparison unavailable; mixed comparisons; open each character' };
    }
    const summaryState = result.summary.score > 0 ? 'upgrade' : result.summary.score < 0 ? 'downgrade' : 'sidegrade';
    if (summaryState !== states[0]) return { state: 'nomatch', explanation: 'Comparison unavailable; mixed comparisons; open each character' };
    return comparisonVerdict({ numericScoreAvailable: true, score: result.summary.score, formula: resolved }, resolved);
  }

  function multiVerdict(multi, formula) {
    if (!multi || !multi.results || !multi.results.length) return comparisonVerdict(null, formula);
    if (multi.mixedFormulas) return { state: 'nomatch', explanation: 'Comparison unavailable; character scores use different formulas; open each character' };
    const results = multi.results.map((result) => resultVerdict(result, formula));
    const states = results.map((result) => result.state);
    if (states.includes('nomatch') || new Set(states).size > 1) {
      return { state: 'nomatch', explanation: 'Comparison unavailable; mixed comparisons; open each character' };
    }
    return results[0];
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

  function buildOtherEffects(group) {
    if (!group || !group.rows.length) return null;
    const details = document.createElement('details');
    details.className = 'lc-effect-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Worn, click and additional effects (informational; not scored)';
    details.appendChild(summary);
    if (!group.complete) {
      const note = document.createElement('p');
      note.textContent = 'Effect lists may be incomplete; unresolved does not mean added or removed.';
      details.appendChild(note);
    }
    const table = document.createElement('table');
    const header = document.createElement('tr');
    for (const label of ['type', 'change', 'current', 'candidate']) {
      const cell = document.createElement('th'); cell.textContent = label; header.appendChild(cell);
    }
    table.appendChild(header);
    for (const entry of group.rows) {
      const row = document.createElement('tr');
      for (const value of [entry.type, entry.status, entry.current, entry.candidate]) {
        const cell = document.createElement('td');
        cell.textContent = value && typeof value === 'object' ?
          (value.raw || value.name) + (value.rank ? ' [rank ' + value.rank + ']' : '') : value || (['added', 'removed'].includes(entry.status) ? 'None' : 'Unknown');
        if (value && typeof value === 'object') cell.title = 'Source: ' + (value.provenance || 'legacy');
        row.appendChild(cell);
      }
      table.appendChild(row);
    }
    details.appendChild(table);
    return details;
  }

  function buildOtherBadge(rows) {
    if (!rows.length) return null;
    const title = 'Compare item stats and effects; comparison score is unavailable';
    const badge = buildCompareButton('nomatch', 'Compare', title);
    badge.dataset.lcView = 'stats';
    return badge;
  }

  function buildScoreBreakdown(diff) {
    if (!diff || !diff.formula) return null;
    const details = document.createElement('details');
    details.className = 'lc-score-breakdown';
    const summary = document.createElement('summary');
    summary.textContent = 'Preference score (not DPS)';
    details.appendChild(summary);
    const formula = document.createElement('p');
    formula.textContent = 'Formula: ' + (diff.formula.label || diff.formula.key || 'unknown') +
      ' (' + String(diff.formula.key || '?') + ' v' + String(diff.formula.version || '?') + ')';
    details.appendChild(formula);
    if (diff.formula.warning) {
      const warning = document.createElement('p');
      warning.textContent = diff.formula.warning;
      details.appendChild(warning);
    }
    if (diff.scoreReason === 'raw') {
      const note = document.createElement('p');
      note.textContent = 'General / raw comparison; no aggregate score.';
      details.appendChild(note);
      return details;
    }
    const table = document.createElement('table');
    const header = document.createElement('tr');
    for (const label of ['term', 'delta', 'weight', 'contribution']) {
      const cell = document.createElement('th'); cell.textContent = label; header.appendChild(cell);
    }
    table.appendChild(header);
    for (const entry of diff.breakdown || []) {
      const row = document.createElement('tr');
      for (const value of [entry.key, fmtDelta(entry.delta), fmtStat(entry.weight), fmtDelta(entry.contribution)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      }
      table.appendChild(row);
    }
    details.appendChild(table);
    const total = document.createElement('p');
    total.textContent = diff.numericScoreAvailable
      ? 'Total: ' + fmtDelta(diff.score)
      : 'Total unavailable' + (diff.missingScoreStats.length ? ': missing ' + diff.missingScoreStats.join(', ') : '');
    details.appendChild(total);
    return details;
  }

  function buildStatsOverview(cand, worn, diff, profile = null, formula = null) {
    const overview = document.createElement('div');
    overview.className = 'lc-compare-overview';
    const stats = document.createElement('p');
    stats.textContent = diff && diff.scoreReason === 'raw' ? 'Compare'
      : diff && diff.formula && diff.formula.recommendation === false
        ? 'Legacy' + (diff.numericScoreAvailable === true && Number.isFinite(diff.score) ? ' ' + fmtDelta(diff.score) : '')
        : diff && diff.numericScoreAvailable === true && Number.isFinite(diff.score) ? 'Stats ' + fmtDelta(diff.score) : 'Stats ?';
    stats.title = 'Stat preference score; this number is separate from DPS.';
    overview.appendChild(stats);
    if (!diff || diff.numericScoreAvailable !== true) {
      const caveat = document.createElement('p');
      caveat.textContent = 'Stat score unavailable; see All item stats.';
      overview.appendChild(caveat);
    }
    const eligibility = dpsEligibility(cand, worn, profile, formula);
    if (profile && eligibility.role) {
      const dps = document.createElement('p');
      dps.className = 'lc-dps-overview';
      dps.dataset.state = 'nomatch';
      dps.textContent = eligibility.supported ? 'DPS est. loading…' :
        (eligibility.kind === 'unsupported' ? 'DPS not modeled' : 'DPS unavailable');
      dps.title = eligibility.supported ? 'DPS contribution estimate is loading.' : eligibility.reason;
      overview.appendChild(dps);
      if (eligibility.supported) {
        cachedDpsReference(cand, profile, worn).then((response) => {
          if (!dps.isConnected) return;
          if (!response || !response.ok || !response.projection) {
            dps.textContent = 'DPS unavailable';
            dps.dataset.state = 'nomatch';
            dps.title = dpsMetricReason(null, 'Reference DPS scenario is unavailable.');
            return;
          }
          const output = dpsOutput(response.projection);
          const descriptor = dpsMetricDescriptor(output);
          dps.textContent = output
            ? descriptor.label + ' ' + fmtStat(output.current) + ' → ' + fmtStat(output.candidate) + ' (Δ ' + fmtDelta(output.delta) + ')' + (descriptor.partial ? ' (partial)' : '')
            : 'DPS unavailable';
          dps.dataset.state = output ? dpsState(output.delta) : 'nomatch';
          dps.title = output ? descriptor.scope : dpsMetricReason(response.projection, 'Reference melee DPS is unavailable.');
        });
      }
    }
    return overview;
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

  // Equip / replace action for one comparison row. The worn item is addressed
  // by its index in profile.items, so the button only renders when that index
  // resolves. A worn item we cannot locate must never fall through to the
  // append path, which would add a duplicate instead of replacing.
  // True when the profile already holds this item, in any slot. Comparing an
  // item a character already wears must not offer to equip it again: the row's
  // target can be the other half of a paired slot, so equipping would add a
  // second copy rather than replace anything.
  function sameStoredItem(item, cand) {
    if (!item || !cand) return false;
    if (item.id && cand.id) return String(item.id) === String(cand.id);
    const key = (value) => String(value && value.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return !!key(item) && key(item) === key(cand);
  }

  function buildEquipAction(cand, worn, slotLabel, view, baselineLabel, profile) {
    if (!profile || view !== 'stats' || baselineLabel === 'wishlist') return null;
    if (LC.parser && !LC.parser.canWear(cand, profile)) return null;
    if (worn && (profile.items || []).indexOf(worn) < 0) return null;
    const candName = cand.name || ('#' + cand.id);
    const span = document.createElement('span');
    span.className = 'lc-compare-nav lc-equip';
    if ((profile.items || []).some((item) => sameStoredItem(item, cand))) {
      const equipped = document.createElement('button');
      equipped.type = 'button';
      equipped.className = 'lc-equipped';
      equipped.disabled = true;
      equipped.textContent = 'Equipped';
      equipped.title = candName + ' is already in ' + (profile.name || 'this character') + "'s profile";
      equipped.setAttribute('aria-label', equipped.title);
      span.appendChild(equipped);
      // Undo deliberately does not live here. On a page it would be permanent
      // furniture with no natural end, and it would silently retarget whenever
      // something else is equipped. It lives in the character editor instead.
      return span;
    }
    const label = worn
      ? 'Replace ' + (worn.name || ('#' + worn.id)) + ' with ' + candName
      : 'Equip ' + candName + ' in ' + (slotLabel || 'this slot');
    const start = document.createElement('button');
    start.type = 'button';
    start.textContent = 'Equip';
    start.title = label;
    start.setAttribute('aria-label', label);
    const showStart = () => span.replaceChildren(start);
    const showConfirm = () => {
      const confirm = document.createElement('button');
      confirm.type = 'button';
      // The panel head already reads "<slot>: <old> -> <new>", so the visible
      // text stays short; the full sentence rides on the label. A long label
      // here would squeeze the flex head into one word per line.
      confirm.textContent = worn ? 'Replace?' : 'Equip here?';
      confirm.title = label + '?';
      confirm.setAttribute('aria-label', label + '?');
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.setAttribute('aria-label', 'Cancel equipping ' + candName);
      cancel.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showStart();
      });
      confirm.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        confirm.disabled = true;
        cancel.disabled = true;
        const result = await LC.state.equipItem(cand, profile, worn, slotLabel);
        // On success the storage change re-runs annotations and removes this
        // panel; the label only shows when the write changed nothing.
        if (result && result.ok) {
          confirm.textContent = 'Equipped';
          return;
        }
        start.title = 'Could not equip this item';
        showStart();
      });
      span.replaceChildren(confirm, cancel);
    };
    start.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showConfirm();
    });
    span.appendChild(start);
    return span;
  }

  function buildDpsScenarioEditor(cand, profile, worn) {
    const details = document.createElement('details');
    details.className = 'lc-dps-scenario';
    const summary = document.createElement('summary');
    summary.textContent = 'DPS assumptions';
    details.appendChild(summary);
    const status = document.createElement('p');
    status.textContent = 'Open to load this character\'s shared reference scenario.';
    details.appendChild(status);
    const body = document.createElement('div');
    details.appendChild(body);
    const className = String(profile && profile.cls || '').trim().toLowerCase();
    const spellOnlyModel = { wizard: 'wizard-hoarfrost', wiz: 'wizard-hoarfrost', magician: 'magician-spear', mag: 'magician-spear', enchanter: 'enchanter-mindcleave', enc: 'enchanter-mindcleave', necromancer: 'necro-pyre', nec: 'necro-pyre' }[className] || '';
    const meleeOnlyModel = { berserker: 'berserker-base-melee', ber: 'berserker-base-melee', monk: 'monk-base-melee', mnk: 'monk-base-melee', rogue: 'rogue-base-melee', rog: 'rogue-base-melee' }[className] || '';
    const spellOnly = !!spellOnlyModel;
    const meleeOnly = !!meleeOnlyModel;
    const supportedProfile = profile && (spellOnly || meleeOnly || ['beastlord', 'bst'].includes(className)) && Number(profile.level) === 100;
    if (!supportedProfile) {
      status.textContent = 'Editable Player DPS assumptions support only cataloged level-100 class models.';
      return details;
    }
    const fieldLabels = {
      hitChance: 'Hit chance (0–1)', mitigationMultiplier: 'Mitigation remaining (0–1)',
      damageMultiplier: 'Base coefficient', damageBonus: 'Damage bonus/landed strike', attacksPerRound: 'Attacks/round',
    };
    const inputByKey = {};
    let revision = null;
    let loaded = false;
    let loading = false;
    let currentScenario = null;
    const combatKeys = ['baseStrength', 'baseDexterity', 'strengthCap', 'dexterityCap', 'offenseBase', 'attackScale', 'attackCap',
      'targetMitigation', 'criticalDifficulty', 'otherCriticalBonusPct', 'criticalDamageMultiplier', 'doubleAttackSkill',
      'grantedDoubleAttackPct', 'otherDoubleAttackBonusPct'];
    const procKeys = ['primaryPpm', 'secondaryPpm', 'landingMultiplier'];
    const number = (parent, key, label, value) => {
      const field = document.createElement('label'); field.textContent = label + ' ';
      const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = value == null ? '' : String(value);
      field.appendChild(input); parent.appendChild(field); inputByKey[key] = input; return input;
    };
    const select = (parent, key, label, value) => {
      const field = document.createElement('label'); field.textContent = label + ' ';
      const input = document.createElement('select');
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Select…'; input.appendChild(blank);
      for (const optionValue of ['dual-wield', 'two-hand', 'one-hand-shield']) {
        const option = document.createElement('option'); option.value = optionValue; option.textContent = optionValue;
        input.appendChild(option);
      }
      input.value = value == null ? '' : value; field.appendChild(input); parent.appendChild(field); inputByKey[key] = input; return input;
    };
    const render = (projection) => {
      const values = projection && projection.scenario;
      if (!values || typeof values !== 'object') { status.textContent = 'DPS assumptions are unavailable.'; return; }
      currentScenario = values;
      revision = projection && projection.scenarioRevision != null ? projection.scenarioRevision : values.revision;
      body.replaceChildren();
      const note = document.createElement('p');
      note.textContent = projection.scenarioDefault
        ? 'Illustrative reference defaults — not measured combat values. These shared inputs apply to every comparison for this character.'
        : 'Saved shared reference scenario — still an illustrative estimate, not measured combat values.';
      body.appendChild(note);
      if (!spellOnly) {
      select(body, 'layout', 'Layout', values.layout);
      number(body, 'hastePercent', 'Shared haste (%)', values.hastePercent);
      for (const hand of ['primary', 'secondary']) {
        const heading = document.createElement('p'); heading.textContent = hand[0].toUpperCase() + hand.slice(1) + ' hand'; body.appendChild(heading);
        for (const key of Object.keys(fieldLabels)) number(body, hand + '.' + key, fieldLabels[key], values[hand][key]);
      }
      if (values.version >= 2) {
        const combat = document.createElement('details'); combat.open = false;
        const combatSummary = document.createElement('summary'); combatSummary.textContent = 'Combat stats and caps'; combat.appendChild(combatSummary);
        const combatLabels = {
          baseStrength: ['Base strength', 'points'], baseDexterity: ['Base dexterity', 'points'],
          strengthCap: ['Strength cap', 'points'], dexterityCap: ['Dexterity cap', 'points'],
          offenseBase: ['Base offense', 'points'], attackScale: ['Attack scale', 'per point'], attackCap: ['Attack cap', 'points'],
          targetMitigation: ['Target mitigation', 'points'], criticalDifficulty: ['Critical difficulty', 'points'],
          otherCriticalBonusPct: ['Other critical bonus', '%'], criticalDamageMultiplier: ['Critical damage multiplier', '×'],
          doubleAttackSkill: ['Double attack skill', 'points'], grantedDoubleAttackPct: ['Granted double attack', '%'],
          otherDoubleAttackBonusPct: ['Other double attack bonus', '%'],
        };
        const combatValue = values.combat || {};
        for (const [key, [label, unit]] of Object.entries(combatLabels)) number(combat, 'combat.' + key, label + ' (' + unit + ')', combatValue[key]);
        body.appendChild(combat);
        const procs = document.createElement('details'); procs.open = false;
        const procSummary = document.createElement('summary'); procSummary.textContent = 'Weapon proc rates'; procs.appendChild(procSummary);
        const procValue = values.procs || {};
        for (const [key, label, unit] of [['primaryPpm', 'Primary proc rate', 'procs/min'], ['secondaryPpm', 'Secondary proc rate', 'procs/min'], ['landingMultiplier', 'Proc landing multiplier', '×']]) number(procs, 'procs.' + key, label + ' (' + unit + ')', procValue[key]);
        body.appendChild(procs);
      }
      }
      const upgradeDraft = projection && projection.upgradeScenario;
      if (upgradeDraft && typeof upgradeDraft === 'object' && Number(upgradeDraft.version) > Number(values.version)) {
        const upgrade = document.createElement('button'); upgrade.type = 'button'; upgrade.textContent = 'Enable gear stats and procs';
        if (values.version >= 2) upgrade.textContent = 'Enable spell rotation';
        upgrade.title = 'Drafts the latest DPS scenario, including spell rotation; save explicitly before it changes comparisons.';
        upgrade.addEventListener('click', (event) => {
          event.preventDefault(); event.stopPropagation();
          const next = JSON.parse(JSON.stringify(upgradeDraft));
          render({ ...projection, scenario: next, scenarioDefault: false });
          status.textContent = 'v' + next.version + ' draft ready. Save explicitly to apply the new DPS components.';
        });
        body.appendChild(upgrade);
      }
      if (values.version >= 3 && !meleeOnly) {
        const spells = document.createElement('details'); spells.open = false;
        const spellSummary = document.createElement('summary'); spellSummary.textContent = 'Spell rotation'; spells.appendChild(spellSummary);
        const spellValue = values.spells || {};
        const spellRank = document.createElement('label'); spellRank.textContent = 'Spell rank (1–3) ';
        const rankInput = document.createElement('select');
        for (const rank of [1, 2, 3]) { const option = document.createElement('option'); option.value = String(rank); option.textContent = 'Rank ' + rank; rankInput.appendChild(option); }
        rankInput.value = spellValue.rank == null ? '' : String(spellValue.rank); spellRank.appendChild(rankInput); spells.appendChild(spellRank); inputByKey['spells.rank'] = rankInput;
        const spellLabels = [
          ['cycleSeconds', 'Rotation cycle', 'seconds'], ['landingMultiplier', 'Spell landing multiplier', '×'],
          ['criticalChance', 'Spell critical chance', 'fraction 0–1'], ['criticalMultiplier', 'Spell critical multiplier', '×'],
          ['manaPerSecond', 'Available mana budget', 'mana/second'], ['meleeDuringCast', 'Melee during cast', 'fraction 0–1'],
        ];
        for (const [key, label, unit] of spellLabels) if (!spellOnly || key !== 'meleeDuringCast') number(spells, 'spells.' + key, label + ' (' + unit + ')', spellValue[key]);
        const spellNames = { 'wizard-hoarfrost': 'Ethereal Hoarfrost', 'magician-spear': 'Spear of Blistersteel', 'enchanter-mindcleave': 'Mindcleave', 'necro-pyre': 'Pyre of Marnek' };
        const explanation = document.createElement('p'); explanation.textContent = spellOnly
          ? 'Caster spell-only model: ' + (spellValue.model || spellOnlyModel) + '. One ' + (spellNames[spellValue.model] || 'cataloged spell') + ' application per cycle; this is a bounded reference, not an optimal rotation. Pets, unsupported triggered effects and unmodeled class mechanics are excluded.'
          : 'Fixed shared rotation: one Poantaar\'s Bite and one Kromrif Lance per cycle. Low mana budget scales rotation uptime; spell casts also reduce melee according to Melee during cast. Spell focus is evaluated from each loadout; pet damage remains excluded.'; spells.appendChild(explanation);
        body.appendChild(spells);
      }
      const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save for this character';
      save.addEventListener('click', async (event) => {
        event.preventDefault(); event.stopPropagation();
        if (!LC.state || typeof LC.state.saveDpsScenario !== 'function') { status.textContent = 'Saving DPS assumptions is unavailable.'; return; }
        save.disabled = true; status.textContent = 'Saving DPS assumptions…';
        const scenario = spellOnly ? { ...JSON.parse(JSON.stringify(currentScenario)), revision, layout: null } : {
          version: currentScenario.version,
          revision,
          layout: inputByKey.layout.value || null,
          hastePercent: String(inputByKey.hastePercent.value || '').trim() ? Number(inputByKey.hastePercent.value) : null,
          primary: {}, secondary: {},
          meleeModel: currentScenario.meleeModel || 'beastlord',
        };
        if (!spellOnly) for (const hand of ['primary', 'secondary']) for (const key of Object.keys(fieldLabels)) {
          const input = inputByKey[hand + '.' + key];
          scenario[hand][key] = String(input.value || '').trim() ? Number(input.value) : null;
        }
        if (currentScenario.version >= 2 && !spellOnly) {
          scenario.version = currentScenario.version;
          scenario.combat = {};
          for (const key of combatKeys) {
            const input = inputByKey['combat.' + key];
            scenario.combat[key] = String(input && input.value || '').trim() ? Number(input.value) : null;
          }
          scenario.procs = {};
          for (const key of procKeys) {
            const input = inputByKey['procs.' + key];
            scenario.procs[key] = String(input && input.value || '').trim() ? Number(input.value) : null;
          }
        }
        if (currentScenario.version >= 3) {
          scenario.spells = { model: 'beastlord', rank: 1, cycleSeconds: 32, landingMultiplier: 1,
            criticalChance: 0, criticalMultiplier: 2, manaPerSecond: 100, meleeDuringCast: 0,
            ...(currentScenario.spells || {}) };
          if (!meleeOnly) for (const key of ['rank', 'cycleSeconds', 'landingMultiplier', 'criticalChance', 'criticalMultiplier', 'manaPerSecond', 'meleeDuringCast']) {
            if (spellOnly && key === 'meleeDuringCast') { scenario.spells[key] = currentScenario.spells[key]; continue; }
            const input = inputByKey['spells.' + key];
            scenario.spells[key] = String(input && input.value || '').trim() ? Number(input.value) : null;
          }
        }
        const result = await LC.state.saveDpsScenario(profile.id, scenario, revision);
        save.disabled = false;
        if (!result || result.ok === false) {
          status.textContent = result && result.error ? result.error : 'Could not save DPS assumptions.';
          return;
        }
        const saved = result.scenario;
        if (saved && typeof saved === 'object') { currentScenario = saved; revision = saved.revision; }
        invalidateDpsReference(profile);
        status.textContent = 'Saved for ' + (profile.name || 'this character') + '.';
      });
      body.appendChild(save);
      const summary = document.createElement('p');
      summary.textContent = 'Current reference values are used for the compact DPS estimate above.';
      body.appendChild(summary);
      status.textContent = values.version + ' · revision ' + revision + (projection.scenarioDefault ? ' · illustrative default' : ' · saved scenario');
    };
    const load = async () => {
      if (loaded || loading) return;
      loading = true; status.textContent = 'Loading DPS assumptions…';
      const response = await cachedDpsReference(cand, profile, worn);
      loading = false; loaded = true;
      if (!response || !response.ok || !response.projection) { status.textContent = response && response.error || 'DPS assumptions are unavailable.'; return; }
      render(response.projection);
    };
    summary.addEventListener('click', load);
    details.addEventListener('toggle', () => { if (details.open) load(); });
    return details;
  }

  function buildProjectionPanel(cand, profile, worn) {
    const className = String(profile && profile.cls || '').trim().toLowerCase();
    const spellOnly = ['wizard', 'wiz', 'magician', 'mag', 'enchanter', 'enc', 'necromancer', 'nec'].includes(className);
    const meleeOnly = ['berserker', 'ber', 'monk', 'mnk', 'rogue', 'rog'].includes(className);
    const panel = document.createElement('details'); panel.className = 'lc-projection';
    const title = document.createElement('summary'); title.textContent = 'Stat estimates and experimental DPS'; panel.appendChild(title);
    const scope = document.createElement('p'); scope.textContent = 'Reference estimates use the same model for both items; calibration is optional. These are not measured game totals.'; panel.appendChild(scope);
    const body = document.createElement('div'); body.setAttribute('aria-live', 'polite'); panel.appendChild(body);
    const result = document.createElement('p'); body.appendChild(result);
    const confirmation = document.createElement('label'); confirmation.hidden = true;
    const check = document.createElement('input'); check.type = 'checkbox'; confirmation.appendChild(check);
    confirmation.appendChild(document.createTextNode('For this comparison, I verified wearability, unchanged augment transfers, other effects and power-source conditions.'));
    panel.appendChild(confirmation);
    const manage = document.createElement('a'); manage.textContent = 'Manage character inputs and rule validation';
    manage.href = chrome.runtime.getURL('options/options.html'); manage.target = '_blank'; manage.rel = 'noopener'; panel.appendChild(manage);
    const damageDetails = document.createElement('details'); damageDetails.className = 'lc-damage-contributions';
    const damageSummary = document.createElement('summary'); damageSummary.textContent = 'Damage contributions'; damageDetails.appendChild(damageSummary);
    const damageBody = document.createElement('div'); damageDetails.appendChild(damageBody);
    const effectsConfirm = document.createElement('label'); const effectsCheck = document.createElement('input'); effectsCheck.type = 'checkbox'; effectsCheck.disabled = true;
    const effectsText = document.createTextNode(' Worn-effect source review unavailable until loaded.');
    effectsConfirm.appendChild(effectsCheck); effectsConfirm.appendChild(effectsText); damageBody.appendChild(effectsConfirm);
    const procConfirm = document.createElement('label'); const procCheck = document.createElement('input'); procCheck.type = 'checkbox'; procCheck.disabled = true;
    const procText = document.createTextNode(' Weapon-proc source review unavailable until loaded.');
    procConfirm.appendChild(procCheck); procConfirm.appendChild(procText); damageBody.appendChild(procConfirm);
    effectsConfirm.hidden = spellOnly; procConfirm.hidden = spellOnly;
    const focusConfirm = document.createElement('label'); const focusCheck = document.createElement('input'); focusCheck.type = 'checkbox'; focusCheck.disabled = true;
    const focusText = document.createTextNode(' Spell-focus source review unavailable until loaded.');
    focusConfirm.appendChild(focusCheck); focusConfirm.appendChild(focusText); damageBody.appendChild(focusConfirm);
    focusConfirm.hidden = spellOnly || meleeOnly;
    const damageStatus = document.createElement('p'); damageStatus.textContent = 'Open to calculate known melee, proc and spell contributions.'; damageBody.appendChild(damageStatus);
    if (spellOnly) damageStatus.textContent = 'Open to calculate the class-specific spell-only reference.';
    if (meleeOnly) damageStatus.textContent = 'Open to calculate the class-specific base-melee reference.';
    let damageLoaded = false; let damageLoading = false; let damageBinding = null; let damageGeneration = 0;
    const renderDamage = (projection) => {
      damageBody.replaceChildren(effectsConfirm, procConfirm, focusConfirm, damageStatus);
      damageBinding = projection && (projection.comparisonBinding || projection.binding) || damageBinding;
      const sourcePairs = (value) => value && typeof value === 'object' && Array.isArray(value.current) && Array.isArray(value.candidate);
      const reviewablePairs = (value) => sourcePairs(value) && [...value.current, ...value.candidate].every((entry) => entry &&
        typeof entry.itemName === 'string' && typeof entry.slot === 'string' && Array.isArray(entry.effects) && typeof entry.effectsKnown === 'boolean');
      const effectSourceData = projection && projection.effectSources;
      const procSourceData = projection && (projection.procSources || projection.weaponProcSources || projection.weaponEffectSources || projection.effectSources);
      const focusSourceData = projection && (projection.spellFocusSources || projection.focusSources || projection.effectSources);
      const effectsReviewable = !!damageBinding && reviewablePairs(effectSourceData);
      const procsReviewable = !!damageBinding && reviewablePairs(procSourceData);
      const focusReviewable = !!damageBinding && reviewablePairs(focusSourceData);
      effectsCheck.disabled = !effectsReviewable; procCheck.disabled = !procsReviewable; focusCheck.disabled = !focusReviewable;
      effectsText.nodeValue = effectsReviewable ? ' I verified imported worn effects are complete for both gear sets.' : ' Worn-effect source review unavailable; leave unchecked.';
      procText.nodeValue = procsReviewable ? ' I verified weapon proc lists are complete for both gear sets.' : ' Weapon-proc source review unavailable; leave unchecked.';
      focusText.nodeValue = focusReviewable ? ' I verified spell-focus sources are complete for both gear sets.' : ' Spell-focus source review unavailable; leave unchecked.';
      if (effectsCheck.disabled) effectsCheck.checked = false;
      if (procCheck.disabled) procCheck.checked = false;
      if (focusCheck.disabled) focusCheck.checked = false;
      const outputs = projection && Array.isArray(projection.outputs) ? projection.outputs : [];
      damageStatus.textContent = projection && projection.scenarioDefault
        ? 'Illustrative defaults for melee, procs and spells; values are estimates, not measured combat.' : 'Same melee, proc and spell scenario applied to current and candidate.';
      if (spellOnly) damageStatus.textContent = 'Same class-specific spell-only reference applied to current and candidate; not measured combat or an optimal rotation.';
      if (meleeOnly) damageStatus.textContent = 'Same class-specific base-melee reference applied to current and candidate; class abilities remain excluded.';
      for (const output of outputs) {
        const row = document.createElement('p');
        const reasons = output && (output.unresolvedReasons || output.reasons);
        const reason = Array.isArray(reasons) ? reasons.join('; ') : output && output.reason;
        const outputNote = output && (output.reason || output.note);
        row.textContent = output && output.available
          ? output.metric + ': current ' + fmtStat(output.current) + ' → candidate ' + fmtStat(output.candidate) + ' (Δ ' + fmtDelta(output.delta) + ')' + (output.partial ? ' (partial)' : '') + (outputNote ? ' — ' + outputNote : '')
          : (output && output.metric || 'Contribution') + ': unavailable — ' + (reason || 'required data is unknown.');
        damageBody.appendChild(row);
        const sources = output && (output.sources || (projection.rule && projection.rule.sources));
        if (Array.isArray(sources) && sources.length) {
          const sourceRow = document.createElement('p');
          sourceRow.textContent = 'Sources: ';
          sources.forEach((source, index) => {
            if (index) sourceRow.appendChild(document.createTextNode(', '));
            const link = document.createElement('a'); const value = typeof source === 'string' ? source : source.url;
            link.href = value || '#'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = typeof source === 'string' ? source : (source.label || value || 'source'); sourceRow.appendChild(link);
          });
          damageBody.appendChild(sourceRow);
        }
      }
      const effectSources = projection && projection.effectSources;
      if (effectSources && sourcePairs(effectSources)) {
        const effectText = (effect) => [effect && effect.type, effect && effect.name, effect && effect.rank, effect && effect.raw].filter(Boolean).join(' · ') || '(unnamed effect)';
        for (const [label, entries] of [['Current loadout', effectSources.current], ['Candidate loadout', effectSources.candidate]]) {
          const heading = document.createElement('p'); heading.textContent = label + ' imported effects'; damageBody.appendChild(heading);
          for (const entry of entries) {
            const row = document.createElement('p');
            const effects = Array.isArray(entry.effects) ? entry.effects.map(effectText).join('; ') : '(effects unavailable)';
            row.textContent = (entry.itemName || '(unnamed item)') + ' [' + (entry.slot || '?') + '] · effects ' + (entry.effectsKnown === true ? 'known' : 'unresolved') + ': ' + (effects || '(none listed)');
            damageBody.appendChild(row);
          }
        }
      }
      const focusSources = projection && (projection.spellFocusSources || projection.focusSources);
      if (focusSources && sourcePairs(focusSources)) {
        for (const [label, entries] of [['Current loadout', focusSources.current], ['Candidate loadout', focusSources.candidate]]) {
          const heading = document.createElement('p'); heading.textContent = label + ' spell-focus sources'; damageBody.appendChild(heading);
          for (const entry of entries) {
            const row = document.createElement('p');
            const effects = Array.isArray(entry.effects) ? entry.effects.map((effect) => [effect && effect.type, effect && effect.name, effect && effect.rank, effect && effect.raw].filter(Boolean).join(' · ') || '(unnamed effect)').join('; ') : '(effects unavailable)';
            row.textContent = (entry.itemName || '(unnamed item)') + ' [' + (entry.slot || '?') + '] · effects ' + (entry.effectsKnown === true ? 'known' : 'unresolved') + ': ' + (effects || '(none listed)');
            damageBody.appendChild(row);
          }
        }
      }
      const citations = projection && Array.isArray(projection.sources) ? projection.sources : [];
      if (citations.length) {
        const heading = document.createElement('p'); heading.textContent = 'Sources'; damageBody.appendChild(heading);
        citations.forEach((source, index) => {
          const row = document.createElement('p'); if (index) row.appendChild(document.createTextNode(''));
          if (source && typeof source === 'object' && source.url) { const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = source.label || source.url; row.appendChild(link); }
          else row.appendChild(document.createTextNode(typeof source === 'string' ? source : String(source && (source.label || source.key) || 'source')));
          damageBody.appendChild(row);
        });
      }
    };
    const loadDamage = async () => {
      if (damageLoading) return;
      const request = ++damageGeneration;
      damageLoading = true; damageStatus.textContent = 'Loading damage contributions…';
      const confirmationValue = (effectsCheck.checked || procCheck.checked || focusCheck.checked) && damageBinding
        ? { effectsComplete: effectsCheck.checked, weaponProcsComplete: procCheck.checked, spellFocusComplete: focusCheck.checked, binding: damageBinding } : undefined;
      const response = await LC.state.getCharacterProjection(cand, profile, worn, false, 'dps-reference', undefined, confirmationValue);
      damageLoading = false; damageLoaded = true;
      if (request !== damageGeneration) return;
      if (!response || !response.ok || !response.projection) { damageStatus.textContent = response && response.error || 'Damage contributions unavailable.'; return; }
      renderDamage(response.projection);
    };
    damageSummary.addEventListener('click', loadDamage);
    damageDetails.addEventListener('toggle', () => { if (damageDetails.open) loadDamage(); });
    const reloadConfirmed = () => { if (damageLoaded) { ++damageGeneration; loadDamage(); } };
    effectsCheck.addEventListener('change', reloadConfirmed); procCheck.addEventListener('change', reloadConfirmed); focusCheck.addEventListener('change', reloadConfirmed);
    panel.appendChild(damageDetails);
    panel.appendChild(buildDpsScenarioEditor(cand, profile, worn));
    const modeLabel = document.createElement('label'); modeLabel.textContent = 'Comparison model ';
    const mode = document.createElement('select');
    for (const [value, label] of [['reference', 'Reference estimate (no calibration)'], ['calibrated', 'Calibrated Accuracy only'], ['dps', 'Manual DPS estimate (melee and procs)']]) {
      if (value === 'dps' && (!profile || !['beastlord', 'bst'].includes(String(profile.cls || '').trim().toLowerCase()) || Number(profile.level) !== 100)) continue;
      const option = document.createElement('option'); option.value = value; option.textContent = label; mode.appendChild(option);
    }
    modeLabel.appendChild(mode); panel.appendChild(modeLabel);
    const dpsControls = document.createElement('div'); dpsControls.hidden = true; panel.appendChild(dpsControls);
    const dpsInputs = {};
    const addDpsSelect = (key, label, options) => {
      const field = document.createElement('label'); field.textContent = label + ' ';
      const input = document.createElement('select'); input.required = true;
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Select…'; input.appendChild(blank);
      for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.appendChild(option); }
      field.appendChild(input); dpsControls.appendChild(field); dpsInputs[key] = input;
    };
    const addNumber = (parent, key, label, unit, target) => {
      const field = document.createElement('label'); field.textContent = label + ' (' + unit + ') ';
      const input = document.createElement('input'); input.type = 'number'; input.required = true; input.step = 'any';
      field.appendChild(input); parent.appendChild(field); target[key] = input;
    };
    const addDpsNumber = (key, label, unit) => addNumber(dpsControls, key, label, unit, dpsInputs);
    const procKeysFor = (effects) => [...new Set((effects || []).filter((effect) => effect && effect.type === 'proc')
      .map((effect) => effect.key == null ? '' : String(effect.key).trim()))];
    const procNames = (effects) => (effects || []).filter((effect) => effect && effect.type === 'proc')
      .map((effect) => String(effect.name || effect.raw || effect.key || '(missing proc key)')).join('; ') || '(none listed)';
    const buildProcControls = (parent, effects, label, target, description) => {
      const procInputs = document.createElement('div');
      const procEffects = (effects || []).filter((effect) => effect && effect.type === 'proc');
      const procConfirmation = document.createElement('label');
      const procCheck = document.createElement('input'); procCheck.type = 'checkbox'; procCheck.checked = false;
      procConfirmation.appendChild(procCheck);
      const procDescriptions = description || procNames(procEffects);
      procConfirmation.appendChild(document.createTextNode('I verified the listed ' + label + ' weapon procs are complete for both items (including any item with none): ' + procDescriptions));
      procInputs.appendChild(procConfirmation); target.procListsConfirmed = procCheck;
      target.procAssumptions = [];
      const procKeys = procKeysFor(effects);
      if (procKeys.length) {
        const heading = document.createElement('p'); heading.textContent = label + ' proc assumptions (same for both gear sets; expected damage includes resists/crits).'; procInputs.appendChild(heading);
        for (const key of procKeys) {
          const row = document.createElement('div'); row.textContent = (key || '(missing proc key)') + ': ';
          const frequency = document.createElement('input'); frequency.type = 'number'; frequency.required = true; frequency.step = 'any'; frequency.setAttribute('aria-label', label + ' ' + key + ' procs per minute');
          const damage = document.createElement('input'); damage.type = 'number'; damage.required = true; damage.step = 'any'; damage.setAttribute('aria-label', label + ' ' + key + ' damage per proc');
          row.appendChild(frequency); row.appendChild(document.createTextNode(' procs/min; ')); row.appendChild(damage); row.appendChild(document.createTextNode(' damage/proc')); procInputs.appendChild(row);
          target.procAssumptions.push({ key, frequency, damage });
        }
      }
      parent.appendChild(procInputs);
      return procInputs;
    };
    const findHandItem = (hand) => {
      if (!profile || !Array.isArray(profile.items) || !hand) return null;
      return profile.items.find((item) => {
        if (!item || item.isAugment || item === worn) return false;
        const slot = LC.slots && LC.slots.canonicalSlot ? LC.slots.canonicalSlot(item.slot) : item.slotKey;
        const keys = slot && (slot.keys || [slot.key]);
        return keys && keys.length === 1 && keys[0] === hand;
      }) || null;
    };
    const handAssumptionKeys = ['hitChance', 'mitigationMultiplier', 'damageMultiplier', 'damageBonus', 'attacksPerRound'];
    const handLabels = {
      hitChance: ['Hit chance', 'fraction 0–1'], mitigationMultiplier: ['Mitigation remaining', 'fraction'],
      damageMultiplier: ['Landed base coefficient', 'multiplier'], damageBonus: ['Damage bonus', 'damage/strike'],
      attacksPerRound: ['Attacks', 'attacks/round'],
    };
    const scopeLabel = document.createElement('label'); scopeLabel.textContent = 'DPS scope ';
    const scopeSelect = document.createElement('select');
    for (const [value, text] of [['selected-hand', 'Selected weapon hand'], ['equipped-weapons', 'Both equipped weapon hands']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; scopeSelect.appendChild(option);
    }
    scopeSelect.value = 'selected-hand';
    scopeLabel.appendChild(scopeSelect); dpsControls.appendChild(scopeLabel); dpsInputs.scope = scopeSelect;
    addDpsSelect('hand', 'Hand', [['primary', 'Primary'], ['secondary', 'Secondary']]);
    addDpsSelect('layout', 'Layout for both weapons', [['dual-wield', 'Dual-wield'], ['two-hand', 'Two-hand'], ['one-hand-shield', 'One-hand + shield']]);
    addDpsNumber('hastePercent', 'Haste', '%');
    const selectedHeading = document.createElement('p'); selectedHeading.textContent = 'Selected-hand assumptions'; dpsControls.appendChild(selectedHeading);
    addDpsNumber('hitChance', 'Hit chance', 'fraction 0–1');
    addDpsNumber('mitigationMultiplier', 'Mitigation remaining', 'fraction');
    addDpsNumber('damageMultiplier', 'Landed base coefficient', 'multiplier');
    addDpsNumber('damageBonus', 'Damage bonus', 'damage/strike');
    addDpsNumber('attacksPerRound', 'Attacks', 'attacks/round');
    const procEffects = [...(cand && cand.effects || []), ...(worn && worn.effects || [])].filter((effect) => effect && effect.type === 'proc');
    const selectedProcDescription = 'Current: ' + procNames(worn && worn.effects) + '; candidate: ' + procNames(cand && cand.effects);
    buildProcControls(dpsControls, procEffects, 'selected-hand', dpsInputs, selectedProcDescription);
    const otherSection = document.createElement('details'); otherSection.hidden = true; dpsControls.appendChild(otherSection);
    const otherHeading = document.createElement('summary'); otherHeading.textContent = 'Other equipped hand assumptions'; otherSection.appendChild(otherHeading);
    const otherSource = document.createElement('p'); otherSection.appendChild(otherSource);
    const otherInputs = {};
    for (const key of handAssumptionKeys) addNumber(otherSection, key, handLabels[key][0], handLabels[key][1], otherInputs);
    const otherProcHost = document.createElement('div'); otherSection.appendChild(otherProcHost);
    const otherHand = () => dpsInputs.hand.value === 'primary' ? 'secondary' : 'primary';
    const otherSourceItem = () => findHandItem(otherHand());
    let bindDpsInput = () => {};
    let renderedOtherSource = {};
    const setOtherRequired = (required) => {
      for (const key of handAssumptionKeys) if (otherInputs[key]) otherInputs[key].required = required;
      for (const entry of otherInputs.procAssumptions || []) { entry.frequency.required = required; entry.damage.required = required; }
    };
    const updateOtherHand = () => {
      const show = dpsInputs.scope.value === 'equipped-weapons' && dpsInputs.layout.value === 'dual-wield';
      otherSection.hidden = !show;
      setOtherRequired(show);
      if (!show) return;
      const item = otherSourceItem();
      otherSource.textContent = item ? 'Other-hand source: ' + (item.name || ('#' + item.id)) : 'Other-hand source: no equipped weapon found.';
      if (item !== renderedOtherSource) {
        renderedOtherSource = item;
        otherProcHost.replaceChildren();
        buildProcControls(otherProcHost, item && item.effects || [], 'other-hand', otherInputs,
          'Unchanged source: ' + procNames(item && item.effects));
        setOtherRequired(true);
        for (const entry of otherInputs.procAssumptions || []) bindDpsInput(entry.frequency, entry.damage);
        bindDpsInput(otherInputs.procListsConfirmed);
      }
    };
    const updateDpsScopeText = () => {
      scope.textContent = dpsInputs.scope.value === 'equipped-weapons'
        ? 'DPS estimate for both equipped weapon hands. Spell focus and pet contributions are excluded; identical assumptions are used for both gear sets.'
        : 'DPS estimate for the selected hand only. Spell focus and pet contributions are excluded; identical assumptions are used for both gear sets.';
    };
    const dpsNote = document.createElement('p'); dpsNote.textContent = 'All DPS assumptions apply identically to current and candidate. Choose only when both weapons use the same layout, skill and damage-bonus assumptions; layout changes are unsupported. Haste is the effective post-cap value; multipliers are landed base coefficients, mitigation is the fraction remaining, and damage bonus is per landed strike. This is a weapon subtotal estimate; spell focus, pet damage and augments are excluded.'; dpsControls.appendChild(dpsNote);
    const calculate = document.createElement('button'); calculate.type = 'button'; calculate.textContent = 'Calculate'; calculate.hidden = true; dpsControls.appendChild(calculate);
    let generation = 0;
    const dpsAssumptions = () => {
      const valueOrNull = (input) => {
        if (!String(input.value || '').trim()) return null;
        const value = Number(input.value);
        return Number.isFinite(value) ? value : null;
      };
      const assumptions = { scope: dpsInputs.scope.value || null, hand: dpsInputs.hand.value || null, layout: dpsInputs.layout.value || null };
      for (const key of ['hastePercent', 'hitChance', 'mitigationMultiplier', 'damageMultiplier', 'damageBonus', 'attacksPerRound']) assumptions[key] = valueOrNull(dpsInputs[key]);
      assumptions.procListsConfirmed = !!dpsInputs.procListsConfirmed.checked;
      assumptions.procAssumptions = (dpsInputs.procAssumptions || []).map(({ key, frequency, damage }) => {
        return { key, procsPerMinute: valueOrNull(frequency), damagePerProc: valueOrNull(damage) };
      });
      if (assumptions.scope === 'equipped-weapons' && assumptions.layout === 'dual-wield') {
        assumptions.otherHand = {};
        for (const key of handAssumptionKeys) assumptions.otherHand[key] = valueOrNull(otherInputs[key]);
        assumptions.otherHand.procListsConfirmed = !!otherInputs.procListsConfirmed.checked;
        assumptions.otherHand.procAssumptions = (otherInputs.procAssumptions || []).map(({ key, frequency, damage }) => {
          return { key, procsPerMinute: valueOrNull(frequency), damagePerProc: valueOrNull(damage) };
        });
      }
      return assumptions;
    };
    const renderDps = async () => {
      const assumptions = dpsAssumptions();
      if (!assumptions) return;
      const request = ++generation;
      result.textContent = 'Calculating DPS estimate…'; calculate.disabled = true;
      body.replaceChildren(result);
      const response = await LC.state.getCharacterProjection(cand, profile, worn, false, 'dps', assumptions);
      if (request !== generation || panel.isConnected === false) return;
      calculate.disabled = false;
      if (!response || !response.ok || !response.projection) { result.textContent = response && response.error || 'DPS estimate unavailable.'; body.replaceChildren(result); return; }
      const projection = response.projection;
      if (projection.reason) { result.textContent = projection.reason; body.replaceChildren(result); return; }
      const outputs = Array.isArray(projection.outputs) ? projection.outputs : [];
      const rule = projection.rule && projection.rule.key ? ' [' + projection.rule.key + ' v' + projection.rule.version + ']' : '';
      const summaryOutputs = assumptions.scope === 'equipped-weapons'
        ? outputs.filter((output) => output.available && output.metric === 'Weapon subtotal')
        : outputs.filter((output) => output.available);
      const fallbackOutputs = assumptions.scope === 'equipped-weapons' && !summaryOutputs.length
        ? outputs.filter((output) => output.available && ['Weapon melee DPS', 'Weapon proc DPS'].includes(output.metric)) : summaryOutputs;
      result.textContent = 'DPS estimate' + rule + ' · ' + (fallbackOutputs.map((output) => output.metric + ' ' + fmtDelta(output.delta)).join(' · ') || 'unavailable');
      body.replaceChildren(result);
      for (const output of outputs) {
        const row = document.createElement('p');
        row.textContent = output.available ? output.metric + ': current ' + fmtStat(output.current) + ' → candidate ' + fmtStat(output.candidate) + ' (Δ ' + fmtDelta(output.delta) + ')' : output.metric + ': unavailable — ' + (output.reason || 'required input is unknown.');
        body.appendChild(row);
      }
      for (const assumption of projection.assumptions || []) { const row = document.createElement('p'); row.textContent = assumption; body.appendChild(row); }
    };
    const render = async () => {
      if (mode.value === 'dps') { ++generation; dpsControls.hidden = false; calculate.hidden = false; calculate.disabled = false; confirmation.hidden = true; updateOtherHand(); updateDpsScopeText(); result.textContent = 'Enter assumptions, then select Calculate.'; body.replaceChildren(result); return; }
      dpsControls.hidden = true; calculate.hidden = true;
      const request = ++generation;
      scope.textContent = mode.value === 'reference' ? 'Consistent reference estimates, not measured game totals. No calibration required.' : 'Optional calibrated Accuracy check; a current snapshot and approved observation are required.';
      result.textContent = mode.value === 'reference' ? 'Calculating reference estimates…' : 'Checking snapshot and calibrated rules…'; body.replaceChildren(result); check.disabled = true;
      const response = await LC.state.getCharacterProjection(cand, profile, worn, check.checked, mode.value);
      if (request !== generation || panel.isConnected === false) return;
      check.disabled = false;
      if (!response || !response.ok || !response.projection) { result.textContent = response && response.error || 'Projection unavailable.'; body.replaceChildren(result); return; }
      const projection = response.projection;
      confirmation.hidden = !projection.needsConfirmation;
      if (projection.reason) { result.textContent = projection.reason; body.replaceChildren(result); return; }
      if (projection.mode === 'reference') {
        const label = (metric) => metric;
        const range = (low, high, signed = true) => {
          const format = signed ? fmtDelta : fmtStat;
          return low === high ? format(low) : format(low) + ' to ' + format(high);
        };
        result.textContent = 'Estimate · ' + (projection.outputs.filter((output) => output.available).map((output) => label(output.metric) + ' ' + range(output.deltaLow, output.deltaHigh)).join(' · ') || 'unavailable');
        body.replaceChildren(result);
        for (const output of projection.outputs) {
          const row = document.createElement('p');
          row.textContent = output.available ? label(output.metric) + ': ' + range(output.deltaLow, output.deltaHigh) +
            (output.current == null ? (output.metric === 'AC' ? ' (before soft caps; change only)' : ' (change only)') : '; snapshot ' + fmtStat(output.current) + ' → reference ' + range(output.projectedLow, output.projectedHigh, false)) :
            label(output.metric) + ': unavailable — ' + output.reason;
          body.appendChild(row);
        }
        const details = document.createElement('details');
        const summary = document.createElement('summary'); summary.textContent = 'Calculation, assumptions and sources'; details.appendChild(summary);
        for (const output of projection.outputs.filter((output) => output.available)) {
          const part = output.components, row = document.createElement('p');
          const attribute = part.attribute ? range(part.attribute[0], part.attribute[1]) : '?';
          row.textContent = label(output.metric) + ': item ' + fmtDelta(part.item) + '; attributes ' + attribute +
            (part.heroic == null ? '' : '; heroics ' + fmtDelta(part.heroic)) +
            (part.scaledItem == null ? '' : '; scaled item AC ' + fmtDelta(part.scaledItem) + ' (×4/3, rounded)') +
            (part.multiplier == null ? '' : '; HP multiplier ×' + part.multiplier) +
            (part.cappedItem == null ? '' : '; capped item ATK ' + fmtDelta(part.cappedItem) + ' ×1.342, cap ' + part.itemCap);
          details.appendChild(row);
        }
        for (const assumption of projection.assumptions) { const row = document.createElement('p'); row.textContent = assumption; details.appendChild(row); }
        for (const source of projection.rule.sources) {
          const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = source.label;
          const row = document.createElement('p'); row.appendChild(link); details.appendChild(row);
        }
        body.appendChild(details);
        return;
      }
      const available = projection.outputs.find((output) => output.available);
      result.textContent = available ? 'Accuracy ' + fmtStat(available.current) + ' → ' + fmtStat(available.projected) + ' (Δ ' + fmtDelta(available.delta) + ') · Derived' :
        (projection.needsConfirmation ? 'Confirm conditions' : 'Unavailable');
      body.replaceChildren(result);
      for (const output of projection.outputs) {
        const row = document.createElement('p');
        if (output.available) {
          row.textContent = output.metric + ': ' + fmtStat(output.current) + ' → ' + fmtStat(output.projected) +
            ' (Δ ' + fmtDelta(output.delta) + ' points) — ' + output.confidence + '.';
          body.appendChild(row);
          const explanation = document.createElement('p');
          explanation.textContent = 'Heroic DEX ' + output.heroicBefore + ' → ' + output.heroicAfter +
            '; approved interval ' + output.approvedRange.join('–') + '. ' + output.assumption;
          body.appendChild(explanation);
        } else { row.textContent = output.metric + ': unavailable — ' + output.reason; body.appendChild(row); }
      }
      const source = document.createElement('a'); source.href = projection.rule.source; source.target = '_blank'; source.rel = 'noopener noreferrer';
      source.textContent = 'Rule ' + projection.rule.key + ' v' + projection.rule.version + ' · developer source'; body.appendChild(source);
    };
    const invalidateDps = () => {
      if (mode.value !== 'dps') return;
      ++generation; updateOtherHand(); updateDpsScopeText(); calculate.disabled = false; result.textContent = 'Assumptions changed; select Calculate.'; body.replaceChildren(result);
    };
    bindDpsInput = (input, ...extra) => {
      if (!input) return;
      input.addEventListener('input', invalidateDps); input.addEventListener('change', invalidateDps);
      for (const additional of extra) { additional.addEventListener('input', invalidateDps); additional.addEventListener('change', invalidateDps); }
    };
    for (const input of [dpsInputs.scope, dpsInputs.hand, dpsInputs.layout, dpsInputs.hastePercent, dpsInputs.hitChance, dpsInputs.mitigationMultiplier,
      dpsInputs.damageMultiplier, dpsInputs.damageBonus, dpsInputs.attacksPerRound, dpsInputs.procListsConfirmed, ...(dpsInputs.procAssumptions || []).flatMap(({ frequency, damage }) => [frequency, damage])]) {
      bindDpsInput(input);
    }
    for (const key of handAssumptionKeys) bindDpsInput(otherInputs[key]);
    updateOtherHand();
    check.addEventListener('change', render); mode.addEventListener('change', render); calculate.addEventListener('click', renderDps); render();
    return panel;
  }

  function buildComparePanel(cand, worn, diff, slotLabel, alternatives, selectedIndex = 0, view = 'stats', baselineLabel = 'worn', profile = null) {
    const div = document.createElement('div');
    div.className = 'lc-compare-panel';
    div.dataset.lcView = view;
    div.dataset.lcRow = String(selectedIndex);
    const head = document.createElement('div');
    head.className = 'lc-head';
    const equip = buildEquipAction(cand, worn, slotLabel, view, baselineLabel, profile);
    // Comparing an item with itself only ever yields a table of zeroes, which
    // is what an equipped item compares against once it is in the profile.
    if (worn && sameStoredItem(worn, cand)) {
      head.textContent = 'Already equipped in ' + (slotLabel || ((cand.slotKey && cand.slotKey.key) || 'this slot')) + '.';
      if (equip) head.appendChild(equip);
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
        if (className) {
          cell.className = className;
          cell.title = d.delta == null ? 'Unavailable: a stat is unknown' : 'Exact item delta';
        }
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    const title = document.createElement('span');
    title.className = 'lc-compare-title';
    title.appendChild(document.createTextNode(
      (view === 'focus' ? 'Spell focus: ' : view === 'proc' ? 'Proc: ' : '') + (slotLabel ? slotLabel + ': ' : '') +
      (worn ? (worn.name || ('#' + worn.id)) : 'empty slot') + ' → ' + (cand.name || ('#' + cand.id)) + ' '
    ));
    head.appendChild(title);
    if (view === 'stats' && alternatives && alternatives.length > 1) {
      const nav = document.createElement('span');
      nav.className = 'lc-compare-nav';
      const move = (offset) => {
        const index = (selectedIndex + offset + alternatives.length) % alternatives.length;
        const row = alternatives[index];
        div.replaceWith(buildComparePanel(cand, row.target, row.diff,
          row.slotKey && row.slotKey.key, alternatives, index, view, baselineLabel, profile));
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
    if (equip) head.appendChild(equip);
    div.appendChild(head);
    if (view === 'stats') {
      div.appendChild(buildStatsOverview(cand, worn, diff, profile, diff && diff.formula));
      if (diff.hasData) {
        const allStats = document.createElement('details');
        const allStatsSummary = document.createElement('summary');
        allStatsSummary.textContent = 'All item stats';
        allStats.appendChild(allStatsSummary);
        allStats.appendChild(table);
        div.appendChild(allStats);
      }
      const breakdown = buildScoreBreakdown(diff);
      if (breakdown) div.appendChild(breakdown);
    }
    const otherDetails = buildOtherEffects(diff.effects && diff.effects.other);
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
    if (view === 'stats') {
      if (otherDetails || focusDetails || procDetails) {
        const effects = document.createElement('details');
        const effectsSummary = document.createElement('summary');
        effectsSummary.textContent = 'Effects';
        effects.appendChild(effectsSummary);
        for (const details of [otherDetails, focusDetails, procDetails]) if (details) effects.appendChild(details);
        div.appendChild(effects);
      }
      if (baselineLabel === 'worn' && profile && LC.state && LC.state.getCharacterProjection) {
        div.appendChild(buildProjectionPanel(cand, profile, worn));
      }
    }
    return div;
  }

  function setWishlistToggleState(button, wanted) {
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-label', wanted ? 'Remove from wishlist' : 'Add to wishlist');
    button.textContent = wanted ? '★' : '☆';
    button.title = button.dataset.lcMulti ? 'Wishlist (pick a character)' : 'Wishlist';
  }

  // ---------- Outside-click panel dismissal ----------
  // Closes any open Loot Captain panel (compare panel, wishlist panel,
  // character picker, compare row) when clicking somewhere else on the page.
  // Clicks inside a panel or on the badge/toggle that can open one are
  // ignored, so the toggles keep their own open/close behavior.
  let outsideCloseInstalled = false;
  function registerOutsideClose() {
    if (outsideCloseInstalled) return;
    outsideCloseInstalled = true;
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('.lc-compare-panel, .lc-compare-row, .lc-badge, .lc-wishlist-toggle, .lc-wishlist-compare')) return;
      document.querySelectorAll('.lc-compare-panel, .lc-compare-row').forEach((el) => el.remove());
    }, true);
  }

  // One wishlist star per item. profiles: [{ profile, wanted }]. Characters
  // that cannot wear the item (class or required level) are excluded, and if
  // none can wear it the star renders disabled. With a single eligible
  // character the star toggles directly; with several, clicking opens a
  // picker so the user can choose which character's wishlist to update. The
  // picker closes when clicking anywhere outside it (registerOutsideClose)
  // and stays open while toggling characters inside it. pickerHost anchors
  // the picker when the toggle's own parent is rebuilt on re-annotation.
  function buildWishlistToggle(cand, profiles, pickerHost) {
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
        const host = pickerHost || button.parentNode;
        const existing = host && host.querySelector(':scope > .lc-character-picker-panel');
        if (existing) { existing.remove(); return; }
        if (!host) return;
        host.appendChild(buildWishlistCharacterPicker(cand, eligible, button));
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
    const verdicts = (pairs || []).map((pair) => {
      const ownerFormula = LC.diff && LC.diff.resolveFormula
        ? LC.diff.resolveFormula(pair.profile, formula)
        : formula;
      const diff = LC.diff && LC.diff.compareItemPair
        ? LC.diff.compareItemPair(cand, pair.target, ownerFormula,
          pair.profile && pair.profile.level, pair.profile)
        : null;
      return { formula: ownerFormula, verdict: comparisonVerdict(diff, ownerFormula) };
    });
    const signatures = new Set(verdicts.map((entry) => formulaSignature(entry.formula)));
    const states = new Set(verdicts.map((entry) => entry.verdict.state));
    const verdict = verdicts.length && signatures.size === 1 && states.size === 1 && !states.has('nomatch')
      ? verdicts[0].verdict
      : { state: 'nomatch', explanation: signatures.size > 1 ? 'Comparison unavailable; wishlist owners use different formulas; open each character' : 'Comparison unavailable; mixed comparisons; open each character' };
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lc-wishlist-compare';
    button.dataset.state = verdict.state;
    button.textContent = 'Compare wishlist' + (pairs.length > 1 ? ' (' + pairs.length + ')' : '');
    button.title = 'Compare against wishlist items; ' + verdict.explanation;
    button.setAttribute('aria-label', button.title);
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
      const diff = LC.diff.compareItemPair(cand, resolved, formula, owner && owner.level, owner);
      if (!diff.comparable && !diff.hasData && !diff.effectsComparable) {
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

  function comparisonBadgeText(row, formula, compact) {
    if (row && row.diff && row.diff.numericScoreAvailable === true && Number.isFinite(row.diff.score)) {
      const prefix = row.isAugment ? 'Aug' : row.slotKey && row.slotKey.key === 'primary' ? 'P' : row.slotKey && row.slotKey.key === 'secondary' ? 'S' : '';
      return (prefix ? prefix + ' ' : '') + 'Stats ' + fmtDelta(row.diff.score);
    }
    if (row.isAugment) return 'Compare augment';
    const key = row.slotKey && row.slotKey.key;
    return key === 'primary' ? 'Compare primary' : key === 'secondary' ? 'Compare secondary' : 'Compare';
  }

  function comparisonBadgeTitle(row, formula) {
    const slot = row.slotKey && row.slotKey.key;
    if (row.isAugment) {
      const compatible = (row.compatibleSlots || []).join(', ');
      return 'Compare augment; fits ' + compatible + '; click for full stats and effects';
    }
    return (slot ? slot + ': ' : '') + 'Compare item stats and effects; click for full details';
  }

  function buildComparisonBadge(row, formula, compact, cand = null, profile = null) {
    const verdict = comparisonVerdict(row && row.diff, formula);
    const title = comparisonBadgeTitle(row, formula) + '; ' + verdict.explanation;
    const badge = buildCompareButton(
      verdict.state,
      comparisonBadgeText(row, formula, compact), title);
    badge.dataset.lcView = 'stats';
    if (cand && profile && row && row.target) appendDpsMetric(badge, cand, row.target, profile, formula);
    return badge;
  }

  function buildComparisonBadges(row, formula, compact, cand = null, profile = null) {
    const effectGroups = row.diff.effects || {};
    const hasEffects = row.diff.effectsComparable || Object.values(effectGroups).some((group) => group && group.rows && group.rows.length);
    const main = row.diff.numericScoreAvailable || row.diff.hasData || hasEffects ? buildComparisonBadge(row, formula, compact, cand, profile) :
      buildOtherBadge(row.diff.effects && row.diff.effects.other && row.diff.effects.other.rows || []);
    if (main) main.dataset.lcView = 'stats';
    return [main].filter(Boolean);
  }

  // ---------- Multi-character badges + panel ----------
  // One-line summary of one profile's comparison, for tooltips and chips.
  function multiResultSummary(result) {
    const name = (result.profile && result.profile.name) || 'Unnamed';
    if (result.empty) return name + ': empty slot';
    const row = result.summary.rows.find((entry) => entry.diff && entry.diff.numericScoreAvailable) || result.summary.rows[0];
    const worn = row && row.target;
    return name + ': ' + (result.summary.numericScoreAvailable ? fmtDelta(result.summary.score) : 'score unavailable') + (worn ? ' vs ' + (worn.name || ('#' + worn.id)) : '');
  }

  function multiComparisonSummary(multi) {
    return multi.results.map(multiResultSummary).join('; ');
  }

  // Collapsed layout: one neutral comparison action opens every selected character.
  function buildMultiComparisonBadges(multi, cand, formula, compact) {
    if (multi && multi.mixedFormulas) {
      const title = 'Comparison unavailable; character scores use different formulas; open each character';
      const badge = buildCompareButton('nomatch', 'Compare', title);
      badge.dataset.lcView = 'stats';
      return [badge];
    }
    const best = multi && multi.best;
    const basis = (best && !best.empty ? best : null) ||
      (multi && multi.results || []).find((result) => result.summary.comparable && !result.empty) ||
      best || (multi && multi.results || []).find((result) => result.summary.comparable);
    if (!basis) return [buildCompareButton('nomatch', 'Compare',
      'Compare item stats and effects for the selected characters')];
    const row = basis.comparison.rows.find((entry) => entry.diff &&
      (entry.diff.comparable || entry.diff.hasData || entry.diff.effectsComparable));
    if (!row) return [buildCompareButton('nomatch', 'Compare', 'Compare item stats and effects; comparison score is unavailable')];
    const verdict = multiVerdict(multi, formula);
    const badge = buildCompareButton(verdict.state, comparisonBadgeText(row, formula, compact),
      comparisonBadgeTitle(row, formula) + '; ' + verdict.explanation);
    badge.dataset.lcView = 'stats';
    const basisName = multi.results.length > 1 && basis.profile
      ? (basis.profile.name || basis.profile.id || 'Unnamed') : '';
    if (basisName) {
      prependBadgeText(badge, basisName + ' ');
    }
    if (best && multi.results.length > 1) {
      const scoredCount = multi.results.filter((result) => result.summary.numericScoreAvailable).length;
      badge.title = (basis === best ? 'Preference-based ordering among ' + scoredCount + ' scored characters' : 'Partial comparison') +
        (scoredCount < multi.results.length ? '; other scores unavailable' : '') +
        '. ' + verdict.explanation + '. Click for each character\'s comparison.';
      badge.setAttribute('aria-label', badge.title);
    }
    if (basisName) {
      badge.title = 'Character ' + basisName + ': ' + badge.title;
      badge.setAttribute('aria-label', badge.title);
    }
    if (cand && basis.profile && row.target) appendDpsMetric(badge, cand, row.target, basis.profile, formula);
    return [badge];
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
          name + ': no worn item in slot ' + (cand.slotKey ? cand.slotKey.key : '?') +
          (result.summary.numericScoreAvailable ? '. Score uses a zero baseline.' : '; score unavailable.'));
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
        if (!row.diff || (!row.diff.comparable && !row.diff.hasData && !row.diff.effectsComparable)) continue;
        for (const badge of buildComparisonBadges(row, formula, compact, cand, result.profile)) {
          if (badge.dataset.lcView === 'stats') prependBadgeText(badge, name + ' ');
          badge.title = name + ': ' + badge.title;
          badge.setAttribute('aria-label', badge.title);
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
        if (!row.diff || (!row.diff.comparable && !row.diff.hasData && !row.diff.effectsComparable)) continue;
        panels.push(buildComparePanel(cand, row.target, row.diff, row.slotKey && row.slotKey.key,
          row.isAugment ? result.comparison.rows : null, index, view, 'worn', result.profile));
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
      const verdict = resultVerdict(result, formula);
      chip.dataset.state = verdict.state;
      chip.textContent = (result.profile && result.profile.name) || 'Unnamed';
      chip.title = multiResultSummary(result) + '; ' + verdict.explanation;
      chip.setAttribute('aria-label', chip.title);
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
    const row = comparison.rows.find((item) => item.diff && (item.diff.comparable || item.diff.hasData));
    if (!comparison.eligible || !row) return;
    const worn = row.target;
    const diff = row.diff;
    const lines = container.querySelectorAll('.lc-stat-line');
    for (const line of lines) {
      const lbl = line.querySelector(':scope > label');
      if (!lbl) continue;
      const key = LC.parser.canonicalStat(lbl.textContent);
      if (!key || NON_STAT_LABELS.has(key)) continue;
      const entry = diff.diffs[key];
      if (!entry || entry.delta == null) continue;
      const { delta, positive, worn: wv } = entry;
      const ind = document.createElement('span');
      ind.className = 'lc-stat-indicator';
      if (delta === 0) {
        ind.dataset.dir = 'zero';
        ind.textContent = '=';
        ind.title = 'Same as ' + (worn && worn.name || 'empty slot');
      } else {
        const isUp = (delta > 0) === positive;
        ind.dataset.dir = isUp ? 'up' : 'down';
        const sign = delta > 0 ? '+' : '';
        ind.textContent = sign + fmtStat(delta);
        ind.title = 'Worn (' + (worn && worn.name || 'item') + '): ' + fmtStat(wv);
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
    buildScoreBreakdown,
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
    registerOutsideClose,
    addStatIndicators,
    statifyItemDetail,
  };
})();
