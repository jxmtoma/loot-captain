// Loot Captain - stat diffing + score formulas (shared)

(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};

  const STAT_ORDER = [
    'AC', 'HP', 'Regen', 'MANA', 'ManaRegen', 'END', 'EndRegen', 'ATK',
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
    { key: 'regen', label: 'HP Regen', terms: { Regen: 1 } },
    { key: 'manaregen', label: 'Mana Regen', terms: { ManaRegen: 1 } },
    { key: 'endregen', label: 'End Regen', terms: { EndRegen: 1 } },
    { key: 'netpos', label: 'Net positive', terms: '__POSITIVE__' },
  ].map((formula) => ({ ...formula, version: 1 }));
  const DEFAULT_FORMULA_KEY = 'ac10hp';
  function resolveFormula(profile, fallback) {
    const key = typeof fallback === 'string' ? fallback : fallback && fallback.key;
    const defaultFormula = SCORE_FORMULAS.find((formula) => formula.key === key) || SCORE_FORMULAS[0];
    const selected = profile && profile.scoreFormula;
    if (selected == null) return defaultFormula;
    const formula = SCORE_FORMULAS.find((entry) => entry.key === selected.key && entry.version === selected.version);
    if (formula) return formula;
    return { ...defaultFormula, warning: 'Unsupported character formula ' +
      String(selected.key || '?').slice(0, 80) + ' v' + String(selected.version || '?').slice(0, 20) +
      '; using ' + defaultFormula.key + ' v' + defaultFormula.version };
  }

  const PROC_FAMILIES = [
    ['damage', /\b(?:damage|strike|blast|nuke|dot|burn|harm|decrease current hp)\b/i],
    ['hate', /\b(?:hate|aggro|agro|threat|taunt)\b/i],
    ['stun', /\bstun(?:s|ning)?\b/i],
    ['slow', /\bslow(?:s|ing)?\b/i],
    ['debuff', /\bdebuff(?:s|ing)?\b/i],
    ['heal', /\b(?:heal|healing|restore)\b/i],
    ['mana', /\b(?:mana|mind)\b/i],
    ['root', /\broot(?:s|ing)?\b/i],
    ['snare', /\bsnare(?:s|ing)?\b/i],
    ['silence', /\bsilence(?:s|d)?\b/i],
  ];

  function findWornInSlot(profile, slotKey) {
    if (!profile || !slotKey) return [];
    const keys = slotKey.keys || [slotKey.key];
    return profile.items.filter((it) => {
      if (it.isAugment) return false;
      const normalized = it.slotKey || LC.slots.canonicalSlot(it.slot);
      if (slotKey.paired) {
        const key = (normalized && normalized.key) || '';
        return keys.some((candidate) => key === candidate || key.indexOf(candidate + '-') === 0);
      }
      return normalized && keys.includes(normalized.key);
    });
  }

  function augmentTypesMatch(candidateTypes, wornTypes) {
    if (!candidateTypes.length) return true;
    return wornTypes.length > 0 && candidateTypes.some((type) => wornTypes.includes(type));
  }

  function findWornAugments(profile, slotKey, damageAugment, candidateTypes) {
    if (!profile || !slotKey) return [];
    const allowedKeys = slotKey.keys || [slotKey.key];
    return profile.items.filter((item) => {
      if (!item.isAugment || hasDamageModifier(item) !== damageAugment) return false;
      if (!augmentTypesMatch(candidateTypes, item.augmentTypes || [])) return false;
      const normalized = item.slotKey || LC.slots.canonicalSlot(item.slot);
      const wornKeys = normalized && (normalized.keys || [normalized.key]);
      return wornKeys && allowedKeys.some((key) => wornKeys.includes(key));
    });
  }

  function numericStat(value) {
    return LC.parser.normalizeStatValue(value).num;
  }

  function isDiffStatKey(key) {
    return !/^(?:slot|class|race|type|deity|skill|effect|click|worn|proc|focus|tools|required|restriction|lore|aug)/i.test(String(key || '').trim());
  }

  function hasDamageModifier(item) {
    return Object.entries(item && item.stats || {}).some(([key, value]) => {
      const canonical = LC.parser && LC.parser.canonicalStat ? LC.parser.canonicalStat(key) : key;
      return canonical === 'Damage' && numericStat(value) != null;
    });
  }

  function hasNumericStats(item) {
    return Object.entries(item && item.stats || {}).some(([key, value]) => isDiffStatKey(key) && numericStat(value) != null);
  }

  function itemEffects(item, type) {
    const slot = item && (item.slotKey || LC.slots.canonicalSlot(item.slot));
    if (type === 'focus' && item && (item.isAugment || (slot && (slot.keys || [slot.key]).includes('powersource')))) return [];
    return (item && Array.isArray(item.effects) ? item.effects : [])
      .filter((effect) => !type || effect.type === type)
      .map((effect) => ({ ...effect, source: item && item.name || '', sourceItem: item }));
  }

  function effectFamily(effect) {
    if (!effect || effect.type !== 'proc') return '';
    const text = [effect.name, effect.raw].filter(Boolean).join(' ');
    return (PROC_FAMILIES.find(([, pattern]) => pattern.test(text)) || ['unknown'])[0];
  }

  function effectSimilarity(a, b) {
    return LC.parser && LC.parser.effectSimilarity ? LC.parser.effectSimilarity(a, b) : (a.key === b.key ? 1 : 0);
  }

  function focusPolarity(effect) {
    const text = String(effect && (effect.name || effect.raw) || '');
    if (/\bbeneficial\b/i.test(text)) return 'beneficial';
    if (/\bdetrimental\b/i.test(text)) return 'detrimental';
    return '';
  }

  function canMatchEffects(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'focus') {
      const leftPolarity = focusPolarity(a);
      const rightPolarity = focusPolarity(b);
      if (leftPolarity && rightPolarity && leftPolarity !== rightPolarity) return false;
    }
    if (a.key === b.key) return true;
    if (a.type === 'proc') {
      const leftFamily = effectFamily(a);
      const rightFamily = effectFamily(b);
      if (leftFamily === 'unknown' || leftFamily !== rightFamily) return false;
      if (leftFamily === 'damage' && procDamage(a) != null && procDamage(b) != null) return true;
    }
    return effectSimilarity(a, b) >= (a.type === 'focus' ? 0.75 : 0.5);
  }

  function sameEffectRank(a, b) {
    return a.rank == null || b.rank == null ? true : String(a.rank) === String(b.rank);
  }

  function bestEffectMatch(effect, effects) {
    let best = null;
    for (let index = 0; index < effects.length; index++) {
      const candidate = effects[index];
      if (!canMatchEffects(effect, candidate)) continue;
      const score = effectSimilarity(effect, candidate);
      if (!best || score > best.score) best = { index, effect: candidate, score };
    }
    return best;
  }

  function focusPotency(effect) {
    const text = String(effect && (effect.raw || effect.name) || '');
    const levelMatch = text.match(/\bL\s*(\d+)\b/i);
    if (!levelMatch) return null;
    const prefix = text.slice(0, levelMatch.index).trim();
    const range = prefix.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*%?\s*$/);
    const single = prefix.match(/(-?\d+(?:\.\d+)?)\s*%?\s*$/);
    if (!range && !single) return null;
    return {
      level: parseInt(levelMatch[1], 10),
      min: parseFloat(range ? range[1] : single[1]),
      max: parseFloat(range ? range[2] : single[1]),
    };
  }

  function compareFocusPotency(candidate, current) {
    const candidatePower = focusPotency(candidate);
    const currentPower = focusPotency(current);
    if (!candidatePower || !currentPower) return null;
    const level = Math.max(candidatePower.level, currentPower.level);
    const adjust = (power) => {
      const loss = Math.max(0, level - power.level) * 5;
      return { min: Math.max(0, power.min - loss), max: Math.max(0, power.max - loss) };
    };
    const candidateEffective = adjust(candidatePower);
    const currentEffective = adjust(currentPower);
    const delta = candidateEffective.max !== currentEffective.max
      ? candidateEffective.max - currentEffective.max
      : candidateEffective.min - currentEffective.min;
    return { level, current: currentEffective, candidate: candidateEffective, direction: Math.sign(delta) };
  }

  function strongestFocus(effects) {
    return effects.reduce((best, effect) => {
      if (!best) return effect;
      const comparison = compareFocusPotency(effect, best);
      return comparison && comparison.direction > 0 ? effect : best;
    }, null);
  }

  function compareFocusEffects(profile, cand, worn) {
    const candidate = itemEffects(cand, 'focus');
    const target = itemEffects(worn, 'focus');
    const other = (profile.items || []).filter((item) => item !== worn).flatMap((item) => itemEffects(item, 'focus'));
    const remainingTarget = [...target];
    const rows = [];
    for (const effect of candidate) {
      const currentMatches = [...other, ...target].filter((current) => canMatchEffects(effect, current));
      if (!currentMatches.length) {
        rows.push({ status: 'added', direction: 1, current: null, candidate: effect });
        continue;
      }
      const currentBest = strongestFocus(currentMatches);
      const otherMatches = other.filter((current) => canMatchEffects(effect, current));
      const finalBest = strongestFocus([effect, ...otherMatches]);
      const comparison = compareFocusPotency(finalBest, currentBest);
      const displayComparison = compareFocusPotency(effect, currentBest);
      for (let index = remainingTarget.length - 1; index >= 0; index--) {
        if (canMatchEffects(effect, remainingTarget[index])) remainingTarget.splice(index, 1);
      }
      let status;
      let direction = comparison && comparison.direction || 0;
      if (finalBest.sourceItem !== cand) {
        status = 'covered';
        direction = 0;
      } else if (comparison) {
        status = direction === 0 ? (currentBest.sourceItem === worn ? 'same' : 'covered') : 'changed';
      } else {
        status = sameEffectRank(effect, currentBest) ? (currentBest.sourceItem === worn ? 'same' : 'covered') : 'changed';
      }
      rows.push({ status, direction, focusComparison: displayComparison, current: currentBest, candidate: effect });
    }
    for (const effect of remainingTarget) {
      if (!other.some((current) => canMatchEffects(effect, current))) {
        rows.push({ status: 'removed', direction: -1, current: effect, candidate: null });
      }
    }
    return { rows, comparable: candidate.length > 0 || target.length > 0 };
  }

  function procDamage(effect) {
    const text = String(effect && (effect.raw || effect.name) || '');
    const matches = [...text.matchAll(/Decrease Current HP by\s+(-?\d+(?:\.\d+)?)/gi)];
    return matches.length ? matches.reduce((total, match) => total + Math.abs(parseFloat(match[1])), 0) : null;
  }

  function compareProcDamage(candidate, current) {
    const candidateDamage = procDamage(candidate);
    const currentDamage = procDamage(current);
    if (candidateDamage == null || currentDamage == null) return null;
    return { current: currentDamage, candidate: candidateDamage, direction: Math.sign(candidateDamage - currentDamage) };
  }

  function compareEffectType(profile, cand, worn, type) {
    if (type === 'focus') return compareFocusEffects(profile, cand, worn);
    const candidate = itemEffects(cand, type);
    const target = itemEffects(worn, type);
    const other = type === 'focus' ? (profile.items || [])
      .filter((item) => item !== worn)
      .flatMap((item) => itemEffects(item, type)) : [];
    const remainingOther = [...other];
    const remainingTarget = [...target];
    const rows = [];
    for (const effect of candidate) {
      const covered = bestEffectMatch(effect, remainingOther);
      if (covered) {
        remainingOther.splice(covered.index, 1);
        rows.push({ status: 'covered', current: covered.effect, candidate: effect });
        continue;
      }
      const match = bestEffectMatch(effect, remainingTarget);
      if (match) {
        remainingTarget.splice(match.index, 1);
        const procComparison = type === 'proc' ? compareProcDamage(effect, match.effect) : null;
        rows.push({
          status: procComparison ? (procComparison.direction === 0 ? 'same' : 'changed') :
            (sameEffectRank(effect, match.effect) ? 'same' : 'changed'),
          direction: procComparison && procComparison.direction || 0,
          procComparison,
          current: match.effect,
          candidate: effect,
        });
      } else {
        rows.push({ status: 'added', current: null, candidate: effect });
      }
    }
    for (const effect of remainingTarget) rows.push({ status: 'removed', current: effect, candidate: null });
    if (type === 'proc') {
      const added = rows.filter((row) => row.status === 'added');
      const removed = rows.filter((row) => row.status === 'removed');
      for (let i = 0; i < Math.min(added.length, removed.length); i++) {
        added[i].status = 'different';
        added[i].current = removed[i].current;
        rows.splice(rows.indexOf(removed[i]), 1);
      }
    }
    return { rows, comparable: candidate.length > 0 || target.length > 0 };
  }

  function compareInformationalEffects(cand, worn) {
    const informational = (item) => (item && item.effects || []).filter((effect) => !['focus', 'proc'].includes(effect.type));
    const remaining = [...informational(worn)];
    const rows = informational(cand).map((effect) => {
      const index = remaining.findIndex((other) => other.type === effect.type &&
        (other.kind || '') === (effect.kind || '') &&
        (other.key && other.key === effect.key && effect.type !== 'unknown' || other.name === effect.name));
      const current = index < 0 ? null : remaining.splice(index, 1)[0];
      return { type: effect.type, current, candidate: effect,
        status: current ? (current.rank === effect.rank && current.raw === effect.raw ? 'same' : 'changed') :
          (!worn || worn.effectsKnown === true ? 'added' : 'unresolved') };
    });
    for (const current of remaining) rows.push({ type: current.type, current, candidate: null,
      status: cand.effectsKnown === true ? 'removed' : 'unresolved' });
    return { rows, comparable: rows.length > 0,
      complete: cand.effectsKnown === true && (!worn || worn.effectsKnown === true) };
  }

  function compareEffects(profile, cand, worn) {
    const focus = compareEffectType(profile, cand, worn, 'focus');
    const proc = compareEffectType(profile, cand, worn, 'proc');
    const other = compareInformationalEffects(cand, worn);
    return { focus, proc, other, comparable: focus.comparable || proc.comparable || other.comparable };
  }

  function weaponRatio(item) {
    const normalized = item && (item.slotKey || LC.slots.canonicalSlot(item.slot));
    const keys = normalized && (normalized.keys || [normalized.key]);
    if (!keys || !keys.some((key) => ['primary', 'secondary', 'range'].includes(key))) return null;
    const damage = numericStat(item.stats && item.stats.Damage);
    const delay = numericStat(item.stats && item.stats.Delay);
    const ratio = damage != null && delay > 0 ? damage / delay : null;
    return ratio != null && Number.isFinite(ratio) ? ratio : null;
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
    const candidateStats = LC.parser.normalizeStats(cand && cand.stats || {});
    const wornStats = LC.parser.normalizeStats(worn && worn.stats || {});
    const diffs = Object.create(null);
    const allKeys = new Set([
      ...Object.keys(candidateStats),
      ...Object.keys(wornStats),
      ...(f.terms === '__POSITIVE__' ? POSITIVE_STATS : Object.keys(f.terms)),
    ].filter(isDiffStatKey));
    for (const k of allKeys) {
      const c = numericStat(candidateStats[k]);
      const w = worn == null ? 0 : numericStat(wornStats[k]);
      const delta = c == null || w == null || !Number.isFinite(c - w) ? null : c - w;
      diffs[k] = {
        worn: w == null ? null : w,
        cand: c == null ? null : c,
        delta,
        positive: POSITIVE_STATS.has(k),
      };
    }
    const missingScoreStats = [];
    const scoreTerms = f.terms === '__POSITIVE__' ? [...POSITIVE_STATS].reduce((terms, key) => {
      terms[key] = 1;
      return terms;
    }, {}) : f.terms;
    for (const k of Object.keys(scoreTerms)) {
      if (!diffs[k] || diffs[k].delta == null) missingScoreStats.push(k);
    }
    let numericScoreAvailable = missingScoreStats.length === 0;
    let score = numericScoreAvailable ? 0 : null;
    if (f.terms === '__POSITIVE__') {
      if (numericScoreAvailable) for (const k of POSITIVE_STATS) score += diffs[k].delta;
    } else {
      if (numericScoreAvailable) for (const k of Object.keys(f.terms)) score += diffs[k].delta * f.terms[k];
    }
    if (numericScoreAvailable && !Number.isFinite(score)) {
      numericScoreAvailable = false;
      score = null;
      missingScoreStats.push('score');
    }
    const comparable = Object.values(diffs).some((diff) => diff.delta != null);
    const hasData = [...Object.keys(candidateStats), ...Object.keys(wornStats)].some(isDiffStatKey);
    const candRatio = weaponRatio(cand);
    const wornRatio = worn && weaponRatio(worn);
    const ratioDelta = candRatio != null && (!worn || wornRatio != null) ? candRatio - (wornRatio || 0) : null;
    const weaponRatioDelta = ratioDelta != null && Number.isFinite(ratioDelta) ? ratioDelta : null;
    return {
      diffs, score, weaponRatioDelta, worn, formula: f, comparable, hasData,
      numericScoreAvailable, missingScoreStats,
    };
  }

  function bestComparisonTarget(cand, wornCandidates, formula) {
    if (!wornCandidates.length) return null;
    if (wornCandidates.length === 1) return wornCandidates[0];
    let best = null, bestScore = -Infinity;
    for (const w of wornCandidates) {
      const d = diffItems(cand, w, formula);
      if (!d.numericScoreAvailable) return wornCandidates[0];
      if (d.score > bestScore) { bestScore = d.score; best = w; }
    }
    return best;
  }

  function compareCandidate(profile, cand, formula) {
    formula = resolveFormula(profile, formula);
    if (!profile || !cand || !cand.slotKey) return { eligible: false, rows: [] };
    if (LC.parser && !LC.parser.classMatches(profile.cls, cand.classes)) return { eligible: false, rows: [] };
    if (cand.isAugment) {
      const damageAugment = hasDamageModifier(cand);
      const matches = findWornAugments(profile, cand.slotKey, damageAugment, cand.augmentTypes || [])
        .map((worn) => {
          const effects = compareEffects(profile, cand, worn);
          return { worn, diff: { ...diffItems(cand, worn, formula), effects, effectsComparable: effects.comparable } };
        })
        .sort((a, b) => {
          if (a.diff.numericScoreAvailable !== b.diff.numericScoreAvailable) return a.diff.numericScoreAvailable ? -1 : 1;
          if (!a.diff.numericScoreAvailable) return 0;
          return b.diff.score - a.diff.score;
        });
      if (!matches.length) return { eligible: false, rows: [] };
      return {
        eligible: true,
        rows: matches.map((match) => ({
          slotKey: match.worn.slotKey || LC.slots.canonicalSlot(match.worn.slot),
          worn: [match.worn],
          target: match.worn,
          diff: match.diff,
          isAugment: true,
          compatibleSlots: cand.slotKey.keys || [cand.slotKey.key],
        })),
      };
    }
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
      const numeric = diffItems(cand, target, formula);
      const effects = compareEffects(profile, cand, target);
      return { slotKey, worn, target, diff: { ...numeric, effects, effectsComparable: effects.comparable } };
    });
    return { eligible: true, rows };
  }

  function compareItemPair(cand, target, formula, level, profile) {
    formula = resolveFormula(profile, formula);
    const effects = compareEffects({ level, items: target ? [target] : [] }, cand, target);
    return { ...diffItems(cand, target, formula), effects, effectsComparable: effects.comparable };
  }

  function wishlistComparisonDirection(cand, targets, formula, level) {
    const comparisons = (targets || []).map((target) => compareItemPair(cand, target, formula, level));
    if (!comparisons.length || comparisons.some((diff) => !diff.numericScoreAvailable)) return 0;
    const directions = comparisons.map((diff) => Math.sign(diff.score));
    if (directions.length && directions.every((direction) => direction > 0)) return 1;
    if (directions.length && directions.every((direction) => direction < 0)) return -1;
    return 0;
  }

  function summarizeComparisons(comparison) {
    const rows = comparison.rows || [];
    const comparable = comparison.eligible && rows.some((row) =>
      row.diff && (row.diff.comparable || row.diff.hasData || row.diff.effectsComparable));
    const numericScoreAvailable = comparison.eligible && rows.length > 0 && rows.every((row) =>
      row.diff && row.diff.numericScoreAvailable);
    const missingScoreStats = [...new Set(rows.flatMap((row) => row.diff && row.diff.missingScoreStats || []))];
    return {
      comparable,
      hasWorn: rows.some((row) => row.worn && row.worn.length),
      hasEffects: rows.some((row) => row.diff && row.diff.effectsComparable),
      numericScoreAvailable,
      missingScoreStats,
      score: numericScoreAvailable ? (rows[0].isAugment ? rows[0].diff.score : rows.reduce((sum, row) => sum + row.diff.score, 0)) : null,
      rows,
    };
  }

  // Compares one candidate across several profiles. Every eligible profile
  // gets a result (comparable or not, so callers can tell "empty slot" apart
  // from "unresolved stats"). `best` is the profile with the highest
  // available numeric score, preferring profiles that actually wear something in the
  // slot; ties keep the earlier (active) profile.
  function compareCandidateMulti(profiles, cand, formula) {
    const results = [];
    for (const profile of profiles || []) {
      const comparison = compareCandidate(profile, cand, formula);
      if (!comparison.eligible) continue;
      const summary = summarizeComparisons(comparison);
      results.push({ profile, comparison, summary, empty: !summary.hasWorn && !summary.hasEffects });
    }
    const formulas = results.map((result) => resolveFormula(result.profile, formula));
    const mixedFormulas = new Set(formulas.map((entry) => entry.key + ':' + entry.version)).size > 1 ||
      formulas.some((entry) => entry.warning);
    const comparable = mixedFormulas ? [] : results.filter((result) => result.summary.numericScoreAvailable);
    const worn = comparable.filter((result) => !result.empty);
    const pool = worn.length ? worn : comparable;
    let best = null;
    for (const result of pool) {
      if (!best || result.summary.score > best.summary.score) best = result;
    }
    return { results, best, mixedFormulas };
  }

  LC.diff = {
    STAT_ORDER,
    POSITIVE_STATS,
    SCORE_FORMULAS,
    resolveFormula,
    DEFAULT_FORMULA_KEY,
    findWornInSlot,
    findWornAugments,
    hasNumericStats,
    diffItems,
    bestComparisonTarget,
    compareCandidate,
    compareCandidateMulti,
    compareItemPair,
    wishlistComparisonDirection,
    summarizeComparisons,
    compareEffects,
    weaponType,
    numericStat,
  };
})();
