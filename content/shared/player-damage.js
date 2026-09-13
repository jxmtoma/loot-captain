// Level-100 Beastlord/Wizard player-damage reference contribution models.
// Reference arithmetic only; this is not a retail combat simulator.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const RULE_V2 = Object.freeze({ key: 'bst-player-damage-reference', version: 2,
    name: 'Level-100 Beastlord player melee and weapon-proc reference estimate' });
  const RULE = Object.freeze({ key: 'bst-player-damage-reference', version: 3,
    name: 'Level-100 Beastlord player melee, weapon-proc and spell reference estimate' });
  const WIZARD_RULE = Object.freeze({ key: 'wiz-hoarfrost-damage-reference', version: 3,
    name: 'Level-100 Wizard direct cold spell-only reference estimate' });
  const SPELL_ONLY_RULES = Object.freeze({
    'wizard-hoarfrost': WIZARD_RULE,
    'magician-spear': Object.freeze({ key: 'mag-spear-damage-reference', version: 3, name: 'Level-100 Magician direct fire spell-only reference estimate' }),
    'enchanter-mindcleave': Object.freeze({ key: 'enc-mindcleave-damage-reference', version: 3, name: 'Level-100 Enchanter direct spell-only reference estimate' }),
    'necro-pyre': Object.freeze({ key: 'nec-pyre-damage-reference', version: 3, name: 'Level-100 Necromancer bounded fire DoT reference estimate' }),
  });
  const SPELL_MODEL_BY_CLASS = Object.freeze({
    beastlord: 'beastlord', bst: 'beastlord', wizard: 'wizard-hoarfrost', wiz: 'wizard-hoarfrost',
    magician: 'magician-spear', mag: 'magician-spear', enchanter: 'enchanter-mindcleave', enc: 'enchanter-mindcleave',
    necromancer: 'necro-pyre', nec: 'necro-pyre',
  });
  const MELEE_MODEL_BY_CLASS = Object.freeze({
    berserker: 'berserker-base-melee', ber: 'berserker-base-melee',
    monk: 'monk-base-melee', mnk: 'monk-base-melee',
    rogue: 'rogue-base-melee', rog: 'rogue-base-melee',
  });
  const MELEE_ONLY_RULES = Object.freeze({
    'berserker-base-melee': Object.freeze({ key: 'ber-base-melee-reference', version: 3, name: 'Level-100 Berserker base melee reference estimate', source: { label: 'RaidLoot Berserker spell list', url: 'https://www.raidloot.com/spells/berserker' } }),
    'monk-base-melee': Object.freeze({ key: 'mnk-base-melee-reference', version: 3, name: 'Level-100 Monk base melee reference estimate', source: { label: 'RaidLoot Monk spell list', url: 'https://www.raidloot.com/spells/monk' } }),
    'rogue-base-melee': Object.freeze({ key: 'rog-base-melee-reference', version: 3, name: 'Level-100 Rogue base melee reference estimate', source: { label: 'RaidLoot Rogue spell list', url: 'https://www.raidloot.com/spells/rogue' } }),
  });
  const HANDS = ['primary', 'secondary'];
  const FAMILIES = new Set(['cleave', 'ferocity']);
  const EFFECT_TYPES = new Set(['worn', 'proc', 'focus', 'click']);
  const MODEL_SOURCES = Object.freeze([
    { label: 'EQEmu attack.cpp RollD20/offense reference', url: 'https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/attack.cpp' },
    { label: 'EQEmu bonuses.cpp critical/double-attack reference', url: 'https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/bonuses.cpp' },
    { label: 'EQEmu random.h Roll0 reference', url: 'https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/common/random.h' },
    { label: 'EQEmu effects.cpp extra spell damage reference', url: 'https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/effects.cpp#L365' },
  ]);
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function fail(reason) { throw new Error(reason); }
  function number(value) {
    const raw = value && typeof value === 'object' && own(value, 'num') ? value.num : value;
    if (finite(raw)) return raw;
    if (typeof raw === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())) {
      const parsed = Number(raw); return finite(parsed) ? parsed : null;
    }
    return null;
  }
  function canonical(name) {
    const key = String(name || '').trim().toUpperCase().replace(/[\s_]+/g, '');
    return ({ ATTACK: 'ATK', STRENGTH: 'STR', DEXTERITY: 'DEX', HSTR: 'HSTR', HDEX: 'HDEX' })[key] || key;
  }
  function stat(item, wanted) {
    const stats = item && item.stats;
    if (!stats || typeof stats !== 'object') return 0;
    const key = canonical(wanted);
    const entry = Object.entries(stats).find(([name]) => canonical(name) === key);
    if (entry) return number(entry[1]);
    const sources = Object.values(stats).map((value) => value && typeof value === 'object' ? value.source : 'legacy');
    return sources.includes('opendkp') && !sources.includes('raidloot') ? null : 0;
  }
  function statTotal(profile, wanted) {
    let total = 0;
    const unresolved = [];
    for (const item of profile && profile.items || []) {
      const value = stat(item, wanted);
      if (value === null) unresolved.push(item && item.name || 'unnamed item');
      else total += value;
    }
    return finite(total) && !unresolved.length ? { value: total, available: true } :
      { value: null, available: false, unresolved: unresolved.map((name) => wanted + ' on ' + name) };
  }
  function slotKeys(item) {
    const canonicalSlot = typeof parserCanonicalSlot === 'function' ? parserCanonicalSlot :
      LC.slots && LC.slots.canonicalSlot;
    const rawSlot = item && (item.slot || (item.slotKey && (item.slotKey.keys || [item.slotKey.key]).join(',') || item.slotKey));
    const slot = canonicalSlot && canonicalSlot(rawSlot);
    if (!slot) return null;
    return new Set(slot.keys || [slot.key]);
  }
  function isWeapon(item) {
    const read = LC.dps && LC.dps.weaponNumeric;
    const damage = typeof read === 'function' ? read(item, 'Damage') : stat(item, 'Damage');
    const delay = typeof read === 'function' ? read(item, 'Delay') : stat(item, 'Delay');
    return damage !== null && delay !== null && damage >= 0 && delay > 0;
  }
  function weaponLike(item) {
    return Object.keys(item && item.stats || {}).some((name) => ['DAMAGE', 'DMG', 'DELAY'].includes(canonical(name)));
  }
  function identity(left, right) {
    if (left === right) return true;
    if (!left || !right) return false;
    const leftId = String(left.id || '').trim(), rightId = String(right.id || '').trim();
    if (leftId && rightId) return leftId === rightId;
    return String(left.name || '').trim() === String(right.name || '').trim() &&
      String(left.slot || '').trim() === String(right.slot || '').trim();
  }
  function wornIndex(profile, worn) {
    const exact = profile.items.findIndex((item) => item === worn);
    if (exact >= 0) return exact;
    const matches = profile.items.map((item, index) => identity(item, worn) ? index : -1).filter((index) => index >= 0);
    if (matches.length !== 1) fail(matches.length ? 'Worn item matches multiple equipment entries' : 'Worn item is not in the character equipment');
    return matches[0];
  }
  function catalog() {
    return LC.damageCatalog || {};
  }
  function resolveWorn(effect) {
    const fn = catalog().resolveWorn;
    return typeof fn === 'function' ? fn(effect) : null;
  }
  function resolveProc(effect) {
    const fn = catalog().resolveProc;
    return typeof fn === 'function' ? fn(effect) : null;
  }
  function resolveFocus(effect) {
    const fn = catalog().resolveFocus;
    return typeof fn === 'function' ? fn(effect) : null;
  }
  function spellRotation(rank, model) {
    const fn = catalog().spellRotation;
    return typeof fn === 'function' ? fn(rank, model) : null;
  }
  function normalized(value) { return String(value == null ? '' : value).trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' '); }
  function spellFocusLoadout(profile, confirmation) {
    const unresolved = [], sources = [], focus = [];
    const complete = confirmation.spellFocusComplete === true || (profile.items || []).every((item) => item && item.effectsKnown === true);
    for (const item of profile.items || []) {
      for (const effect of Array.isArray(item.effects) ? item.effects : []) {
        const type = String(effect && effect.type || '').toLowerCase();
        if (['proc', 'worn', 'click'].includes(type)) continue;
        if (type !== 'focus') { unresolved.push('Unknown spell-focus effect ' + String(effect && effect.name || 'unknown')); continue; }
        const resolved = resolveFocus(effect);
        if (resolved && resolved.spellId && resolved.name && number(resolved.flatDamage) !== null &&
            resolved.flatDamage >= 0 && resolved.critScaled === true &&
            Array.isArray(resolved.eligibleSpellIds) && resolved.eligibleSpellIds.length &&
            resolved.eligibleSpellIds.every((id) => Number.isInteger(id) && id > 0)) {
          focus.push(resolved); if (resolved.source) sources.push(resolved.source);
          continue;
        }
        const values = resolved && ['minPct', 'maxPct', 'maxLevel', 'decayPctPerLevel'].map((key) => number(resolved[key]));
        if (!resolved || !resolved.spellId || !resolved.name || !resolved.resist || !values ||
            values.some((value) => value === null) || values[1] < values[0] || values[2] < 0 || values[3] < 0) {
          unresolved.push('Unresolved spell-focus effect ' + String(effect && effect.name || effect && effect.key || 'unknown')); continue;
        }
        const value = { ...resolved, minPct: values[0], maxPct: values[1], maxLevel: values[2], decayPctPerLevel: values[3], resist: normalized(resolved.resist) };
        focus.push(value); if (value.source) sources.push(value.source);
      }
    }
    return { complete, focus, unresolved, sources };
  }
  function spellStatTotal(profile) {
    const total = statTotal(profile, 'Spell Dmg');
    if (total.available && total.value < 0) return { value: null, available: false, unresolved: ['Negative Spell Dmg is outside the reference model.'] };
    return total;
  }
  function spellExtra(totalSpellDmg, spell) {
    const totalMs = 1000 * (spell.castSeconds + Math.max(spell.recastSeconds, spell.recoverySeconds || 0));
    // Pinned EQEmu GetExtraSpellAmt reference, not retail calibration.
    const extra = totalMs <= 2500 ? totalSpellDmg * .25 : totalMs < 7000
      ? totalSpellDmg * .167 * Math.floor((totalMs - 1000) / 1000) : totalSpellDmg * totalMs / 7000;
    return Math.min(Math.floor(extra), Math.floor(spell.baseDamage / 2));
  }
  function rotationRecords(rank, level, model = 'beastlord') {
    const records = spellRotation(rank, model);
    const wanted = model === 'wizard-hoarfrost' ? ['ethereal hoarfrost'] :
      model === 'magician-spear' ? ['spear of blistersteel'] :
      model === 'enchanter-mindcleave' ? ['mindcleave'] :
      model === 'necro-pyre' ? ['pyre of marnek'] : ["poantaar's bite", 'kromrif lance'];
    if (!Array.isArray(records) || records.length !== wanted.length) return { records: [], unresolved: ['The spell rotation catalog is unavailable.'] };
    const selected = wanted.map((name) => records.find((record) => {
      const actual = normalized(record && record.name);
      return actual === name || actual.startsWith(name + ' rk.') || actual.startsWith(name + ' rk ');
    }));
    if (selected.some((record) => !record) || new Set(selected).size !== wanted.length) return { records: [], unresolved: ['The fixed ' + model + ' spell rotation is incomplete.'] };
    const unresolved = [];
    for (const record of selected) {
      for (const key of ['spellId', 'name', 'level', 'baseDamage', 'castSeconds', 'recastSeconds', 'mana', 'resist']) {
        if (!record || record[key] == null || (key !== 'name' && key !== 'resist' && number(record[key]) === null)) {
          unresolved.push('Unresolved rotation spell ' + String(record && record.name || 'unknown')); break;
        }
      }
      if (record.level < level - 5 || record.baseDamage < 0 || record.castSeconds < 0 || record.recastSeconds < 0 || record.mana < 0 || !normalized(record.resist)) unresolved.push('Ineligible rotation spell ' + String(record.name || 'unknown'));
    }
    return { records: unresolved.length ? [] : selected, unresolved };
  }
  function focusMean(focus, resist, spellLevel) {
    const candidates = focus.filter((entry) => entry.resist === normalized(resist));
    if (!candidates.length) return { value: 0 };
    const adjusted = candidates.map((entry) => {
      const levelDecay = Math.max(0, spellLevel - entry.maxLevel) * entry.decayPctPerLevel / 100;
      return { min: entry.minPct * (1 - levelDecay), max: entry.maxPct * (1 - levelDecay), critScaled: entry.critScaled !== false };
    });
    const strongest = Math.max(...adjusted.map((entry) => entry.max));
    const ties = adjusted.filter((entry) => entry.max === strongest);
    if (new Set(ties.map((entry) => entry.min)).size > 1 || new Set(ties.map((entry) => entry.critScaled !== false)).size > 1) {
      return { value: 0, unresolved: 'Spell-focus selection is ambiguous for ' + normalized(resist) + '.' };
    }
    return { value: Math.max(0, (ties[0].min + strongest) / 2), critScaled: ties[0].critScaled !== false };
  }
  function spellComponent(profile, after, scenario, confirmation) {
    const rotation = rotationRecords(scenario.spells.rank, Number(profile.level), scenario.spells.model);
    const result = { available: false, reason: null, current: NaN, candidate: NaN, focus: null, sources: [] };
    if (rotation.unresolved.length) { result.reason = rotation.unresolved.join('; '); return result; }
    const currentFocus = spellFocusLoadout(profile, confirmation), candidateFocus = spellFocusLoadout(after, confirmation);
    result.focus = { current: currentFocus.focus, candidate: candidateFocus.focus };
    result.sources = [...currentFocus.sources, ...candidateFocus.sources, ...rotation.records.map((record) => record.source).filter(Boolean)];
    const currentSpellDmg = spellStatTotal(profile), candidateSpellDmg = spellStatTotal(after);
    const unresolved = [...currentFocus.unresolved, ...candidateFocus.unresolved];
    if (!currentFocus.complete || !candidateFocus.complete) unresolved.push('Spell-focus effect lists are incomplete.');
    if (!currentSpellDmg.available || !candidateSpellDmg.available) unresolved.push('Spell Dmg is unavailable.');
    const cycleMana = rotation.records.reduce((sum, spell) => sum + spell.mana, 0);
    const uptime = cycleMana === 0 ? 1 : Math.min(1, scenario.spells.manaPerSecond / (cycleMana / scenario.spells.cycleSeconds));
    const countPerSecond = uptime / scenario.spells.cycleSeconds;
    const crit = 1 + scenario.spells.criticalChance * (scenario.spells.criticalMultiplier - 1);
    const expected = (focusLoadout, totalSpellDmg, applyFocus) => rotation.records.reduce((sum, spell) => {
      const focus = focusMean(focusLoadout, spell.resist, spell.level);
      if (applyFocus && focus.unresolved) unresolved.push(focus.unresolved);
      const dot = spell.kind === 'dot';
      const spellBase = dot ? spell.tickDamage * spell.tickCount : spell.baseDamage;
      const extra = dot ? 0 : spellExtra(totalSpellDmg.value, spell);
      const focused = spellBase * (applyFocus ? focus.value : 0) / 100;
      const flatFocus = applyFocus ? Math.max(0, ...focusLoadout
        .filter((entry) => entry.eligibleSpellIds && entry.eligibleSpellIds.includes(spell.spellId))
        .map((entry) => entry.flatDamage)) : 0;
      const damage = applyFocus && !focus.critScaled
        ? (spellBase + extra + flatFocus) * crit + focused
        : (spellBase + extra + flatFocus + focused) * crit;
      return sum + damage * scenario.spells.landingMultiplier;
    }, 0) * countPerSecond;
    result.uptime = uptime; result.countPerSecond = countPerSecond;
    if (currentSpellDmg.available && candidateSpellDmg.available) {
      result.statsCurrent = expected([], currentSpellDmg, false);
      result.statsCandidate = expected([], candidateSpellDmg, false);
      result.statsAvailable = finite(result.statsCurrent) && finite(result.statsCandidate);
      const fullBlocked = !currentFocus.complete || !candidateFocus.complete || currentFocus.unresolved.length || candidateFocus.unresolved.length;
      if (!fullBlocked) {
        result.current = expected(currentFocus.focus, currentSpellDmg, true);
        result.candidate = expected(candidateFocus.focus, candidateSpellDmg, true);
        result.available = finite(result.current) && finite(result.candidate) && !unresolved.length;
      }
    }
    const uniqueUnresolved = [...new Set(unresolved)];
    if (uniqueUnresolved.length) result.unresolved = uniqueUnresolved;
    if (!result.available) result.reason = uniqueUnresolved.join('; ') || 'Spell-focus effect lists are incomplete.';
    result.uptime = uptime; result.countPerSecond = countPerSecond; result.focusMean = {
      current: rotation.records.map((spell) => focusMean(currentFocus.focus, spell.resist, spell.level).value),
      candidate: rotation.records.map((spell) => focusMean(candidateFocus.focus, spell.resist, spell.level).value),
    };
    if (!result.statsAvailable && !result.reason) result.reason = 'Spell DPS calculation produced a non-finite value.';
    return result;
  }
  function loadout(profile, confirmation) {
    const unresolved = [];
    const sources = [];
    const strongest = { cleave: null, ferocity: null };
    const complete = confirmation.effectsComplete === true || (profile.items || []).every((item) => item && item.effectsKnown === true);
    for (const item of profile.items || []) {
      const effects = Array.isArray(item.effects) ? item.effects : [];
      for (const effect of effects) {
        const type = String(effect && effect.type || '').toLowerCase();
        if (!EFFECT_TYPES.has(type)) { unresolved.push('Unknown effect on ' + (item.name || 'unnamed item')); continue; }
        if (type !== 'worn') continue;
        const resolved = resolveWorn(effect);
        if (!resolved || !FAMILIES.has(String(resolved.family || '').toLowerCase()) ||
            !finite(number(resolved.bonusPct)) || number(resolved.bonusPct) < 0 || !finite(number(resolved.flatDamage)) || number(resolved.flatDamage) < 0) {
          unresolved.push('Unresolved worn effect ' + String(effect.name || effect.key || 'unknown')); continue;
        }
        const family = String(resolved.family).toLowerCase();
        const value = { family, bonusPct: number(resolved.bonusPct),
          flatDamage: resolved.source ? number(resolved.flatDamage) : 0, source: resolved.source || null };
        if (resolved.source) sources.push(resolved.source);
        if (!strongest[family] || value.bonusPct > strongest[family].bonusPct || value.bonusPct === strongest[family].bonusPct && value.flatDamage > strongest[family].flatDamage) strongest[family] = value;
      }
    }
    return { complete, strongest, unresolved, sources };
  }
  function occupant(profile, hand) {
    const matches = (profile.items || []).filter((item) => {
      const keys = slotKeys(item); return !item.isAugment && keys && keys.has(hand);
    });
    if (matches.length > 1) fail('Character has multiple items in the ' + hand + ' weapon hand');
    if (!matches.length) return null;
    if (!slotKeys(matches[0]) || slotKeys(matches[0]).size !== 1) fail('Each equipped weapon must identify one actual weapon hand');
    return matches[0];
  }
  function activeWeapons(profile, scenario) {
    const primaryOccupant = occupant(profile, 'primary'), secondaryOccupant = occupant(profile, 'secondary');
    const primary = primaryOccupant && (isWeapon(primaryOccupant) || weaponLike(primaryOccupant)) ? primaryOccupant : null;
    const secondary = secondaryOccupant && (isWeapon(secondaryOccupant) || weaponLike(secondaryOccupant)) ? secondaryOccupant : null;
    if (scenario.layout === 'dual-wield' && (!primary || !secondary)) fail('Dual-wield layout requires one known weapon in each hand');
    if (scenario.layout === 'two-hand' && (!primary || secondaryOccupant)) fail('Two-hand layout requires primary hand only');
    if (scenario.layout === 'one-hand-shield' && (!primary || !secondaryOccupant || weaponLike(secondaryOccupant))) fail('One-hand-shield layout requires a primary weapon and one non-weapon secondary item');
    return scenario.layout === 'dual-wield' ? { primary, secondary } : { primary };
  }
  function replacement(profile, candidate, worn, scenario, validateWeapons = true) {
    if (!candidate || !worn || candidate.isAugment || worn.isAugment) fail('Augments cannot be used for player-damage estimates');
    const index = wornIndex(profile, worn), wornKeys = slotKeys(worn), candidateKeys = slotKeys(candidate);
    if (!wornKeys || !candidateKeys || wornKeys.size !== 1 || candidateKeys.size < 1 || ![...wornKeys].some((key) => candidateKeys.has(key))) fail('Candidate is incompatible with the worn equipment slot');
    if (scenario.layout === 'two-hand' && wornKeys.has('primary') && candidateKeys.has('secondary')) fail('Two-hand layout requires a candidate that occupies only the primary hand');
    const placed = { ...candidate, slot: worn.slot, slotKey: worn.slotKey };
    const after = { ...profile, items: profile.items.slice() };
    after.items[index] = placed;
    if (validateWeapons && scenario.layout) { activeWeapons(profile, scenario); activeWeapons(after, scenario); }
    return { index, after };
  }
  function countPairsAtLeast(a, d, threshold) {
    const fullN = clamp(1 - threshold, 0, d);
    const lo = fullN;
    const hi = Math.min(d - 1, a - 1 - threshold);
    const n = Math.max(0, hi - lo + 1);
    return fullN * a + n * (a - threshold) - (lo + hi) * n / 2;
  }
  function expectedRoll(offense, mitigation) {
    if (!Number.isSafeInteger(offense) || offense < 0 || offense > 100000 || !Number.isSafeInteger(mitigation) || mitigation < 0 || mitigation > 100000) return NaN;
    const a = offense + 5, d = mitigation + 5, avg = Math.max(1, Math.floor((offense + mitigation + 10) / 2));
    let total = 0;
    for (let k = 1; k < 20; k++) {
      const threshold = Math.ceil(k * avg / 20) - Math.floor(avg / 2);
      total += countPairsAtLeast(a, d, threshold) / (a * d);
    }
    return .1 + .1 * total;
  }
  function critFactor(dex, effects, combat) {
    const bonus = combat.otherCriticalBonusPct + (effects.cleave ? effects.cleave.bonusPct : 0);
    if (bonus === 0) return 1;
    const reduced = (dex > 255 ? 255 + Math.floor((dex - 255) / 5) : dex) + 45;
    const dexTerm = Math.floor(reduced * 3 / 5);
    const term = dexTerm + Math.floor(dexTerm * bonus / 100);
    const chance = clamp((term - 1) / combat.criticalDifficulty, 0, 1);
    return 1 + chance * (combat.criticalDamageMultiplier - 1);
  }
  function doubleAttackChance(effects, combat) {
    const skill = combat.doubleAttackSkill, bonus = combat.grantedDoubleAttackPct + combat.otherDoubleAttackBonusPct + (effects.ferocity ? effects.ferocity.bonusPct : 0);
    if (skill === 0 && combat.grantedDoubleAttackPct === 0) return 0;
    const chance = skill > 0 ? (skill + 100) / 500 * (1 + bonus / 100) : bonus / 100;
    return clamp(chance, 0, 1);
  }
  function daFactor(effects, combat) { return 1 + doubleAttackChance(effects, combat); }
  function totals(profile, scenario) {
    const names = ['ATK', 'STR', 'DEX', 'HStr', 'HDex'];
    const values = Object.fromEntries(names.map((name) => [name, statTotal(profile, name)]));
    if (Object.values(values).some((entry) => !entry.available)) return { available: false, unresolved: Object.values(values).flatMap((entry) => entry.unresolved || []) };
    const combat = scenario.combat;
    if (Object.values(values).some((entry) => entry.value < 0)) return { available: false, unresolved: ['Negative gear damage stats are outside the reference model.'] };
    const strength = Math.min(combat.baseStrength + values.STR.value, combat.strengthCap) + values.HStr.value;
    const dexterity = Math.min(combat.baseDexterity + values.DEX.value, combat.dexterityCap) + values.HDex.value;
    const offense = Math.floor(combat.offenseBase + Math.max(0, Math.floor((2 * strength - 150) / 3)) + combat.attackScale * Math.min(combat.attackCap, values.ATK.value));
    if (![strength, dexterity, offense].every((value) => finite(value) && value >= 0) || offense > 100000 || strength > 100000 || dexterity > 100000) return { available: false, unresolved: ['Effective combat stats are outside reference bounds.'] };
    return { available: true, values, strength, dexterity, offense };
  }
  function procDps(profile, weapons, scenario, confirmation) {
    const complete = confirmation.weaponProcsComplete === true || Object.values(weapons).every((item) => item && item.effectsKnown === true);
    const unresolved = [];
    const sources = [];
    let total = 0;
    for (const hand of Object.keys(weapons)) {
      const item = weapons[hand], ppm = scenario.procs[hand + 'Ppm'];
      const seenSpells = new Set();
      for (const effect of Array.isArray(item.effects) ? item.effects : []) {
        const type = String(effect && effect.type || '').toLowerCase();
        if (type === 'focus' || type === 'click' || type === 'worn') continue;
        if (type !== 'proc') { unresolved.push('Unknown weapon effect ' + String(effect && effect.name || 'unknown')); continue; }
        const resolved = resolveProc(effect), damage = resolved && number(resolved.baseDamage), rate = resolved && number(resolved.rateMultiplier);
        if (!resolved || damage === null || rate === null || damage < 0 || rate < 0 || !resolved.spellId || !resolved.name || !resolved.resist || seenSpells.has(String(resolved.spellId))) unresolved.push('Unresolved or duplicate weapon proc ' + String(effect.name || effect.key || 'unknown'));
        else { seenSpells.add(String(resolved.spellId)); total += damage * ppm * scenario.procs.landingMultiplier * rate / 60; if (resolved.source) sources.push(resolved.source); }
      }
    }
    return { available: complete && !unresolved.length, value: total, unresolved, sources, reason: !complete ? 'Weapon proc effect lists are incomplete.' : unresolved.length ? unresolved.join('; ') : null };
  }
  function effectSnapshot(profile) {
    return (profile.items || []).map((item) => ({ itemName: item && item.name || '', slot: item && item.slot || '',
      effects: Array.isArray(item && item.effects) ? item.effects : [], effectsKnown: item && item.effectsKnown === true }));
  }
  function handDps(item, hand, scenario, statBefore, statAfter, effectsBefore, effectsAfter, statOnly) {
    const input = scenario[hand], read = LC.dps && LC.dps.weaponNumeric;
    const damage = typeof read === 'function' ? read(item, 'Damage') : stat(item, 'Damage');
    const delay = typeof read === 'function' ? read(item, 'Delay') : stat(item, 'Delay');
    if (damage === null || delay === null || delay <= 0) return null;
    const rollRatio = expectedRoll(statAfter.offense, scenario.combat.targetMitigation) / expectedRoll(statBefore.offense, scenario.combat.targetMitigation);
    const critRatio = critFactor(statAfter.dexterity, statOnly ? effectsBefore.strongest : effectsAfter.strongest, scenario.combat) /
      critFactor(statBefore.dexterity, effectsBefore.strongest, scenario.combat);
    const daRatio = daFactor(statOnly ? effectsBefore.strongest : effectsAfter.strongest, scenario.combat) / daFactor(effectsBefore.strongest, scenario.combat);
    const flat = !statOnly ? Object.values(effectsAfter.strongest).filter(Boolean).reduce((sum, value) => sum + value.flatDamage, 0) -
      Object.values(effectsBefore.strongest).filter(Boolean).reduce((sum, value) => sum + value.flatDamage, 0) : 0;
    const rate = 10 / delay * (1 + scenario.hastePercent / 100) * input.attacksPerRound * input.hitChance;
    return rate * daRatio * (damage * input.damageMultiplier * input.mitigationMultiplier * rollRatio * critRatio + input.damageBonus + flat);
  }
  function row(metric, current, candidate, reason) {
    if (!finite(current) || !finite(candidate) || !finite(candidate - current)) return { metric, available: false, reason: reason || 'Reference result is unavailable.' };
    return { metric, available: true, current, candidate, projected: candidate, delta: candidate - current };
  }
  function project(profile, candidate, worn, inputScenario, confirmation = {}) {
    confirmation = confirmation && typeof confirmation === 'object' && !Array.isArray(confirmation) ? confirmation : {};
    const className = String(profile && profile.cls || '').trim().toLowerCase();
    const classModel = SPELL_MODEL_BY_CLASS[className] || MELEE_MODEL_BY_CLASS[className] || (['beastlord', 'bst'].includes(className) ? 'beastlord' : '');
    if (!profile || !classModel || Number(profile.level) !== 100) return { mode: 'dps-reference', rule: inputScenario && inputScenario.version === 2 ? RULE_V2 : RULE, outputs: [row('Melee DPS', NaN, NaN, 'The player-damage model supports only cataloged level-100 class models.')], scenario: inputScenario };
    if (!Array.isArray(profile.items)) fail('Character equipment is required');
    const sharedValidate = LC.dps && LC.dps.validateScenario;
    if (typeof sharedValidate !== 'function') fail('DPS scenario validator is unavailable');
    const scenario = sharedValidate(inputScenario);
    const spellModel = SPELL_MODEL_BY_CLASS[className], meleeModel = MELEE_MODEL_BY_CLASS[className];
    if (spellModel && spellModel !== 'beastlord' && (scenario.version !== 3 || scenario.spells.model !== spellModel) ||
        meleeModel && (scenario.version !== 3 || scenario.meleeModel !== meleeModel) ||
        classModel === 'beastlord' && scenario.version === 3 && scenario.spells.model !== 'beastlord') fail('Reference model does not match the character class.');
    if (scenario.version !== 2 && scenario.version !== 3) fail('Player-damage model requires DPS scenario version 2 or 3');
    if (scenario.version === 2 && !scenario.layout || scenario.layout && !['dual-wield', 'two-hand', 'one-hand-shield'].includes(scenario.layout)) fail('DPS scenario layout is invalid');
    if (scenario.version === 3) return projectV3(profile, candidate, worn, scenario, confirmation);
    const { after } = replacement(profile, candidate, worn, scenario);
    const currentWeapons = activeWeapons(profile, scenario), afterWeapons = activeWeapons(after, scenario);
    const beforeStats = totals(profile, scenario), afterStats = totals(after, scenario);
    const unresolved = [...(beforeStats.unresolved || []), ...(afterStats.unresolved || [])];
    const beforeEffects = loadout(profile, confirmation), afterEffects = loadout(after, confirmation);
    unresolved.push(...beforeEffects.unresolved, ...afterEffects.unresolved);
    const statsAvailable = beforeStats.available && afterStats.available;
    const activeHands = Object.keys(currentWeapons);
    const sumHands = (values) => values.every(finite) ? values.reduce((a, b) => a + b, 0) : NaN;
    const statsValues = statsAvailable ? sumHands(activeHands.map((hand) => handDps(currentWeapons[hand], hand, scenario, beforeStats, beforeStats, beforeEffects, beforeEffects, true))) : NaN;
    const effectsComplete = (beforeEffects.complete && afterEffects.complete) || confirmation.effectsComplete === true;
    const fullReady = statsAvailable && effectsComplete && !beforeEffects.unresolved.length && !afterEffects.unresolved.length;
    const fullValues = fullReady ? sumHands(activeHands.map((hand) => handDps(currentWeapons[hand], hand, scenario, beforeStats, beforeStats, beforeEffects, beforeEffects, false))) : NaN;
    const statsCandidate = statsAvailable ? sumHands(activeHands.map((hand) => handDps(afterWeapons[hand], hand, scenario, beforeStats, afterStats, beforeEffects, beforeEffects, true))) : NaN;
    const fullCandidate = fullReady ? sumHands(activeHands.map((hand) => handDps(afterWeapons[hand], hand, scenario, beforeStats, afterStats, beforeEffects, afterEffects, false))) : NaN;
    const procBefore = procDps(profile, currentWeapons, scenario, confirmation), procAfter = procDps(after, afterWeapons, scenario, confirmation);
    const outputs = [
      row('Melee stats DPS', statsValues, statsCandidate, statsAvailable ? null : unresolved.join('; ') || 'Required gear stats are unavailable.'),
      row('Melee DPS', fullValues, fullCandidate, beforeEffects.unresolved.concat(afterEffects.unresolved).join('; ') || 'Relevant worn effect lists are incomplete.'),
      procBefore.available && procAfter.available ? row('Weapon proc DPS', procBefore.value, procAfter.value) : row('Weapon proc DPS', NaN, NaN, procBefore.reason || procAfter.reason),
    ];
    outputs[0].partial = true;
    outputs[1].partial = false;
    outputs[2].partial = false;
    const all = outputs[1].available && outputs[2].available ? row('Melee + procs DPS', outputs[1].current + outputs[2].current, outputs[1].candidate + outputs[2].candidate) : row('Melee + procs DPS', NaN, NaN, 'Melee and weapon-proc components must both be available.');
    outputs.push(all);
    return { mode: 'dps-reference', rule: RULE_V2, outputs, scenario, scenarioRevision: scenario.revision,
      assumptions: ['Same target, buffs, AAs, weapon skills and combat assumptions apply to both loadouts.', 'Omitted RaidLoot/legacy ATK, STR, DEX and heroic fields count as zero; explicit unknown and partial OpenDKP omissions remain unavailable.', 'ATK/STR/DEX use the versioned illustrative offense, RollD20, critical and double-attack relationships.', 'Strongest resolved Cleave and Ferocity effects are used per loadout; duplicate weaker effects do not stack.', 'Weapon procs use fixed hand PPM and exact catalog damage; haste and hit chance are not applied to proc rates.', 'Unchanged augments stay in place; candidate augment transfer is not modeled.', 'Spell focus and pet damage are not modeled.'],
      sources: [...MODEL_SOURCES, ...beforeEffects.sources || [], ...afterEffects.sources || [], ...procBefore.sources, ...procAfter.sources],
      effectSources: { current: effectSnapshot(profile), candidate: effectSnapshot(after) },
      resolvedEffectSources: { current: beforeEffects.sources, candidate: afterEffects.sources },
      observations: { gearStats: { current: beforeStats.values, candidate: afterStats.values }, effects: { current: beforeEffects.strongest, candidate: afterEffects.strongest }, unresolved },
      scope: { hand: null, layout: scenario.layout, singleHand: false }, spellFocus: { available: false, reason: 'Spell focus and spell rotation are not modeled.' }, pet: { available: false, reason: 'Pet damage is not modeled.' } };
  }
  function projectV3(profile, candidate, worn, scenario, confirmation) {
    if (scenario.meleeModel !== 'beastlord') return projectMeleeOnly(profile, candidate, worn, scenario, confirmation);
    if (scenario.spells.model !== 'beastlord') return projectSpellOnly(profile, candidate, worn, scenario, confirmation);
    const { after } = replacement(profile, candidate, worn, scenario, false);
    let currentWeapons = null, afterWeapons = null, weaponReason = null;
    if (scenario.layout) {
      try { currentWeapons = activeWeapons(profile, scenario); afterWeapons = activeWeapons(after, scenario); }
      catch (error) { weaponReason = error && error.message || String(error); }
    }
    const beforeStats = totals(profile, scenario), afterStats = totals(after, scenario);
    const beforeEffects = loadout(profile, confirmation), afterEffects = loadout(after, confirmation);
    const statsAvailable = !!currentWeapons && !!afterWeapons && beforeStats.available && afterStats.available;
    const activeHands = currentWeapons ? Object.keys(currentWeapons) : [];
    const sumHands = (values) => values.length && values.every(finite) ? values.reduce((a, b) => a + b, 0) : NaN;
    const spells = spellComponent(profile, after, scenario, confirmation);
    const rotationForTiming = rotationRecords(scenario.spells.rank, Number(profile.level));
    const timingUptime = spells.uptime == null ? (rotationForTiming.records.length === 2
      ? Math.min(1, scenario.spells.manaPerSecond / (rotationForTiming.records.reduce((sum, spell) => sum + spell.mana, 0) / scenario.spells.cycleSeconds)) : 0) : spells.uptime;
    const meleeCastFactor = 1 - timingUptime *
      rotationForTiming.records.reduce((sum, spell) => sum + Number(spell.castSeconds || 0), 0) /
      scenario.spells.cycleSeconds * (1 - scenario.spells.meleeDuringCast);
    const statsValues = statsAvailable ? sumHands(activeHands.map((hand) => handDps(currentWeapons[hand], hand, scenario, beforeStats, beforeStats, beforeEffects, beforeEffects, true))) * meleeCastFactor : NaN;
    const statsCandidate = statsAvailable ? sumHands(activeHands.map((hand) => handDps(afterWeapons[hand], hand, scenario, beforeStats, afterStats, beforeEffects, beforeEffects, true))) * meleeCastFactor : NaN;
    const effectsComplete = (beforeEffects.complete && afterEffects.complete) || confirmation.effectsComplete === true;
    const fullReady = statsAvailable && effectsComplete && !beforeEffects.unresolved.length && !afterEffects.unresolved.length;
    const fullValues = fullReady ? sumHands(activeHands.map((hand) => handDps(currentWeapons[hand], hand, scenario, beforeStats, beforeStats, beforeEffects, beforeEffects, false))) * meleeCastFactor : NaN;
    const fullCandidate = fullReady ? sumHands(activeHands.map((hand) => handDps(afterWeapons[hand], hand, scenario, beforeStats, afterStats, beforeEffects, afterEffects, false))) * meleeCastFactor : NaN;
    const procBefore = currentWeapons ? procDps(profile, currentWeapons, scenario, confirmation) : { available: false, reason: weaponReason || 'Weapon layout is unavailable.' };
    const procAfter = afterWeapons ? procDps(after, afterWeapons, scenario, confirmation) : { available: false, reason: weaponReason || 'Weapon layout is unavailable.' };
    const unresolvedStats = [...(beforeStats.unresolved || []), ...(afterStats.unresolved || [])];
    const outputs = [
      row('Melee stats DPS', statsValues, statsCandidate, weaponReason || (statsAvailable ? null : unresolvedStats.join('; ') || 'Required gear stats or active weapons are unavailable.')),
      row('Melee DPS', fullValues, fullCandidate, weaponReason || beforeEffects.unresolved.concat(afterEffects.unresolved).join('; ') || 'Relevant worn effect lists are incomplete.'),
      procBefore.available && procAfter.available ? row('Weapon proc DPS', procBefore.value, procAfter.value) : row('Weapon proc DPS', NaN, NaN, procBefore.reason || procAfter.reason),
      spells.available ? row('Spell DPS', spells.current, spells.candidate) : row('Spell DPS', NaN, NaN, spells.reason || 'Spell inputs are unavailable.'),
      spells.statsAvailable ? row('Spell stats DPS', spells.statsCurrent, spells.statsCandidate) : row('Spell stats DPS', NaN, NaN, spells.reason || 'Spell stats are unavailable.'),
    ];
    outputs[0].partial = true; outputs[1].partial = false; outputs[2].partial = false; outputs[3].partial = false;
    outputs[4].partial = true;
    if (outputs[4].available) outputs[4].reason = 'Unfocused spell reference; gear focus modifiers excluded.';
    const selected = [];
    const excluded = ['Pet damage', 'DoTs'];
    const melee = outputs[1].available ? outputs[1] : outputs[0].available ? outputs[0] : null;
    if (melee) selected.push(melee.metric); else excluded.push('Melee DPS');
    if (melee === outputs[0]) excluded.push('Worn effect modifiers');
    const spell = outputs[3].available ? outputs[3] : outputs[4].available ? outputs[4] : null;
    if (outputs[2].available) selected.push(outputs[2].metric); else excluded.push('Weapon proc DPS');
    if (spell) selected.push(spell.metric); else excluded.push('Spell DPS');
    if (spell === outputs[4]) excluded.push('Spell focus modifiers');
    const values = [melee, outputs[2], spell].filter((entry) => entry && entry.available);
    const player = values.length ? row('Player DPS', values.reduce((sum, entry) => sum + entry.current, 0), values.reduce((sum, entry) => sum + entry.candidate, 0)) : row('Player DPS', NaN, NaN, 'No player-damage components are available.');
    player.includedComponents = selected; player.excludedComponents = excluded; player.partial = values.length < 3 || melee === outputs[0] || spell === outputs[4];
    outputs.push(player);
    return { mode: 'dps-reference', rule: RULE, outputs, scenario, scenarioRevision: scenario.revision,
      assumptions: ['Same target, buffs, AAs, weapon skills and combat assumptions apply to both loadouts.',
        'Omitted RaidLoot/legacy ATK, STR, DEX, heroic and Spell Dmg fields count as zero; explicit unknown fields remain unavailable.',
        'Unchanged augments stay in place; candidate augment transfer is not modeled.',
        'Fixed rotation is one Poantaar\'s Bite and one Kromrif Lance per cycle; pets, DoTs, wrappers and extra procs are excluded.',
        'Mana-limited spell uptime is shared; casting time reduces melee only and does not rescale realized weapon PPM.',
        'Spell focus uses the strongest eligible exact focus per resist; flat Spell Dmg uses the sourced extra-damage rule.'],
      sources: [...MODEL_SOURCES, ...beforeEffects.sources, ...afterEffects.sources, ...procBefore.sources || [], ...procAfter.sources || [], ...spells.sources],
      effectSources: { current: effectSnapshot(profile), candidate: effectSnapshot(after) },
      resolvedEffectSources: { current: beforeEffects.sources, candidate: afterEffects.sources },
      observations: { gearStats: { current: beforeStats.values, candidate: afterStats.values }, effects: { current: beforeEffects.strongest, candidate: afterEffects.strongest }, spellFocus: spells.focus, unresolved: [...(beforeEffects.unresolved || []), ...(afterEffects.unresolved || []), ...(spells.unresolved || [])] },
      includedComponents: selected, excludedComponents: excluded, partial: player.partial,
      scope: { hand: null, layout: scenario.layout, singleHand: false },
      spellFocus: { available: spells.available, reason: spells.reason, uptime: spells.uptime, focusMean: spells.focusMean }, pet: { available: false, reason: 'Pet damage is not modeled.' } };
  }
  function projectMeleeOnly(profile, candidate, worn, scenario, confirmation) {
    const { after } = replacement(profile, candidate, worn, scenario, false);
    let currentWeapons = null, afterWeapons = null, weaponReason = null;
    if (scenario.layout) {
      try { currentWeapons = activeWeapons(profile, scenario); afterWeapons = activeWeapons(after, scenario); }
      catch (error) { weaponReason = error && error.message || String(error); }
    }
    const beforeStats = totals(profile, scenario), afterStats = totals(after, scenario);
    const beforeEffects = loadout(profile, confirmation), afterEffects = loadout(after, confirmation);
    const statsAvailable = !!currentWeapons && !!afterWeapons && beforeStats.available && afterStats.available;
    const activeHands = currentWeapons ? Object.keys(currentWeapons) : [];
    const sumHands = (values) => values.length && values.every((value) => finite(value)) ? values.reduce((a, b) => a + b, 0) : NaN;
    const statsValues = statsAvailable ? sumHands(activeHands.map((hand) => handDps(currentWeapons[hand], hand, scenario, beforeStats, beforeStats, beforeEffects, beforeEffects, true))) : NaN;
    const statsCandidate = statsAvailable ? sumHands(activeHands.map((hand) => handDps(afterWeapons[hand], hand, scenario, beforeStats, afterStats, beforeEffects, beforeEffects, true))) : NaN;
    const effectsComplete = (beforeEffects.complete && afterEffects.complete) || confirmation.effectsComplete === true;
    const fullReady = statsAvailable && effectsComplete && !beforeEffects.unresolved.length && !afterEffects.unresolved.length;
    const fullValues = fullReady ? sumHands(activeHands.map((hand) => handDps(currentWeapons[hand], hand, scenario, beforeStats, beforeStats, beforeEffects, beforeEffects, false))) : NaN;
    const fullCandidate = fullReady ? sumHands(activeHands.map((hand) => handDps(afterWeapons[hand], hand, scenario, beforeStats, afterStats, beforeEffects, afterEffects, false))) : NaN;
    const procBefore = currentWeapons ? procDps(profile, currentWeapons, scenario, confirmation) : { available: false, reason: weaponReason || 'Weapon layout is unavailable.' };
    const procAfter = afterWeapons ? procDps(after, afterWeapons, scenario, confirmation) : { available: false, reason: weaponReason || 'Weapon layout is unavailable.' };
    const outputs = [
      row('Melee stats DPS', statsValues, statsCandidate, weaponReason || (statsAvailable ? null : 'Required melee stats or active weapons are unavailable.')),
      row('Melee DPS', fullValues, fullCandidate, weaponReason || beforeEffects.unresolved.concat(afterEffects.unresolved).join('; ') || 'Relevant worn effect lists are incomplete.'),
      procBefore.available && procAfter.available ? row('Weapon proc DPS', procBefore.value, procAfter.value) : row('Weapon proc DPS', NaN, NaN, procBefore.reason || procAfter.reason),
    ];
    outputs[0].partial = true; outputs[1].partial = false; outputs[2].partial = false;
    const melee = outputs[1].available ? outputs[1] : outputs[0].available ? outputs[0] : null;
    const selected = melee ? [melee.metric] : [];
    if (outputs[2].available) selected.push(outputs[2].metric);
    const excluded = ['Spell DPS', 'Spell focus modifiers', 'Pet damage', 'DoTs'];
    if (scenario.meleeModel === 'berserker-base-melee') excluded.push('Discs', 'Frenzy', 'class special attacks');
    if (scenario.meleeModel === 'monk-base-melee') excluded.push('hand-to-hand base damage', 'kicks', 'class special attacks');
    if (scenario.meleeModel === 'rogue-base-melee') excluded.push('backstab', 'poisons', 'class special attacks');
    const values = [melee, outputs[2]].filter((entry) => entry && entry.available);
    const player = values.length ? row('Player DPS', values.reduce((sum, entry) => sum + entry.current, 0), values.reduce((sum, entry) => sum + entry.candidate, 0)) : row('Player DPS', NaN, NaN, 'No player-damage components are available.');
    player.includedComponents = selected; player.excludedComponents = excluded; player.partial = values.length < 2 || melee === outputs[0];
    outputs.push(player);
    const rule = MELEE_ONLY_RULES[scenario.meleeModel];
    return { mode: 'dps-reference', rule, outputs, scenario, scenarioRevision: scenario.revision,
      includedComponents: selected, excludedComponents: excluded, partial: player.partial,
      assumptions: ['One shared class-specific base-melee scenario applies to both gear sets.', 'ATK/STR/DEX, target, layout, hand rates and proc assumptions are explicit reference inputs.', 'Class abilities, special attacks and class-specific weapon rules are excluded until separately sourced.', 'Unchanged augments stay in place; candidate augment transfer is not modeled.'],
      sources: [...MODEL_SOURCES, rule && rule.source].filter(Boolean),
      effectSources: { current: effectSnapshot(profile), candidate: effectSnapshot(after) },
      resolvedEffectSources: { current: beforeEffects.sources, candidate: afterEffects.sources },
      observations: { gearStats: { current: beforeStats.values, candidate: afterStats.values }, effects: { current: beforeEffects.strongest, candidate: afterEffects.strongest }, unresolved: [...(beforeStats.unresolved || []), ...(afterStats.unresolved || []), ...(beforeEffects.unresolved || []), ...(afterEffects.unresolved || []), ...(procBefore.unresolved || []), ...(procAfter.unresolved || [])] },
      scope: { hand: null, layout: scenario.layout, singleHand: false },
      spellFocus: { available: false, reason: 'Spell focus and spell rotation are not modeled.' }, pet: { available: false, reason: 'Pet damage is not modeled.' } };
  }
  function projectSpellOnly(profile, candidate, worn, scenario, confirmation) {
    const { after } = replacement(profile, candidate, worn, { ...scenario, layout: null }, false);
    const spells = spellComponent(profile, after, scenario, confirmation);
    const full = spells.available ? row('Spell DPS', spells.current, spells.candidate) : row('Spell DPS', NaN, NaN, spells.reason);
    const stats = spells.statsAvailable ? row('Spell stats DPS', spells.statsCurrent, spells.statsCandidate) : row('Spell stats DPS', NaN, NaN, spells.reason);
    full.partial = false; stats.partial = true;
    if (stats.available) stats.reason = 'Unfocused spell reference; gear focus modifiers excluded.';
    const selected = full.available ? full : stats;
    const includedComponents = selected.available ? [selected.metric] : [];
    const excludedComponents = ['Melee DPS', 'Weapon proc DPS', 'Pet damage', 'DoTs', 'Mana pool/regeneration', 'Other triggered effects'];
    if (scenario.spells.model === 'wizard-hoarfrost') excludedComponents.push('Ethereal Weave and children', 'Wizard innate crits', 'Twincast', 'Burns');
    if (scenario.spells.model === 'magician-spear') excludedComponents.push('Summoned pets', 'Swarm/pet-linked damage', 'Of Many/conditional effects');
    if (scenario.spells.model === 'enchanter-mindcleave') excludedComponents.push('Mind Squall DoT/mana return', 'Auras', 'Crowd-control/support effects');
    if (scenario.spells.model === 'necro-pyre') excludedComponents.push('Other DoTs', 'DoT Spell Dmg scaling', 'DoT clipping/overlap and fade effects');
    if (!full.available) excludedComponents.push('Spell focus modifiers');
    const player = { ...selected, metric: 'Player DPS', partial: true, includedComponents, excludedComponents };
    return { mode: 'dps-reference', rule: SPELL_ONLY_RULES[scenario.spells.model] || WIZARD_RULE, outputs: [full, stats, player], scenario, scenarioRevision: scenario.revision,
      includedComponents, excludedComponents, partial: true,
      assumptions: ['One cataloged class spell application per shared cycle: a declared reference, not an optimal rotation.',
        'Spell Dmg uses the pinned EQEmu GetExtraSpellAmt timing rule; this is not retail calibration.',
        'Explicit mana budget limits uptime; no mana pool or regeneration is inferred. Crit and landing inputs are shared.',
        ...(scenario.spells.model === 'necro-pyre' ? ['Pyre of Marnek uses five six-second ticks over its sourced 30-second duration; DoT Spell Dmg scaling is intentionally omitted.'] : []),
        'Unchanged augments stay in place; candidate augment transfer is not modeled.'],
      sources: [MODEL_SOURCES[3], ...spells.sources],
      effectSources: { current: effectSnapshot(profile), candidate: effectSnapshot(after) },
      observations: { spellFocus: spells.focus, unresolved: spells.unresolved || [] },
      scope: { hand: null, layout: null, singleHand: false },
      spellFocus: { available: spells.available, reason: spells.reason, uptime: spells.uptime, focusMean: spells.focusMean },
      pet: { available: false, reason: 'Pet damage is not modeled.' } };
  }
  LC.playerDamage = { RULE, project, expectedRoll, critFactor, doubleAttackChance, daFactor, spellExtra };
})();
