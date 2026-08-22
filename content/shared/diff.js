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
    if (slotKey.paired) {
      return profile.items.filter((it) => {
        const normalized = it.slotKey || LC.slots.canonicalSlot(it.slot);
        const k = (normalized && normalized.key) || '';
        return k === slotKey.key || k.indexOf(slotKey.key + '-') === 0;
      });
    }
    return profile.items.filter((it) => {
      const normalized = it.slotKey || LC.slots.canonicalSlot(it.slot);
      return normalized && normalized.key === slotKey.key;
    });
  }

  function numericStat(value) {
    const num = value && typeof value === 'object' && 'num' in value ? value.num : parseFloat(value);
    return num != null && !isNaN(num) ? num : null;
  }

  function hasNumericStats(item) {
    return Object.values(item && item.stats || {}).some((value) => numericStat(value) != null);
  }

  function diffItems(cand, worn, formula) {
    const comparable = hasNumericStats(cand) && (worn == null || hasNumericStats(worn));
    if (!comparable) return { diffs: {}, score: 0, worn, formula: formula || SCORE_FORMULAS[0], comparable: false };
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
    const f = formula || SCORE_FORMULAS[0];
    if (f.terms === '__POSITIVE__') {
      for (const k of Object.keys(diffs)) if (diffs[k].positive) score += diffs[k].delta;
    } else {
      for (const k of Object.keys(f.terms)) {
        const d = diffs[k];
        if (d) score += d.delta * f.terms[k];
      }
    }
    return { diffs, score, worn, formula: f, comparable: true };
  }

  function bestComparisonTarget(cand, wornCandidates, formula) {
    if (!wornCandidates.length) return null;
    if (wornCandidates.length === 1) {
      return diffItems(cand, wornCandidates[0], formula).comparable ? wornCandidates[0] : null;
    }
    let best = null, bestScore = -Infinity;
    for (const w of wornCandidates) {
      const d = diffItems(cand, w, formula);
      if (!d.comparable) continue;
      if (d.score > bestScore) { bestScore = d.score; best = w; }
    }
    return best;
  }

  function currentFormula(store) {
    const key = store.get('scoreFormula', DEFAULT_FORMULA_KEY);
    return SCORE_FORMULAS.find((f) => f.key === key) || SCORE_FORMULAS[0];
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
    currentFormula,
  };
})();
