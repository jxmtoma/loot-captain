// Bounded direct-heal reference; spell facts are separate from encounter assumptions.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const CLASSES = { cleric: 'cleric', clr: 'cleric', druid: 'druid', dru: 'druid', shaman: 'shaman', shm: 'shaman' };
  const SPELLS = {
    cleric: { name: 'Graceful Remedy', firstId: 34103, level: 96, castSeconds: .5, recastSeconds: 4.75,
      heals: [7611, 7992, 8392], lowHeals: [9514, 9990, 10490], mana: [990, 1030, 1071] },
    druid: { name: 'Sterivida', firstId: 34887, level: 97, castSeconds: 3.75, recastSeconds: 1.5,
      heals: [9964, 10462, 10985], mana: [1045, 1087, 1130] },
    shaman: { name: "Blezon's Mending", firstId: 35412, level: 98, castSeconds: 3.75, recastSeconds: 1.5,
      heals: [9991, 10491, 11016], mana: [1584, 1647, 1713] },
  };
  const FIELDS = [
    ['rank', 'Heal rank (1–3)', 1, 1, 3], ['cycleSeconds', 'Seconds per heal (cast plus recovery/recast)', 5.25, 1, 3600],
    ['castHastePercent', 'Shared cast haste (%)', 0, 0, 100],
    ['healBonusPercent', 'Shared base-heal bonus (focus/AA, %)', 0, 0, 500],
    ['criticalChance', 'Heal critical chance (0–1, double healing)', 0, 0, 1],
    ['overhealFraction', 'Overhealing fraction (0–1)', 0, 0, 1],
    ['lowHealthFraction', 'Cleric casts on targets at/below 20% HP (0–1)', 0, 0, 1],
    ['baseMana', 'Base mana before WIS and gear', 2168.461, 0, 1000000],
    ['baseWisdom', 'Wisdom before gear', 100, 0, 10000], ['wisdomCap', 'Wisdom cap before heroics', 730, 1, 10000],
    ['manaMultiplier', 'Mana pool multiplier (AA/buffs)', 1, 1, 10],
    ['manaCostReduction', 'Shared mana-cost reduction (0–0.95)', 0, 0, .95],
    ['baseManaPerSecond', 'Non-gear mana regeneration/second', 100, 0, 100000],
    ['itemManaRegenCap', 'Worn mana regeneration cap per six-second tick', 30, 0, 10000],
    ['startingManaFraction', 'Starting mana fraction (0–1)', 1, 0, 1],
    ['durationSeconds', 'Encounter duration (seconds)', 180, 1, 36000],
  ];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
  const classOf = (profile) => { const key = String(profile && profile.cls || '').trim().toLowerCase(); return own(CLASSES, key) ? CLASSES[key] : null; };
  const supported = (profile) => !!classOf(profile) && Number(profile.level) === 100;
  function defaults(profile) {
    const spellModel = classOf(profile) || 'cleric';
    return { version: 1, revision: 0, spellModel, ...Object.fromEntries(FIELDS.map(([key, , value]) => [key, value])),
      healBonusPercent: spellModel === 'cleric' ? 5 : 0 };
  }
  function validateScenario(input) {
    const keys = ['version', 'revision', 'spellModel', ...FIELDS.map(([key]) => key)];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key)) ||
        input.version !== 1 || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision > 1000000000 || !own(SPELLS, input.spellModel)) throw new Error('Invalid healer scenario');
    for (const [key, , , min, max] of FIELDS) if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error('Healer ' + key + ' must be between ' + min + ' and ' + max);
    if (!Number.isInteger(input.rank)) throw new Error('Healer rank must be an integer');
    const spell = SPELLS[input.spellModel];
    if (input.cycleSeconds < spell.castSeconds / (1 + input.castHastePercent / 100) + Math.max(1.5, spell.recastSeconds)) throw new Error('Healer cycle is shorter than cast plus recovery/recast');
    return Object.fromEntries(keys.map((key) => [key, input[key]]));
  }
  function sum(profile, name) {
    const values = profile.items.map((item) => LC.referenceStats.itemStat(item, name));
    return values.some((n) => n === null || n < 0 && name !== 'WIS') ? NaN : values.reduce((a, b) => a + b, 0);
  }
  function values(profile, scenario) {
    const spell = SPELLS[scenario.spellModel], index = scenario.rank - 1;
    const healAmount = sum(profile, 'Heal Amount');
    const expected = (base) => (base * (1 + scenario.healBonusPercent / 100) + LC.playerDamage.spellExtra(healAmount,
      { ...spell, recoverySeconds: 1.5, baseDamage: base })) * (1 + scenario.criticalChance);
    const heal = spell.lowHeals ? expected(spell.heals[index]) * (1 - scenario.lowHealthFraction) + expected(spell.lowHeals[index]) * scenario.lowHealthFraction : expected(spell.heals[index]);
    const effectiveHeal = heal * (1 - scenario.overhealFraction);
    const wis = Math.max(0, Math.min(scenario.wisdomCap, scenario.baseWisdom + sum(profile, 'WIS'))) + sum(profile, 'HWIS');
    const effectiveWis = wis > 200 ? wis - Math.floor((wis - 200) / 2) : wis;
    const mana = (scenario.baseMana + 9.15 * (wis > 100 ? effectiveWis + Math.floor((3 * effectiveWis - 300) / 2) : effectiveWis) + sum(profile, 'MANA') + 10 * sum(profile, 'HWIS')) * scenario.manaMultiplier;
    const regen = scenario.baseManaPerSecond + Math.min(scenario.itemManaRegenCap, sum(profile, 'ManaRegen')) / 6;
    const cost = spell.mana[index] * (1 - scenario.manaCostReduction);
    const spend = cost / scenario.cycleSeconds;
    // ponytail: continuous mana budget, not a cast timeline; discrete scheduling can follow combat validation.
    const budget = mana * scenario.startingManaFraction / scenario.durationSeconds + regen;
    const uptime = Math.min(1, budget / spend);
    return { mana, regen, heal: effectiveHeal, hps: effectiveHeal / scenario.cycleSeconds,
      efficiency: effectiveHeal / cost, spend, sustained: effectiveHeal / scenario.cycleSeconds * Math.min(1, regen / spend),
      encounter: effectiveHeal / scenario.cycleSeconds * uptime, uptime: uptime * 100 };
  }
  function project(profile, candidate, worn, saved) {
    const result = { mode: 'healer-reference', rule: { key: 'healer-direct-reference', version: 1, name: 'Level-100 direct-heal reference' },
      outputs: [], fields: FIELDS, scenarioDefault: saved == null, partial: true,
      assumptions: ['One direct heal repeated under shared assumptions; not an optimal healing rotation. Healing outputs exclude estimated overhealing.',
        'Heal Amount uses the existing pinned timing formula before double-heal crit. Native spell timing sets Heal Amount scaling, not the edited cycle.',
        'WIS/HWIS and mana affect the pool; worn ManaRegen is capped and divided by six. Non-gear regeneration is separate.',
        'Encounter HPS uses a continuous starting-mana plus regeneration budget. Long-run HPS uses regeneration only; neither models exact cast scheduling.',
        'Gear focus effects are excluded. The shared healing bonus, crit, haste and mana savings are assumptions; imported AA ownership is not inferred.',
        'Omitted RaidLoot/legacy stats count as zero; unresolved items, explicit unknown values and partial OpenDKP omissions remain unavailable. Augments stay equipped; transfers are not simulated.'],
      excluded: ['Gear focus changes', 'HoTs', 'Group heals', 'Triggered heals', 'Cooldowns', 'Cannibalization/mana recovery abilities', 'Healing demand/target scheduling'],
      sources: [
        { label: 'Healing and Heal Amount reference', url: 'https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/effects.cpp' },
        { label: 'Mana pool reference', url: 'https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client_mods.cpp' },
        { label: 'Level-100 mana factors', url: 'https://github.com/GiverofMemory/NostalgiaEQ-Client/blob/71b420046d0ceca1c11d3d40f875112673178a2a/BaseData.txt' },
      ] };
    if (!supported(profile)) { result.reason = 'Healer estimates support level-100 Cleric, Druid and Shaman profiles.'; return result; }
    const scenario = validateScenario(saved == null ? defaults(profile) : saved);
    if (scenario.spellModel !== classOf(profile)) throw new Error('Healer scenario does not match this class');
    result.scenario = scenario; result.scenarioRevision = scenario.revision;
    const spell = SPELLS[scenario.spellModel], spellId = spell.firstId + scenario.rank - 1;
    result.spellName = spell.name + (scenario.rank > 1 ? ' Rk. ' + ['I', 'II', 'III'][scenario.rank - 1] : '');
    result.sources.push({ label: result.spellName, url: 'https://www.raidloot.com/spells?name=' + spellId });
    const canonicalSlot = typeof parserCanonicalSlot === 'function' ? parserCanonicalSlot : LC.slots.canonicalSlot;
    const beforeSlot = canonicalSlot(worn && worn.slot), afterSlot = canonicalSlot(candidate && candidate.slot);
    const index = profile.items.indexOf(worn);
    if (index < 0 || !beforeSlot || !afterSlot || (beforeSlot.keys || [beforeSlot.key]).length !== 1 || !(afterSlot.keys || [afterSlot.key]).includes(beforeSlot.key) || worn.isAugment || candidate.isAugment) {
      result.reason = 'Choose a compatible equipped base item; augment replacements are not modeled.'; return result;
    }
    const after = { ...profile, items: profile.items.slice() }; after.items[index] = { ...candidate, slot: worn.slot };
    const a = values(profile, scenario), b = values(after, scenario);
    const names = ['Heal Amount', 'MANA', 'WIS', 'HWis', 'ManaRegen'];
    result.unresolved = [...LC.referenceStats.statIssues(profile, names, LC.referenceStats.itemStat, ['WIS']),
      ...LC.referenceStats.statIssues(after, names, LC.referenceStats.itemStat, ['WIS'])];
    result.unresolved = [...new Map(result.unresolved.map((issue) => [JSON.stringify(issue), issue])).values()];
    result.outputs = [['Mana pool', 'mana'], ['Mana regeneration/second', 'regen'], ['Effective heal/cast', 'heal'], ['Casting HPS', 'hps'],
      ['Healing/mana', 'efficiency'], ['Mana spending/second', 'spend', true], ['Long-run HPS', 'sustained'], ['Encounter HPS', 'encounter'], ['Encounter casting uptime (%)', 'uptime']].map(([metric, key, lowerIsBetter = false]) =>
      Number.isFinite(a[key]) && Number.isFinite(b[key]) && a[key] >= 0 && b[key] >= 0 ? { metric, current: a[key], candidate: b[key], delta: b[key] - a[key], available: true, lowerIsBetter, partial: true }
        : { metric, available: false, reason: result.unresolved.length ? result.unresolved.map((issue) => issue.stat + ' on ' + issue.item + ' (' + issue.slot + '): ' + issue.reason).join('; ') : 'Healing or mana calculation is outside numeric bounds.' });
    return result;
  }
  LC.healer = { project, validateScenario, defaults, supported, classOf };
})();
