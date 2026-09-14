// Physical tank reference: explicit encounter assumptions, not a combat simulator.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const classes = { warrior: [3616.525, 10, 510, .35], war: [3616.525, 10, 510, .35],
    paladin: [3467.1436, 9.6, 488, .33], pal: [3467.1436, 9.6, 488, .33],
    shadowknight: [3467.1436, 9.6, 488, .33], shd: [3467.1436, 9.6, 488, .33], sk: [3467.1436, 9.6, 488, .33] };
  const FIELDS = [
    ['baseHp', 'Base HP before stamina, gear and multiplier', 3616.525, 1, 1000000],
    ['baseStamina', 'Stamina before gear', 100, 0, 10000], ['staminaCap', 'Stamina cap before heroics', 730, 1, 10000],
    ['baseAgility', 'Agility before gear', 100, 0, 10000], ['agilityCap', 'Agility cap before heroics', 730, 1, 10000],
    ['hpMultiplier', 'HP multiplier (AA/buffs)', 1, 1, 10],
    ['defenseSkill', 'Defense skill', 400, 0, 1000], ['extraArmor', 'Other pre-softcap armor (class/race/buffs)', 0, 0, 10000],
    ['softcapBonusPct', 'Armor softcap bonus (%)', 0, 0, 1000],
    ['enemyOffense', 'Enemy offense rating', 1000, 0, 100000],
    ['enemyMinHit', 'Enemy minimum hit before damage reduction', 1000, 1, 1000000],
    ['enemyMaxHit', 'Enemy maximum hit before damage reduction', 10000, 1, 1000000],
    ['swingsPerSecond', 'Enemy attack attempts/second', 1, .01, 100],
    ['landingChance', 'Enemy landing chance after avoidance (0–1)', .8, .01, 1],
    ['damageReduction', 'Other physical damage reduction (0–0.95)', 0, 0, .95],
  ];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
  const supported = (profile) => Number(profile && profile.level) === 100 && own(classes, String(profile.cls || '').toLowerCase());
  const numeric = (value) => {
    const n = value && typeof value === 'object' ? value.num : value;
    if (typeof n === 'number') return Number.isFinite(n) ? n : null;
    return typeof n === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(n.trim()) && Number.isFinite(Number(n)) ? Number(n) : null;
  };
  function stat(item, name) {
    const stats = item && item.stats || {};
    const entry = Object.entries(stats).find(([key]) => key.replace(/[\s_]/g, '').toUpperCase() === name);
    if (entry) { const n = numeric(entry[1]); return n !== null && n >= 0 ? n : null; }
    const sources = Object.values(stats).map((v) => v && typeof v === 'object' ? v.source : 'legacy');
    return !sources.length || sources.includes('opendkp') && !sources.includes('raidloot') ? null : 0;
  }
  function defaults(profile) {
    return { version: 1, revision: 0, ...Object.fromEntries(FIELDS.map(([key, , value]) => [key, value])),
      baseHp: supported(profile) ? classes[String(profile.cls).toLowerCase()][0] : 3616.525, shieldEquipped: false };
  }
  function validateScenario(input) {
    const keys = ['version', 'revision', 'shieldEquipped', ...FIELDS.map(([key]) => key)];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key)) ||
        input.version !== 1 || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision > 1000000000 || typeof input.shieldEquipped !== 'boolean') throw new Error('Invalid tank scenario');
    for (const [key, , , min, max] of FIELDS) if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error('Tank ' + key + ' must be between ' + min + ' and ' + max);
    if (input.enemyMinHit > input.enemyMaxHit || !Number.isInteger(input.enemyOffense) || !Number.isInteger(input.defenseSkill)) throw new Error('Invalid tank enemy damage or skill assumptions');
    return Object.fromEntries(keys.map((key) => [key, input[key]]));
  }
  const slot = (item) => {
    const fn = typeof parserCanonicalSlot === 'function' ? parserCanonicalSlot : LC.slots.canonicalSlot;
    const value = fn(item && item.slot); return value && (value.keys || [value.key]);
  };
  function values(profile, scenario) {
    const totals = Object.fromEntries(['HP', 'STA', 'HSTA', 'AC', 'AGI', 'HAGI'].map((name) => {
      const values = profile.items.map((item) => stat(item, name));
      return [name, values.some((n) => n === null) ? null : values.reduce((a, b) => a + b, 0)];
    }));
    const [, hpFactor, baseCap, returns] = classes[String(profile.cls).toLowerCase()];
    let hp = NaN, ac = NaN;
    if (['HP', 'STA', 'HSTA'].every((key) => totals[key] !== null)) {
      const sta = Math.min(scenario.staminaCap, scenario.baseStamina + totals.STA) + totals.HSTA;
      hp = (scenario.baseHp + hpFactor * (sta > 255 ? 255 + Math.floor((sta - 255) / 2) : sta) + totals.HP + 10 * totals.HSTA) * scenario.hpMultiplier;
    }
    let shieldAC = 0;
    if (scenario.shieldEquipped) {
      const secondary = profile.items.filter((item) => !item.isAugment && slot(item)?.includes('secondary'));
      const shield = secondary.length === 1 && slot(secondary[0]).length === 1 ? secondary[0] : null;
      const weapon = shield && Object.keys(shield.stats || {}).some((key) => /^(?:damage|dmg|delay)$/i.test(key));
      shieldAC = shield && !weapon ? stat(shield, 'AC') : null;
    }
    if (['AC', 'AGI', 'HAGI'].every((key) => totals[key] !== null) && shieldAC !== null) {
      const agi = Math.min(scenario.agilityCap, scenario.baseAgility + totals.AGI) + totals.HAGI;
      const raw = Math.floor(totals.AC * 4 / 3) + Math.floor(scenario.defenseSkill / 3) + scenario.extraArmor + (agi > 70 ? Math.floor(agi / 20) : 0);
      const cap = Math.floor(baseCap * (1 + scenario.softcapBonusPct / 100)) + shieldAC;
      ac = Math.floor(raw <= cap ? raw : cap + (raw - cap) * returns);
    }
    const roll = LC.playerDamage.expectedRoll(scenario.enemyOffense, ac);
    const hit = (scenario.enemyMinHit + (scenario.enemyMaxHit - scenario.enemyMinHit) * (roll - .1) / 1.9) * (1 - scenario.damageReduction);
    const incoming = hit * scenario.swingsPerSecond * scenario.landingChance;
    return { hp, ac, hit, incoming, survival: hp / incoming };
  }
  function project(profile, candidate, worn, saved) {
    const result = { mode: 'tank-reference', rule: { key: 'tank-physical-reference', version: 1, name: 'Level-100 physical tank estimate' }, outputs: [],
      scenarioDefault: saved == null, fields: FIELDS, partial: true,
      assumptions: ['Illustrative shared encounter; survival is HP / average incoming physical DPS without healing, not a guaranteed time to death.',
        'HP/armor use pinned emulator and client reference formulas. AA/buffs, avoidance and enemy attacks are editable assumptions.',
        'Omitted RaidLoot/legacy fields count as zero; unreadable fields, unresolved items and partial OpenDKP omissions stay unknown.',
        'Shield equipped assumes a shield in both secondary slots. Shield augments and heroic-STR shield bonuses are not included in the softcap extension.',
        'Augments remain equipped; candidate augment transfers are not simulated. Avoidance is held fixed; heroic-DEX avoidance changes are not modeled.'],
      excluded: ['Threat', 'Spell damage', 'Self-healing', 'Discs/defensive cooldowns', 'Avoidance changes', 'Damage spikes'],
      sources: [
        { label: 'Armor and damage-roll reference', url: 'https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/attack.cpp' },
        { label: 'HP pool reference', url: 'https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client_mods.cpp' },
        { label: 'HP reference factors', url: 'https://github.com/GiverofMemory/NostalgiaEQ-Client/blob/71b420046d0ceca1c11d3d40f875112673178a2a/BaseData.txt' },
      ] };
    if (!supported(profile)) { result.reason = 'Tank estimates support level-100 Warrior, Paladin and Shadowknight profiles.'; return result; }
    result.scenario = validateScenario(saved == null ? defaults(profile) : saved);
    result.scenarioRevision = result.scenario.revision;
    const index = profile.items.indexOf(worn), beforeSlot = slot(worn), afterSlot = slot(candidate);
    if (index < 0 || worn.isAugment || candidate.isAugment || !beforeSlot || beforeSlot.length !== 1 || !afterSlot?.includes(beforeSlot[0])) {
      result.reason = 'Choose one compatible equipped base item; augment replacements are not modeled.'; return result;
    }
    const after = { ...profile, items: profile.items.slice() }; after.items[index] = { ...candidate, slot: worn.slot };
    const beforeValues = values(profile, result.scenario), afterValues = values(after, result.scenario);
    result.unresolved = [...LC.referenceStats.statIssues(profile, ['HP', 'STA', 'HSta', 'AC', 'AGI', 'HAgi'], (item, name) => stat(item, name.toUpperCase())),
      ...LC.referenceStats.statIssues(after, ['HP', 'STA', 'HSta', 'AC', 'AGI', 'HAgi'], (item, name) => stat(item, name.toUpperCase()))];
    result.unresolved = [...new Map(result.unresolved.map((issue) => [JSON.stringify(issue), issue])).values()];
    result.outputs = [['HP', 'hp', false], ['Mitigation AC', 'ac', false], ['Average landed hit', 'hit', true], ['Incoming physical DPS', 'incoming', true], ['Survival seconds', 'survival', false]].map(([metric, key, lowerIsBetter]) => {
      const current = beforeValues[key], projected = afterValues[key];
      return Number.isFinite(current) && Number.isFinite(projected) && current >= 0 && projected >= 0
        ? { metric, current, candidate: projected, delta: projected - current, available: true, lowerIsBetter, partial: true }
        : { metric, available: false, reason: result.unresolved.length ? result.unresolved.map((issue) => issue.stat + ' on ' + issue.item + ' (' + issue.slot + '): ' + issue.reason).join('; ') : 'Required armor or shield inputs are unresolved or outside reference bounds; review the shield assumption and secondary item.' };
    });
    const itemScore = (item) => { const hp = stat(item, 'HP'), ac = stat(item, 'AC'); return hp === null || ac === null ? NaN : hp + 4 * ac; };
    const currentScore = itemScore(worn), candidateScore = itemScore(candidate);
    result.outputs.unshift(Number.isFinite(currentScore) && Number.isFinite(candidateScore)
      ? { metric: 'Tank item score', current: currentScore, candidate: candidateScore, delta: candidateScore - currentScore, available: true, lowerIsBetter: false }
      : { metric: 'Tank item score', available: false, reason: 'HP or AC is unreadable on the compared items.' });
    result.outputs.push({ metric: 'Threat', available: false, reason: 'Threat is not modeled; survivability is not an aggro estimate.' });
    return result;
  }
  LC.tank = { project, validateScenario, defaults, supported };
})();
