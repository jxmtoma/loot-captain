// Narrow, explicit level-100 player damage reference estimates.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const RULE = Object.freeze({ key: 'bst-melee-proc-dps', version: 1,
    name: 'Level-100 Beastlord melee and proc DPS estimate' });
  const EQUIPPED_RULE = Object.freeze({ key: 'bst-melee-proc-dps', version: 2,
    name: 'Level-100 Beastlord equipped-weapon melee and proc DPS estimate' });
  const REFERENCE_RULE = Object.freeze({ key: 'bst-melee-dps-reference', version: 1,
    name: 'Level-100 Beastlord reference melee DPS estimate' });
  const HANDS = new Set(['primary', 'secondary']);
  const LAYOUTS = new Set(['dual-wield', 'two-hand', 'one-hand-shield']);
  const EFFECT_TYPES = new Set(['proc', 'focus', 'worn', 'click']);
  const SCENARIO_V1_VERSION = 1;
  const SCENARIO_V2_VERSION = 2;
  const SCENARIO_VERSION = 3;
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
  const SPELL_MODEL_CYCLES = Object.freeze({ beastlord: 32, 'wizard-hoarfrost': 12, 'magician-spear': 12.5, 'enchanter-mindcleave': 13, 'necro-pyre': 30 });
  const SCENARIO_DEFAULTS_V1 = Object.freeze({
    version: SCENARIO_V1_VERSION,
    revision: 0,
    layout: null,
    hastePercent: 100,
    primary: Object.freeze({ hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 10, attacksPerRound: 1 }),
    secondary: Object.freeze({ hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 0, attacksPerRound: .5 }),
  });
  const SCENARIO_DEFAULTS_V2 = Object.freeze({
    ...SCENARIO_DEFAULTS_V1,
    version: SCENARIO_V2_VERSION,
    combat: Object.freeze({ baseStrength: 100, baseDexterity: 100, strengthCap: 730, dexterityCap: 730,
      offenseBase: 400, attackScale: 1, attackCap: 610, targetMitigation: 1000,
      criticalDifficulty: 8900, otherCriticalBonusPct: 100, criticalDamageMultiplier: 2,
      doubleAttackSkill: 0, grantedDoubleAttackPct: 30, otherDoubleAttackBonusPct: 0 }),
    procs: Object.freeze({ primaryPpm: 2, secondaryPpm: 1, landingMultiplier: 1 }),
  });
  const SCENARIO_DEFAULTS_V3 = Object.freeze({
    ...SCENARIO_DEFAULTS_V2,
    version: SCENARIO_VERSION,
    meleeModel: 'beastlord',
    spells: Object.freeze({ model: 'beastlord', rank: 1, cycleSeconds: 32, landingMultiplier: 1,
      criticalChance: 0, criticalMultiplier: 2, manaPerSecond: 100, meleeDuringCast: 0 }),
  });
  const SCENARIO_DEFAULTS = SCENARIO_DEFAULTS_V3;
  const CLASS_ATTACK_DEFAULTS = Object.freeze({ skill: 400, cycleSeconds: 8, attacksPerUse: 1,
    hitChance: .8, damageMultiplier: 1, uptime: 1, primaryPiercingConfirmed: false });

  const unavailable = (metric, reason) => ({ metric, available: false, reason });
  const output = (metric, current, candidate) => finite(current) && finite(candidate) && finite(candidate - current)
    ? ({ metric, available: true, current, candidate, projected: candidate, delta: candidate - current })
    : unavailable(metric, 'The DPS calculation produced a non-finite value.');
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

  function fail(reason) { throw new Error(reason); }

  function stat(item, wanted) {
    const stats = item && item.stats;
    if (!stats || typeof stats !== 'object') return null;
    const canonicalName = wanted.toLowerCase();
    const names = Object.keys(stats);
    // Prefer an explicitly canonical key. If it exists but is unknown, do not
    // hide that missing value behind a legacy alias.
    const exact = names.find((name) => String(name).trim().toLowerCase() === canonicalName);
    const alias = canonicalName === 'damage'
      ? names.find((name) => String(name).trim().toLowerCase() === 'dmg') : null;
    const key = exact == null ? alias : exact;
    if (key == null) return null;
    const value = stats[key];
    if (typeof parserNormalizeStatValue === 'function') {
      const normalized = parserNormalizeStatValue(value);
      return finite(normalized.num) ? normalized.num : null;
    }
    const num = value && typeof value === 'object' && own(value, 'num') ? value.num : value;
    if (finite(num)) return num;
    if (typeof num === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(num.trim())) {
      const parsed = Number(num); return finite(parsed) ? parsed : null;
    }
    return null;
  }

  function slotKeys(item) {
    const canonical = typeof parserCanonicalSlot === 'function' ? parserCanonicalSlot
      : LC.slots && LC.slots.canonicalSlot;
    const slot = canonical ? canonical(item && item.slot) : null;
    if (!slot) return null;
    return new Set(slot.keys || [slot.key]);
  }

  function isWeapon(item) {
    const damage = stat(item, 'Damage'), delay = stat(item, 'Delay');
    return damage != null && damage >= 0 && delay != null && delay > 0;
  }

  function scenarioUnavailable(reason, scenario, scenarioDefault) {
    return { available: false, reason, scenario: scenario || null,
      scenarioRevision: scenario && scenario.revision != null ? scenario.revision : 0,
      scenarioDefault: scenarioDefault === true };
  }

  function scenarioNumber(value, key, bounded = true) {
    if (!finite(value)) return 'Scenario ' + key + ' must be a finite number';
    const bareKey = key.split('.').pop();
    if (bareKey === 'hitChance' && (value < 0 || value > 1)) return 'Scenario ' + key + ' must be between 0 and 1';
    if (bareKey === 'mitigationMultiplier' && (value < 0 || value > 1)) return 'Scenario ' + key + ' must be between 0 and 1';
    if (value < 0 || bounded && value > 1000000) return 'Scenario ' + key + ' is out of bounds';
    return '';
  }

  function validateScenario(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('DPS scenario is required');
    if (![SCENARIO_V1_VERSION, SCENARIO_V2_VERSION, SCENARIO_VERSION].includes(value.version)) fail('Unsupported DPS scenario version');
    const allowed = ['version', 'revision', 'layout', 'hastePercent', 'primary', 'secondary'];
    if (value.version >= SCENARIO_V2_VERSION) allowed.push('combat', 'procs', 'meleeModel');
    if (value.version >= SCENARIO_VERSION) allowed.push('spells', 'classAttack');
    if (Object.keys(value).some((key) => !allowed.includes(key))) fail('DPS scenario has unsupported fields');
    if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.version >= SCENARIO_V2_VERSION && value.revision > 1000000000) fail('DPS scenario revision is invalid');
    if (value.layout !== null && !LAYOUTS.has(value.layout)) fail('DPS scenario layout is invalid');
    const hasteReason = scenarioNumber(value.hastePercent, 'hastePercent', value.version >= SCENARIO_V2_VERSION);
    if (hasteReason) fail(hasteReason);
    const hands = {};
    for (const hand of ['primary', 'secondary']) {
      const input = value[hand];
      if (!input || typeof input !== 'object' || Array.isArray(input)) fail('DPS scenario ' + hand + ' assumptions are required');
      if (Object.keys(input).some((key) => !['hitChance', 'mitigationMultiplier', 'damageMultiplier', 'damageBonus', 'attacksPerRound'].includes(key))) fail('DPS scenario ' + hand + ' has unsupported fields');
      hands[hand] = {};
      for (const key of ['hitChance', 'mitigationMultiplier', 'damageMultiplier', 'damageBonus', 'attacksPerRound']) {
        const reason = scenarioNumber(input[key], hand + '.' + key, value.version >= SCENARIO_V2_VERSION);
        if (reason) fail(reason);
        hands[hand][key] = input[key];
      }
    }
    if (value.version === SCENARIO_V1_VERSION) return { version: SCENARIO_V1_VERSION, revision: value.revision, layout: value.layout,
      hastePercent: value.hastePercent, primary: hands.primary, secondary: hands.secondary };
    const combatKeys = Object.keys(SCENARIO_DEFAULTS_V2.combat);
    const procKeys = Object.keys(SCENARIO_DEFAULTS_V2.procs);
    if (!value.combat || typeof value.combat !== 'object' || Object.keys(value.combat).some((key) => !combatKeys.includes(key)) || combatKeys.some((key) => !own(value.combat, key))) fail('DPS scenario combat assumptions are required');
    if (!value.procs || typeof value.procs !== 'object' || Object.keys(value.procs).some((key) => !procKeys.includes(key)) || procKeys.some((key) => !own(value.procs, key))) fail('DPS scenario proc assumptions are required');
    const combat = {}, procs = {};
    const meleeModel = value.meleeModel == null ? 'beastlord' : value.meleeModel;
    if (!['beastlord', ...Object.values(MELEE_MODEL_BY_CLASS)].includes(meleeModel)) fail('Unsupported melee model');
    for (const key of combatKeys) { const reason = scenarioNumber(value.combat[key], 'combat.' + key, true); if (reason) fail(reason); combat[key] = value.combat[key]; }
    for (const key of procKeys) { const reason = scenarioNumber(value.procs[key], 'procs.' + key, true); if (reason) fail(reason); procs[key] = value.procs[key]; }
    if (!Number.isSafeInteger(combat.criticalDifficulty) || combat.criticalDifficulty <= 0 || !Number.isSafeInteger(combat.targetMitigation) || combat.targetMitigation > 100000 || !Number.isSafeInteger(combat.doubleAttackSkill) || combat.criticalDamageMultiplier < 1) fail('DPS critical assumptions are invalid');
    if (value.version === SCENARIO_V2_VERSION) return { version: SCENARIO_V2_VERSION, revision: value.revision, layout: value.layout,
      hastePercent: value.hastePercent, primary: hands.primary, secondary: hands.secondary, combat, procs };
    const spellKeys = Object.keys(SCENARIO_DEFAULTS_V3.spells);
    if (!value.spells || typeof value.spells !== 'object' || Array.isArray(value.spells) ||
        Object.keys(value.spells).some((key) => !spellKeys.includes(key)) || spellKeys.some((key) => key !== 'model' && !own(value.spells, key))) {
      fail('DPS scenario spell assumptions are required');
    }
    const spells = { model: own(value.spells, 'model') ? value.spells.model : 'beastlord' };
    if (!Object.prototype.hasOwnProperty.call(SPELL_MODEL_CYCLES, spells.model)) fail('Unsupported spell model');
    for (const key of spellKeys.filter((key) => key !== 'model')) {
      const reason = scenarioNumber(value.spells[key], 'spells.' + key, true);
      if (reason) fail(reason);
      spells[key] = value.spells[key];
    }
    if (!Number.isSafeInteger(spells.rank) || spells.rank < 1 || spells.rank > 3) fail('Scenario spells.rank must be an integer between 1 and 3');
    const minimumCycle = spells.model === 'wizard-hoarfrost' ? 9 : spells.model === 'magician-spear' ? 12.5 : spells.model === 'enchanter-mindcleave' ? 13 : spells.model === 'necro-pyre' ? 30 : 32;
    if (spells.cycleSeconds < minimumCycle || spells.cycleSeconds > 3600) fail('Scenario spells.cycleSeconds must be between ' + minimumCycle + ' and 3600');
    for (const key of ['landingMultiplier', 'criticalChance', 'meleeDuringCast']) {
      if (spells[key] < 0 || spells[key] > 1) fail('Scenario spells.' + key + ' must be between 0 and 1');
    }
    if (spells.criticalMultiplier < 1 || spells.criticalMultiplier > 100) fail('Scenario spells.criticalMultiplier must be between 1 and 100');
    if (spells.manaPerSecond < 0 || spells.manaPerSecond > 100000) fail('Scenario spells.manaPerSecond must be between 0 and 100000');
    let classAttack;
    if (own(value, 'classAttack')) {
      const input = value.classAttack;
      if (!Object.values(MELEE_MODEL_BY_CLASS).includes(meleeModel) || !input || Array.isArray(input) ||
          Object.keys(input).some((key) => !own(CLASS_ATTACK_DEFAULTS, key))) fail('Invalid classAttack assumptions');
      classAttack = {};
      for (const key of Object.keys(CLASS_ATTACK_DEFAULTS)) {
        if (key === 'primaryPiercingConfirmed') {
          if (typeof input[key] !== 'boolean') fail('classAttack primaryPiercingConfirmed must be boolean');
        } else {
          const reason = scenarioNumber(input[key], 'classAttack.' + key);
          if (reason) fail(reason);
        }
        classAttack[key] = input[key];
      }
      if (input.cycleSeconds < 1 || input.cycleSeconds > 3600 || input.uptime > 1 ||
          input.attacksPerUse > 20 || input.damageMultiplier > 100 || !Number.isInteger(input.skill) || input.skill > 1000) fail('classAttack assumptions are out of bounds');
    }
    return { version: SCENARIO_VERSION, revision: value.revision, layout: value.layout,
      hastePercent: value.hastePercent, primary: hands.primary, secondary: hands.secondary, combat, procs, meleeModel, spells,
      ...(classAttack ? { classAttack } : {}) };
  }

  function hasUniqueKnownWeapon(profile, hand) {
    if (!profile || !Array.isArray(profile.items)) return false;
    const occupants = profile.items.filter((item) => {
      const keys = slotKeys(item);
      return !item.isAugment && keys && keys.has(hand);
    });
    return occupants.length === 1 && slotKeys(occupants[0]).size === 1 && isWeapon(occupants[0]);
  }

  function defaultScenario(profile) {
    const scenario = JSON.parse(JSON.stringify(SCENARIO_DEFAULTS));
    const className = String(profile && profile.cls || '').trim().toLowerCase();
    const model = profile && SPELL_MODEL_BY_CLASS[className];
    if (model && model !== 'beastlord' && Number(profile.level) === 100) {
      scenario.spells = { ...scenario.spells, model, cycleSeconds: SPELL_MODEL_CYCLES[model], manaPerSecond: 1000 };
      return scenario;
    }
    const meleeModel = MELEE_MODEL_BY_CLASS[className];
    if (meleeModel && Number(profile.level) === 100) scenario.meleeModel = meleeModel;
    if (hasUniqueKnownWeapon(profile, 'primary') && hasUniqueKnownWeapon(profile, 'secondary')) scenario.layout = 'dual-wield';
    return scenario;
  }

  function upgradeScenario(value) {
    const validated = validateScenario(value);
    if (validated.version === SCENARIO_VERSION) return validated;
    const draft = { ...JSON.parse(JSON.stringify(SCENARIO_DEFAULTS_V3)), ...validated, version: SCENARIO_VERSION,
      primary: { ...JSON.parse(JSON.stringify(SCENARIO_DEFAULTS_V2.primary)), ...validated.primary },
      secondary: { ...JSON.parse(JSON.stringify(SCENARIO_DEFAULTS_V2.secondary)), ...validated.secondary },
      combat: { ...JSON.parse(JSON.stringify(SCENARIO_DEFAULTS_V2.combat)), ...validated.combat },
      procs: { ...JSON.parse(JSON.stringify(SCENARIO_DEFAULTS_V2.procs)), ...validated.procs } };
    return draft;
  }

  function referenceScenario(profile, saved) {
    const fallback = defaultScenario(profile);
    if (saved == null) return { available: true, scenario: fallback, scenarioDefault: true };
    try {
      const scenario = validateScenario(saved);
      return { available: true, scenario, scenarioDefault: false };
    } catch (error) {
      return { available: false, reason: error.message, scenario: fallback, scenarioDefault: false,
        scenarioRevision: Number.isSafeInteger(saved && saved.revision) && saved.revision >= 0 ? saved.revision : 0 };
    }
  }

  function referenceOutputs(reason) {
    return [
      unavailable('Weapon melee DPS', reason),
      unavailable('Weapon proc DPS', reason),
      unavailable('Weapon subtotal', reason),
    ];
  }
  function playerReferenceOutputs(reason, version = SCENARIO_V2_VERSION) {
    const metrics = version >= SCENARIO_VERSION
      ? ['Melee stats DPS', 'Melee DPS', 'Weapon proc DPS', 'Spell DPS', 'Spell stats DPS', 'Player DPS']
      : ['Melee stats DPS', 'Melee DPS', 'Weapon proc DPS', 'Melee + procs DPS'];
    return metrics.map((metric) => unavailable(metric, reason));
  }

  function identityMatches(left, right) {
    if (!left || !right) return false;
    if (left === right) return true;
    const leftId = String(left.id || ''), rightId = String(right.id || '');
    if (leftId && rightId) return leftId === rightId;
    return String(left.name || '').trim() === String(right.name || '').trim() &&
      String(left.slot || '').trim() === String(right.slot || '').trim();
  }

  function validateAssumptions(assumptions) {
    if (!assumptions || typeof assumptions !== 'object' || Array.isArray(assumptions)) fail('DPS assumptions are required');
    if (own(assumptions, 'scope') && !['selected-hand', 'equipped-weapons'].includes(assumptions.scope)) fail('DPS scope is unsupported');
    for (const key of ['hand', 'layout']) if (typeof assumptions[key] !== 'string' || !assumptions[key].trim()) fail('DPS assumption ' + key + ' is required');
    if (!HANDS.has(assumptions.hand)) fail('DPS hand must be primary or secondary');
    if (!LAYOUTS.has(assumptions.layout)) fail('DPS layout is unsupported');
    return assumptions;
  }

  function meleeReason(assumptions) {
    for (const key of ['hastePercent', 'hitChance', 'mitigationMultiplier', 'damageMultiplier', 'damageBonus', 'attacksPerRound']) {
      if (!own(assumptions, key) || !finite(assumptions[key])) return 'DPS assumption ' + key + ' must be a finite number';
    }
    if (assumptions.hastePercent < 0) return 'DPS hastePercent must be non-negative';
    if (assumptions.hitChance < 0 || assumptions.hitChance > 1) return 'DPS hitChance must be between 0 and 1';
    if (assumptions.mitigationMultiplier < 0 || assumptions.mitigationMultiplier > 1) return 'DPS mitigationMultiplier must be between 0 and 1';
    for (const key of ['damageMultiplier', 'damageBonus', 'attacksPerRound']) if (assumptions[key] < 0) return 'DPS assumption ' + key + ' must be non-negative';
    return '';
  }

  function validateProfile(profile, worn) {
    if (!profile || typeof profile !== 'object') fail('Character profile is required');
    if (!['beastlord', 'bst'].includes(String(profile.cls || '').trim().toLowerCase()) || Number(profile.level) !== 100) {
      fail('The DPS estimate supports level-100 Beastlords only');
    }
    if (!Array.isArray(profile.items)) fail('Character equipment is required');
    const exactIndex = profile.items.findIndex((item) => item === worn);
    const matches = profile.items.map((item, index) => identityMatches(item, worn) ? index : -1).filter((index) => index >= 0);
    if (exactIndex < 0 && matches.length !== 1) fail(matches.length ? 'Worn item matches multiple equipment entries' : 'Worn item is not in the character equipment');
    return exactIndex >= 0 ? exactIndex : matches[0];
  }

  function validateItems(profile, candidate, worn, assumptions, wornIndex) {
    if (!candidate || typeof candidate !== 'object' || !worn || typeof worn !== 'object') fail('Candidate and worn items are required');
    if (candidate.isAugment || worn.isAugment) fail('Augments cannot be used for DPS estimates');
    const wornKeys = slotKeys(worn), candidateKeys = slotKeys(candidate);
    if (!wornKeys || !candidateKeys || !wornKeys.has(assumptions.hand)) fail('Worn item is not in the selected weapon hand');
    if (wornKeys.size !== 1) fail('Worn item must identify one actual weapon hand');
    if (!candidateKeys.has(assumptions.hand) || ![...wornKeys].some((key) => candidateKeys.has(key))) fail('Candidate is incompatible with the worn weapon slot');
    if (assumptions.layout === 'two-hand' && candidateKeys.size !== 1) fail('Two-hand layout requires a candidate that occupies only the primary hand');
    if (!isWeapon(worn) || !isWeapon(candidate)) fail('Both items need known Damage and Delay weapon stats');
    const otherHand = assumptions.hand === 'primary' ? 'secondary' : 'primary';
    const others = profile.items.filter((item) => {
      const keys = slotKeys(item);
      return keys && keys.has(otherHand) && !item.isAugment && item !== profile.items[wornIndex];
    });
    if (others.length > 1) fail('Character has multiple items in the other weapon hand');
    const other = others[0] || null;
    if (assumptions.layout === 'dual-wield' && (!other || !isWeapon(other))) fail('Dual-wield layout requires a known secondary weapon');
    if (assumptions.layout === 'two-hand' && (assumptions.hand !== 'primary' || other)) fail('Two-hand layout requires primary hand only');
    if (assumptions.layout === 'one-hand-shield' && (assumptions.hand !== 'primary' || !other || isWeapon(other))) fail('One-hand-shield layout requires a non-weapon secondary item');
    return other;
  }

  function actualWeaponItems(profile, hand) {
    return profile.items.map((item, index) => ({ item, index, keys: slotKeys(item) }))
      .filter(({ item, keys }) => !item.isAugment && keys && keys.has(hand));
  }

  function validateEquippedItems(profile, candidate, worn, assumptions, wornIndex) {
    if (!candidate || typeof candidate !== 'object' || !worn || typeof worn !== 'object') fail('Candidate and worn items are required');
    if (candidate.isAugment || worn.isAugment) fail('Augments cannot be used for DPS estimates');
    const wornKeys = slotKeys(worn), candidateKeys = slotKeys(candidate);
    if (!wornKeys || !candidateKeys || !wornKeys.has(assumptions.hand) || wornKeys.size !== 1) fail('Worn item must identify one actual weapon hand');
    if (!candidateKeys.has(assumptions.hand) || ![...wornKeys].some((key) => candidateKeys.has(key))) fail('Candidate is incompatible with the worn weapon slot');
    if (!isWeapon(worn) || !isWeapon(candidate)) fail('Both items need known Damage and Delay weapon stats');

    const byHand = Object.fromEntries([...HANDS].map((hand) => [hand, actualWeaponItems(profile, hand)]));
    for (const hand of HANDS) if (byHand[hand].length > 1) fail('Character has multiple items in the ' + hand + ' weapon hand');
    for (const hand of HANDS) if (byHand[hand].some(({ keys }) => keys.size !== 1)) fail('Each equipped weapon must identify one actual weapon hand');
    if (assumptions.layout === 'two-hand' && candidateKeys.size !== 1) fail('Two-hand layout requires a candidate that occupies only the primary hand');
    if (assumptions.layout === 'dual-wield') {
      if (byHand.primary.length !== 1 || byHand.secondary.length !== 1 || byHand.primary[0].index === byHand.secondary[0].index ||
          !isWeapon(byHand.primary[0].item) || !isWeapon(byHand.secondary[0].item)) {
        fail('Dual-wield layout requires one unambiguous weapon in each hand');
      }
    } else if (assumptions.hand !== 'primary' || byHand.primary.length !== 1) {
      fail(assumptions.layout === 'two-hand' ? 'Two-hand layout requires primary hand only' : 'One-hand-shield layout requires a primary weapon');
    }
    if (assumptions.layout === 'two-hand' && byHand.secondary.length) fail('Two-hand layout requires primary hand only');
    if (assumptions.layout === 'one-hand-shield') {
      const secondary = actualWeaponItems(profile, 'secondary');
      if (secondary.length !== 1 || isWeapon(secondary[0].item)) fail('One-hand-shield layout requires a non-weapon secondary item');
    }
    const selected = byHand[assumptions.hand] && byHand[assumptions.hand][0];
    if (!selected || selected.index !== wornIndex) fail('Worn item is not the unique equipped weapon in the selected hand');
    return {
      primary: byHand.primary[0] && byHand.primary[0].item,
      secondary: byHand.secondary[0] && byHand.secondary[0].item,
    };
  }

  function effects(item) { return Array.isArray(item.effects) ? item.effects : []; }

  function procComponent(worn, candidate, assumptions) {
    if ((worn.effectsKnown !== true || candidate.effectsKnown !== true) && assumptions.procListsConfirmed !== true) {
      return { available: false, reason: 'Proc effects are unavailable until both items have a known effect list.' };
    }
    if (!Array.isArray(assumptions.procAssumptions)) return { available: false, reason: 'DPS procAssumptions are required.' };
    const seenAssumptions = new Set();
    for (const entry of assumptions.procAssumptions) {
      if (!entry || typeof entry !== 'object' || typeof entry.key !== 'string' || !entry.key.trim()) return { available: false, reason: 'Each proc assumption needs an exact effect key.' };
      if (seenAssumptions.has(entry.key)) return { available: false, reason: 'Duplicate proc assumption key: ' + entry.key };
      seenAssumptions.add(entry.key);
      for (const key of ['procsPerMinute', 'damagePerProc']) if (!own(entry, key) || !finite(entry[key]) || entry[key] < 0) return { available: false, reason: 'Proc assumption ' + entry.key + ' needs a non-negative finite ' + key + '.' };
    }
    const all = [worn, candidate].flatMap(effects);
    if (all.some((effect) => !effect || !EFFECT_TYPES.has(String(effect.type || '').toLowerCase()))) {
      return { available: false, reason: 'An effect has an unresolved type that may be a weapon proc.' };
    }
    const procs = [worn, candidate].map((item) => effects(item).filter((effect) => String(effect.type || '').toLowerCase() === 'proc'));
    if (procs.some((list) => list.some((effect, index) => list.findIndex((other) => String(other.key || '') === String(effect.key || '')) !== index))) {
      return { available: false, reason: 'Duplicate weapon proc effect keys are unresolved.' };
    }
    const signatures = new Map();
    for (const effect of procs.flat()) {
      const key = String(effect.key || ''), signature = String(effect.rank || '') + '\u0000' + String(effect.raw || '');
      const values = signatures.get(key) || new Set(); values.add(signature); signatures.set(key, values);
    }
    if ([...signatures.values()].some((values) => values.size > 1)) return { available: false, reason: 'The same weapon proc key has conflicting ranks or effect text.' };
    const byKey = new Map(assumptions.procAssumptions.map((entry) => [entry.key, entry]));
    const keys = new Set(procs.flat().map((effect) => String(effect.key || '')));
    if ([...keys].some((key) => !key || !byKey.has(key))) return { available: false, reason: 'Every weapon proc needs an explicit rate and landed damage assumption by exact effect key.' };
    if ([...byKey.keys()].some((key) => !keys.has(key))) return { available: false, reason: 'Proc assumptions include an effect key absent from both weapon effect lists.' };
    const values = procs.map((list) => [...new Set(list.map((effect) => String(effect.key)))].reduce((sum, key) => {
      const entry = byKey.get(key); return sum + entry.procsPerMinute * entry.damagePerProc / 60;
    }, 0));
    return { available: true, current: values[0], candidate: values[1] };
  }

  function projectSelected(profile, candidate, worn, assumptions) {
    validateAssumptions(assumptions);
    const wornIndex = validateProfile(profile, worn);
    validateItems(profile, candidate, worn, assumptions, wornIndex);
    const rows = calculateHand(worn, candidate, assumptions, ['Melee DPS', 'Proc DPS', 'Selected-hand subtotal']);
    const outputs = rows.map((entry) => entry.output);
    return { mode: 'dps', rule: RULE, outputs,
      assumptions: [
        'Selected ' + assumptions.hand + ' hand in ' + assumptions.layout + ' layout; unchanged character contributions cancel.',
        'Swings per second = 10 / Delay × (1 + hastePercent / 100) × attacksPerRound.',
        'Melee uses hitChance, Damage × damageMultiplier × mitigationMultiplier, and flat damageBonus per landed strike.',
        'Proc damagePerProc is explicit landed damage and is divided from procsPerMinute into DPS.',
        'This slice excludes base-weapon augments, buff procs, and haste or ATK gear changes.',
        ...(assumptions.procListsConfirmed === true ? ['Weapon proc list completeness confirmed for this scenario.'] : []),
        'Spell focus/rotation and pet damage are not modeled.',
      ],
      scope: { hand: assumptions.hand, layout: assumptions.layout, singleHand: true },
      spellFocus: { available: false, reason: 'Spell focus and spell rotation are not modeled.' },
      pet: { available: false, reason: 'Pet damage is not modeled.' },
    };
  }

  function handAssumptions(assumptions, other) {
    return { ...other, hastePercent: assumptions.hastePercent };
  }

  function calculateHand(current, candidate, assumptions, labels) {
    const meleeUnavailable = meleeReason(assumptions) ||
      (!isWeapon(current) || !isWeapon(candidate) ? 'Both items need known Damage and Delay weapon stats' : '');
    const melee = (item) => 10 / stat(item, 'Delay') * (1 + assumptions.hastePercent / 100) * assumptions.attacksPerRound * assumptions.hitChance *
      (stat(item, 'Damage') * assumptions.damageMultiplier * assumptions.mitigationMultiplier + assumptions.damageBonus);
    const proc = procComponent(current, candidate, assumptions);
    const meleeOutput = meleeUnavailable ? unavailable(labels[0], meleeUnavailable) : output(labels[0], melee(current), melee(candidate));
    const procOutput = proc.available ? output(labels[1], proc.current, proc.candidate) : unavailable(labels[1], proc.reason);
    const subtotal = meleeOutput.available && procOutput.available
      ? output(labels[2], meleeOutput.current + procOutput.current, meleeOutput.candidate + procOutput.candidate)
      : unavailable(labels[2], 'Subtotal requires both melee and proc components to be available.');
    return [meleeOutput, procOutput, subtotal].map((entry, index) => ({ output: entry, component: ['melee', 'proc', 'subtotal'][index] }));
  }

  function projectHand(current, candidate, assumptions, hand) {
    const title = hand[0].toUpperCase() + hand.slice(1);
    return calculateHand(current, candidate, assumptions, [title + ' melee DPS', title + ' proc DPS', title + ' subtotal'])
      .map(({ output, component }) => ({ ...output, hand, component }));
  }

  function projectEquipped(profile, candidate, worn, assumptions) {
    const wornIndex = validateProfile(profile, worn);
    const equipped = validateEquippedItems(profile, candidate, worn, assumptions, wornIndex);
    const selected = assumptions.hand;
    const selectedCurrent = equipped[selected];
    const selectedCandidate = candidate;
    const other = selected === 'primary' ? 'secondary' : 'primary';
    const selectedRows = projectHand(selectedCurrent, selectedCandidate, assumptions, selected);
    const outputs = [];
    const byHand = { [selected]: selectedRows };
    if (assumptions.layout === 'dual-wield') {
      const otherAssumptions = handAssumptions(assumptions, assumptions.otherHand);
      byHand[other] = projectHand(equipped[other], equipped[other], otherAssumptions, other);
    }
    for (const hand of ['primary', 'secondary']) if (byHand[hand]) outputs.push(...byHand[hand]);
    const activeHands = assumptions.layout === 'dual-wield' ? ['primary', 'secondary'] : ['primary'];
    const aggregate = (component, label) => {
      const rows = activeHands.map((hand) => byHand[hand].find((entry) => entry.component === component));
      if (rows.every((entry) => entry.available)) return output(label, rows.reduce((sum, entry) => sum + entry.current, 0), rows.reduce((sum, entry) => sum + entry.candidate, 0));
      return unavailable(label, 'Weapon total requires all active hand components to be available.');
    };
    outputs.push(aggregate('melee', 'Weapon melee DPS'), aggregate('proc', 'Weapon proc DPS'), aggregate('subtotal', 'Weapon subtotal'));
    return { mode: 'dps', rule: EQUIPPED_RULE, outputs,
      assumptions: [
        'Equipped weapon scope in ' + assumptions.layout + ' layout; unchanged character contributions cancel.',
        'Each active hand uses its own melee and proc assumptions; hastePercent is shared.',
        'Weapon totals include only active attack hands; shields and absent hands are excluded.',
        'This slice excludes base-weapon augments, buff procs, and haste or ATK gear changes.',
        'Spell focus/rotation and pet damage are not modeled.',
        ...(assumptions.procListsConfirmed === true || assumptions.otherHand && assumptions.otherHand.procListsConfirmed === true ? ['Weapon proc list completeness confirmed for this scenario.'] : []),
      ],
      scope: { hand: assumptions.hand, layout: assumptions.layout, singleHand: false },
      spellFocus: { available: false, reason: 'Spell focus and spell rotation are not modeled.' },
      pet: { available: false, reason: 'Pet damage is not modeled.' },
    };
  }

  function referenceProject(profile, candidate, worn, saved, confirmation = {}) {
    const reference = referenceScenario(profile, saved);
    const base = {
      mode: 'dps-reference', rule: REFERENCE_RULE, outputs: [],
      scenario: reference.scenario, scenarioRevision: reference.scenarioRevision || (reference.scenario && reference.scenario.revision) || 0,
      scenarioDefault: reference.scenarioDefault === true,
      assumptions: [
        'One shared editable melee reference scenario is applied to both gear sets.',
        'This is an illustrative level-100 Beastlord melee estimate; it excludes spell rotation, pet damage, ATK conversion, AA changes, haste gear, and proc rate or landed-damage assumptions.',
        'Weapon effects are not inferred from item text; procs remain unavailable unless separately modeled with explicit manual assumptions.',
      ],
      scope: { hand: null, layout: reference.scenario && reference.scenario.layout || null, singleHand: false },
      spellFocus: { available: false, reason: 'Spell focus and spell rotation are not modeled.' },
      pet: { available: false, reason: 'Pet damage is not modeled.' },
    };
    if (!reference.available) {
      base.outputs = referenceOutputs(reference.reason);
      base.reason = reference.reason;
      return base;
    }
    const className = String(profile && profile.cls || '').trim().toLowerCase();
    const spellModel = SPELL_MODEL_BY_CLASS[className], meleeModel = MELEE_MODEL_BY_CLASS[className];
    const supported = profile && (spellModel || meleeModel || ['beastlord', 'bst'].includes(className)) && Number(profile.level) === 100;
    if (!supported) {
      base.outputs = referenceOutputs('The reference DPS estimate supports only the cataloged level-100 class models.');
      base.reason = 'The reference DPS estimate supports only the cataloged level-100 class models.';
      return base;
    }
    const scenario = reference.scenario;
    if (spellModel && spellModel !== 'beastlord' && (scenario.version < SCENARIO_VERSION || scenario.spells.model !== spellModel)) {
      base.reason = 'This caster reference requires the v3 ' + spellModel + ' spell model.';
      base.outputs = [unavailable('Spell DPS', base.reason)];
      return base;
    }
    if (meleeModel && (scenario.version < SCENARIO_VERSION || scenario.meleeModel !== meleeModel)) {
      base.reason = 'This melee reference requires the v3 ' + meleeModel + ' scenario.';
      base.outputs = [unavailable('Melee DPS', base.reason)];
      return base;
    }
    if (scenario && scenario.version < SCENARIO_VERSION) base.upgradeScenario = upgradeScenario(scenario);
    if (scenario.version >= SCENARIO_V2_VERSION) {
      const model = LC.playerDamage;
      if (!model || typeof model.project !== 'function') {
        const reason = 'The player-damage reference model is unavailable.';
        base.outputs = playerReferenceOutputs(reason, scenario.version); base.reason = reason; return base;
      }
      try {
        const result = model.project(profile, candidate, worn, scenario, confirmation);
        return { ...result, scenarioDefault: reference.scenarioDefault === true,
          ...(base.upgradeScenario ? { upgradeScenario: base.upgradeScenario } : {}) };
      } catch (error) {
        const reason = error && error.message || String(error);
        base.outputs = playerReferenceOutputs(reason, scenario.version); base.reason = reason; return base;
      }
    }
    if (!scenario.layout) {
      const reason = 'Choose a melee layout for this character; a default layout requires one known weapon in each hand.';
      base.outputs = referenceOutputs(reason); base.reason = reason; return base;
    }
    const wornKeys = slotKeys(worn);
    if (!wornKeys || wornKeys.size !== 1 || !HANDS.has([...wornKeys][0])) {
      const reason = 'The worn comparison item must identify one actual weapon hand.';
      base.outputs = referenceOutputs(reason); base.reason = reason; return base;
    }
    const hand = [...wornKeys][0], other = hand === 'primary' ? 'secondary' : 'primary';
    base.scope.hand = hand;
    const assumptions = {
      scope: 'equipped-weapons', hand, layout: scenario.layout, hastePercent: scenario.hastePercent,
      ...scenario[hand], procAssumptions: [],
      otherHand: { ...scenario[other], procAssumptions: [] },
    };
    try {
      const result = projectEquipped(profile, candidate, worn, assumptions);
      return { ...result, mode: 'dps-reference', rule: REFERENCE_RULE,
        scenario, scenarioRevision: scenario.revision, scenarioDefault: reference.scenarioDefault === true,
        assumptions: base.assumptions, spellFocus: base.spellFocus, pet: base.pet,
        ...(base.upgradeScenario ? { upgradeScenario: base.upgradeScenario } : {}) };
    } catch (error) {
      const reason = error && error.message || String(error);
      base.outputs = referenceOutputs(reason); base.reason = reason; return base;
    }
  }

  function project(profile, candidate, worn, assumptions) {
    validateAssumptions(assumptions);
    return assumptions.scope === 'equipped-weapons'
      ? projectEquipped(profile, candidate, worn, assumptions)
      : projectSelected(profile, candidate, worn, assumptions);
  }

  LC.dps = { RULE, project, REFERENCE_RULE, SCENARIO_VERSION, SCENARIO_V1_VERSION, SCENARIO_V2_VERSION,
    SCENARIO_DEFAULTS, SCENARIO_DEFAULTS_V1, SCENARIO_DEFAULTS_V2, SCENARIO_DEFAULTS_V3, CLASS_ATTACK_DEFAULTS,
    defaultsV2: SCENARIO_DEFAULTS_V2, defaultsV3: SCENARIO_DEFAULTS_V3, validateScenario, upgradeScenario,
    referenceScenario, referenceProject, stat, weaponNumeric: stat };
})();
