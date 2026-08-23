// Loot Captain - stat diffing + score formulas (shared)

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};

  const STAT_ORDER = [
    'AC', 'HP', 'MANA', 'END', 'ATK',
    'HSta', 'HStr', 'HAgi', 'HDex', 'HInt', 'HWis', 'HCha',
    'STA', 'STR', 'AGI', 'DEX', 'INT', 'WIS', 'CHA',
    'SV FIRE', 'SV COLD', 'SV MAGIC', 'SV POISON', 'SV DISEASE', 'SV CORRUPT',
    'Heroics', 'Heal Amount', 'Spell Dmg', 'Clairvoyance',
    'Purity', 'Luck', 'Haste', 'Damage', 'Delay', 'Range',
  ];
  const POSITIVE_STATS = new Set([
    'AC', 'HP', 'MANA', 'END', 'ATK',
    'HSta', 'HStr', 'HAgi', 'HDex', 'HInt', 'HWis', 'HCha',
    'STA', 'STR', 'AGI', 'DEX', 'INT', 'WIS', 'CHA',
    'SV FIRE', 'SV COLD', 'SV MAGIC', 'SV POISON', 'SV DISEASE', 'SV CORRUPT',
    'Heroics', 'Heal Amount', 'Spell Dmg', 'Clairvoyance',
    'Purity', 'Luck', 'Haste', 'Damage', 'Range',
    'Regen', 'ManaRegen', 'EndRegen',
  ]);

  const SCORE_FORMULAS = [
    { key: 'ac10hp', label: '1AC=10HP', terms: { HP: 1, AC: 10 } },
    { key: 'ac15hp', label: '1AC=15HP', terms: { HP: 1, AC: 15 } },
    { key: 'hdex', label: '1HDex=4AC=40HP', terms: { HP: 1, AC: 10, HDex: 40 } },
    { key: 'hagi', label: '1HAgi=4AC=40HP', terms: { HP: 1, AC: 10, HAgi: 40 } },
    { key: 'hp', label: 'HP', terms: { HP: 1 } },
    { key: 'mana', label: 'Mana', terms: { MANA: 1 } },
    { key: 'end', label: 'Endurance', terms: { END: 1 } },
    { key: 'endregen', label: 'End Regen', terms: { EndRegen: 1 } },
    { key: 'netpos', label: 'Net positive', terms: '__POSITIVE__' },
  ];
  const DEFAULT_FORMULA_KEY = 'ac10hp';

  function findWornInSlot(profile, slotKey) {
    if (!profile || !slotKey) return [];
    const keys = slotKey.keys || [slotKey.key];
    if (slotKey.paired) {
      return profile.items.filter((it) => {
        const normalized = it.slotKey || LC.slots.canonicalSlot(it.slot);
        const k = (normalized && normalized.key) || '';
        return keys.some((key) => k === key || k.indexOf(key + '-') === 0);
      });
    }
    return profile.items.filter((it) => {
      const normalized = it.slotKey || LC.slots.canonicalSlot(it.slot);
      return normalized && keys.includes(normalized.key);
    });
  }

  function numericStat(value) {
    const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
    return num != null && !isNaN(num) ? num : null;
  }

  function hasNumericStats(item) {
    return Object.values(item && item.stats || {}).some((value) => numericStat(value) != null);
  }

  function weaponRatio(item) {
    const normalized = item && (item.slotKey || LC.slots.canonicalSlot(item.slot));
    const keys = normalized && (normalized.keys || [normalized.key]);
    if (!keys || !keys.some((key) => ['primary', 'secondary', 'range'].includes(key))) return null;
    const damage = numericStat(item.stats && item.stats.Damage);
    const delay = numericStat(item.stats && item.stats.Delay);
    return damage != null && delay > 0 ? damage / delay : null;
  }

  function weaponType(item) {
    const normalized = item && (item.slotKey || LC.slots.canonicalSlot(item.slot));
    const keys = normalized && (normalized.keys || [normalized.key]);
    if (!keys || weaponRatio(item) == null) return null;
    if (keys.includes('range')) return 'range';
    if (keys.includes('primary') && keys.includes('secondary')) return 'one-hand';
    if (keys.length === 1 && keys[0] === 'primary') return 'two-hand';
    return null;
  }

  function diffItems(cand, worn, formula) {
    const f = formula || SCORE_FORMULAS[0];
    const comparable = hasNumericStats(cand) && (worn == null || hasNumericStats(worn));
    if (!comparable) return { diffs: {}, score: 0, worn, formula: f, comparable: false };
    const diffs = {};
    const allKeys = new Set([
      ...Object.keys(cand.stats || {}),
      ...Object.keys((worn && worn.stats) || {}),
    ]);
    for (const k of allKeys) {
      const c = numericStat(cand.stats && cand.stats[k]);
      const w = numericStat(worn && worn.stats && worn.stats[k]);
      if (c == null && w == null) continue;
      const delta = (c || 0) - (w || 0);
      diffs[k] = {
        worn: w == null ? null : w,
        cand: c == null ? null : c,
        delta,
        positive: POSITIVE_STATS.has(k),
      };
    }
    let score = 0;
    if (f.terms === '__POSITIVE__') {
      for (const k of Object.keys(diffs)) if (diffs[k].positive) score += diffs[k].delta;
    } else {
      for (const k of Object.keys(f.terms)) {
        const d = diffs[k];
        if (d) score += d.delta * f.terms[k];
      }
    }
    const candRatio = weaponRatio(cand);
    const wornRatio = worn && weaponRatio(worn);
    const weaponRatioDelta = candRatio != null && (!worn || wornRatio != null) ? candRatio - (wornRatio || 0) : null;
    return { diffs, score, weaponRatioDelta, worn, formula: f, comparable: true };
  }

  function bestComparisonTarget(cand, wornCandidates, formula) {
    if (!wornCandidates.length) return null;
    if (wornCandidates.length === 1) {
      return diffItems(cand, wornCandidates[0], formula).comparable ? wornCandidates[0] : null;
    }
    let best = null, bestScore = -Infinity;
    for (const w of wornCandidates) {
      const d = diffItems(cand, w, formula);
      if (!d.comparable) return null;
      if (d.score > bestScore) { bestScore = d.score; best = w; }
    }
    return best;
  }

  function compareCandidate(profile, cand, formula) {
    if (!profile || !cand || !cand.slotKey) return { eligible: false, rows: [] };
    if (LC.parser && !LC.parser.classMatches(profile.cls, cand.classes)) return { eligible: false, rows: [] };
    const type = weaponType(cand);
    let slotKeys;
    if (type === 'one-hand' || type === 'two-hand') {
      const secondary = findWornInSlot(profile, LC.slots.canonicalSlot('secondary'));
      const currentType = secondary.length ? 'one-hand' : 'two-hand';
      if (type !== currentType) return { eligible: false, rows: [] };
      slotKeys = type === 'one-hand' ? ['primary', 'secondary'] : ['primary'];
    } else if (type === 'range') {
      slotKeys = ['range'];
    } else {
      const keys = cand.slotKey.keys || [cand.slotKey.key];
      slotKeys = cand.slotKey.paired ? [cand.slotKey.key] : keys;
    }
    const rows = slotKeys.map((key) => {
      const slotKey = typeof key === 'string' ? LC.slots.canonicalSlot(key) : key;
      const worn = findWornInSlot(profile, slotKey);
      const target = bestComparisonTarget(cand, worn, formula);
      return { slotKey, worn, target, diff: target ? diffItems(cand, target, formula) : null };
    });
    return { eligible: true, rows };
  }

  function summarizeComparisons(comparison) {
    const rows = comparison.rows || [];
    const comparable = comparison.eligible && rows.length > 0 && rows.every((row) => row.diff && row.diff.comparable);
    return {
      comparable,
      hasWorn: rows.some((row) => row.worn && row.worn.length),
      score: comparable ? rows.reduce((sum, row) => sum + row.diff.score, 0) : 0,
      rows,
    };
  }

  LC.diff = {
    STAT_ORDER,
    POSITIVE_STATS,
    SCORE_FORMULAS,
    DEFAULT_FORMULA_KEY,
    findWornInSlot,
    hasNumericStats,
    diffItems,
    bestComparisonTarget,
    compareCandidate,
    summarizeComparisons,
    weaponType,
  };
})();
