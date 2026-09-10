// Reference estimates, not live-game simulation. Numeric facts and model choices are documented
// in docs/research/character-projection/reference-model.md. No emulator implementation is copied.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const REVISION = '7ab909ee47e8639b2137a6818bfdff99845c9d39';
  const MODEL = Object.freeze({ key: 'bst100-reference', version: 2, name: 'Level-100 Beastlord reference estimate',
    source: 'https://github.com/EQEmu/EQEmu/blob/' + REVISION + '/zone/client_mods.cpp',
    sources: [
      { label: 'Pool/cap reference', url: 'https://github.com/EQEmu/EQEmu/blob/' + REVISION + '/zone/client_mods.cpp' },
      { label: 'Heroic reference', url: 'https://github.com/EQEmu/EQEmu/blob/' + REVISION + '/zone/bonuses.cpp' },
      { label: 'AC reference (before soft caps)', url: 'https://github.com/EQEmu/EQEmu/blob/' + REVISION + '/zone/attack.cpp' },
      { label: 'Displayed ATK reference', url: 'https://github.com/EQEmu/EQEmu/blob/' + REVISION + '/zone/client.cpp' },
      { label: 'AA rank definitions', url: 'https://www.raidloot.com/aa?class=Beastlord&exp=' },
      { label: 'Reference factors', url: 'https://github.com/GiverofMemory/NostalgiaEQ-Client/blob/71b420046d0ceca1c11d3d40f875112673178a2a/BaseData.txt' },
    ] });
  const DURABILITY = [0, 2, 5, 10, 12, 13, 14, 15, 16, 17, 18];
  const ALIASES = { ENDURANCE: 'END', ATTACK: 'ATK', STRENGTH: 'STR', STAMINA: 'STA', AGILITY: 'AGI',
    DEXTERITY: 'DEX', INTELLIGENCE: 'INT', WISDOM: 'WIS', CHARISMA: 'CHA' };
  const value = (input) => {
    const num = input && typeof input === 'object' ? input.num : input;
    if (typeof num === 'number') return Number.isFinite(num) ? num : null;
    return typeof num === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(num.trim()) && Number.isFinite(Number(num)) ? Number(num) : null;
  };
  const key = (name) => { const nameKey = String(name).toUpperCase().replace(/[\s_]/g, ''); return ALIASES[nameKey] || nameKey; };
  function stat(item, name) {
    const found = Object.entries(item && item.stats || {}).find(([nameKey]) => key(nameKey) === name);
    // Omission is an explicit estimate assumption, never a change to the exact delta engine.
    if (found) return value(found[1]);
    const sources = Object.values(item && item.stats || {}).map((entry) => entry && typeof entry === 'object' ? entry.source : 'legacy');
    // A partial OpenDKP response is not evidence that an omitted field is zero.
    if (sources.includes('opendkp') && !sources.includes('raidloot')) return null;
    return 0;
  }
  const knownItem = (item) => Object.values(item && item.stats || {}).some((entry) => value(entry) !== null);
  function sum(profile, name) {
    let total = 0;
    for (const item of profile.items || []) { const n = stat(item, name); if (n === null) return null; total += n; }
    return Number.isFinite(total) ? total : null;
  }
  function difference(candidate, worn, name) {
    const a = stat(candidate, name), b = stat(worn, name);
    return a === null || b === null || !Number.isFinite(a - b) ? null : a - b;
  }
  function aa(profile, name, fallback, max, effect, notes) {
    const records = profile.characterData?.version === 1 ? profile.characterData.aaRanks || [] : [];
    const record = records.find((entry) => String(entry.name || '').trim().toLowerCase() === name.toLowerCase());
    const savedRank = record ? value(record.rank) : null;
    const rank = savedRank === null ? fallback : savedRank;
    if (!Number.isInteger(rank) || rank < 0 || rank > max) { notes.push(name + ': rank outside reference coverage.'); return null; }
    const assumed = savedRank === null || record.assumed === true;
    notes.push(name + ' rank ' + rank + (assumed ? ' assumed' : ' from saved ranks') + '.');
    return effect(rank);
  }
  async function usableSnapshot(profile, notes) {
    const data = profile.characterData, snapshot = data && data.version === 1 && data.snapshot;
    if (!snapshot) { notes.push('No current snapshot: base attributes are assumed capped.'); return null; }
    if (snapshot.invalidatedAt || !snapshot.unbuffed || !snapshot.gearConfirmed || String(snapshot.profileId) !== String(profile.id) ||
        snapshot.binding !== await LC.characterData.fingerprint(profile) ||
        LC.characterData.serialize(snapshot.aaRanks || []) !== LC.characterData.serialize(data.aaRanks || [])) {
      notes.push('Stale/unconfirmed snapshot ignored; using capped reference baselines.'); return null;
    }
    if (snapshot.includesHeroics === 'unknown') notes.push('Sheet attribute values/caps assumed to include heroics.');
    return snapshot;
  }
  function attribute(profile, candidate, worn, snapshot, name, planar, notes) {
    const ordinaryDelta = difference(candidate, worn, name), heroicDelta = difference(candidate, worn, 'H' + name);
    const recordedHeroic = value(snapshot?.readings?.['H' + name]);
    const heroicBefore = recordedHeroic === null ? sum(profile, 'H' + name) : recordedHeroic;
    if ([ordinaryDelta, heroicDelta, heroicBefore].some((n) => n === null)) return null;
    const heroicAfter = heroicBefore + heroicDelta;
    if (heroicBefore < 0 || heroicAfter < 0) return null;
    let before = value(snapshot?.readings?.[name]), cap = value(snapshot?.readings?.[name + 'Cap']);
    if (before !== null && cap !== null && snapshot.includesHeroics === 'no') { before += heroicBefore; cap += heroicBefore; }
    if (before === null || cap === null || before > cap || before < 1 || cap < 1) {
      if (planar === null) return null;
      before = cap = 455 + planar + heroicBefore;
      notes.push(name + ': using capped reference baseline.');
    }
    const nextCap = cap + heroicDelta;
    if (nextCap < 1) return null;
    const lower = Math.max(1, Math.min(nextCap, before + ordinaryDelta + heroicDelta));
    const upper = before < cap ? lower : nextCap;
    return { before, after: [lower, upper], heroicBefore, heroicAfter, heroicDelta };
  }
  // Piecewise transformations from the chosen SoD-style reference branch. Output is a change,
  // so constant class/race and flat AA terms cancel. Engine rounding is not claimed exact.
  const stamina = (n) => 8.5 * (n <= 255 ? n : 255 + Math.floor((n - 255) / 2));
  const wisdom = (n) => {
    const effective = n > 200 ? n - Math.floor((n - 200) / 2) : n;
    return 9.09 * (n > 100 ? effective + Math.floor((3 * effective - 300) / 2) : effective);
  };
  const endurance = (n) => 9.09 * Math.floor(n > 201 ? 352.5 + 1.25 * (n - 201) : n > 100 ? 100 + 2.5 * (n - 100) : n);
  const contribution = (attribute, formula) => attribute && attribute.after.map((n) => formula(n) - formula(attribute.before));
  const rounded = (n, precision) => { const result = Math.round(n * 10 ** precision) / 10 ** precision; return Object.is(result, -0) ? 0 : result; };
  function output(metric, interval, snapshot, components, precision = 0) {
    if (!interval || interval.some((n) => !Number.isFinite(n))) return { metric, available: false, reason: 'Required item/stat or AA input is unreadable or outside reference coverage.' };
    const scale = 10 ** precision;
    const low = interval[0] === interval[1] ? rounded(interval[0], precision) : Math.floor(interval[0] * scale) / scale;
    const high = interval[0] === interval[1] ? low : Math.ceil(interval[1] * scale) / scale;
    const current = value(snapshot?.readings?.[metric]);
    if (![low, high].every(Number.isFinite) || current !== null && current + low < 0) return { metric, available: false, reason: 'Reference result is outside numeric bounds or conflicts with the snapshot total.' };
    return { metric, available: true, confidence: 'Reference estimate', deltaLow: low, deltaHigh: high,
      delta: low === high ? low : null, current, projectedLow: current === null ? null : rounded(current + low, precision),
      projectedHigh: current === null ? null : rounded(current + high, precision),
      trend: low > 0 ? 'increase' : high < 0 ? 'decrease' : low === 0 && high === 0 ? 'unchanged' : 'cap-dependent', components };
  }
  async function project(profile, candidate, worn) {
    const result = { mode: 'reference', rule: MODEL, needsConfirmation: false, outputs: [], assumptions: [
      'Same augments, effects, buffs, weapon skills and power-source conditions are assumed; transfers/stacking are not simulated.',
      'Omitted RaidLoot/legacy item fields count as zero in this estimate; unreadable values and partial OpenDKP omissions stay unavailable.',
      'Ranges describe unknown over-cap headroom, not statistical confidence. Reference rules may differ from the game.',
    ] };
    if (!['beastlord', 'bst'].includes(String(profile.cls || '').toLowerCase()) || Number(profile.level) !== 100) {
      result.reason = 'This reference model currently supports level-100 Beastlords.'; return result;
    }
    if (!worn || !knownItem(worn) || !knownItem(candidate)) { result.reason = 'Resolve both equipped and candidate item stats before estimating.'; return result; }
    const notes = result.assumptions;
    const planar = aa(profile, 'Planar Power', 55, 60, (rank) => rank * 5, notes);
    const hpPercent = aa(profile, 'Natural Durability', 10, 10, (rank) => DURABILITY[rank], notes);
    const attackCapBonus = aa(profile, 'Enhanced Aggression', 36, 40, (rank) => rank * 10, notes);
    const snapshot = await usableSnapshot(profile, notes);
    result.snapshotId = snapshot && snapshot.id || null;
    notes.push('Unset AA ranks use the level-100 Rain of Fear reference maxima; other percentage bonuses/cap grants are not modeled. Recorded sheet caps override derived caps.');
    const attributes = Object.fromEntries(['STA', 'WIS', 'STR', 'DEX', 'AGI'].map((name) => [name, attribute(profile, candidate, worn, snapshot, name, planar, notes)]));
    const itemAC = sum(profile, 'AC'), acDelta = difference(candidate, worn, 'AC');
    const agilityAC = contribution(attributes.AGI, (n) => n > 70 ? Math.floor(n / 20) : 0);
    // ponytail: pre-softcap AC only; add mitigation returns/shield handling when modeling effective AC.
    // Level-100 Beastlord class AC is already capped at 16 for every valid AGI, so cancels.
    const scaledAC = itemAC !== null && acDelta !== null && itemAC >= 0 && itemAC + acDelta >= 0 ?
      Math.floor((itemAC + acDelta) * 4 / 3) - Math.floor(itemAC * 4 / 3) : null;
    const ac = scaledAC !== null && agilityAC ? agilityAC.map((change) => scaledAC + change) : null;
    result.outputs.push(output('AC', ac, null, { item: acDelta, attribute: agilityAC, scaledItem: scaledAC }));
    notes.push('AC is a before-softcap reference: item AC ×4/3 plus AGI/HAGI contribution. Mitigation returns, shield bonuses and avoidance are not modeled; AC is change-only, not a sheet total.');
    const hpDelta = difference(candidate, worn, 'HP'), sta = contribution(attributes.STA, stamina);
    const hpMultiplier = hpPercent === null ? null : 1 + hpPercent / 100;
    const hp = hpDelta !== null && sta && hpMultiplier !== null ? sta.map((change) => (hpDelta + change + 10 * attributes.STA.heroicDelta) * hpMultiplier) : null;
    result.outputs.push(output('HP', hp, snapshot, { item: hpDelta, attribute: sta, heroic: attributes.STA && 10 * attributes.STA.heroicDelta, multiplier: hpMultiplier }));
    const manaDelta = difference(candidate, worn, 'MANA'), wis = contribution(attributes.WIS, wisdom);
    const mana = manaDelta !== null && wis ? wis.map((change) => manaDelta + change + 10 * attributes.WIS.heroicDelta) : null;
    result.outputs.push(output('MANA', mana, snapshot, { item: manaDelta, attribute: wis, heroic: attributes.WIS && 10 * attributes.WIS.heroicDelta }));
    const itemAtk = sum(profile, 'ATK'), atkDelta = difference(candidate, worn, 'ATK');
    const cappedAtk = itemAtk !== null && atkDelta !== null && attackCapBonus !== null ?
      Math.min(250 + attackCapBonus, Math.max(0, itemAtk + atkDelta)) - Math.min(250 + attackCapBonus, Math.max(0, itemAtk)) : null;
    const strength = contribution(attributes.STR, (n) => n * 0.9);
    const attack = cappedAtk !== null && strength ? strength.map((change) => 1.342 * cappedAtk + change) : null;

    const physical = ['STR', 'STA', 'DEX', 'AGI'].map((name) => attributes[name]);
    const endDelta = difference(candidate, worn, 'END');
    let end = null, endStat = null, endHeroic = null;
    if (endDelta !== null && physical.every(Boolean)) {
      const before = physical.reduce((sum, stat) => sum + stat.before, 0) / 4;
      endStat = [0, 1].map((i) => endurance(physical.reduce((sum, stat) => sum + stat.after[i], 0) / 4) - endurance(before));
      endHeroic = physical.reduce((sum, stat) => sum + stat.heroicDelta, 0) * 2.5;
      end = endStat.map((change) => endDelta + change + endHeroic);
    }
    result.outputs.push(output('END', end, snapshot, { item: endDelta, attribute: endStat, heroic: endHeroic }));
    result.outputs.push(output('ATK', attack, snapshot, { item: atkDelta, cappedItem: cappedAtk, attribute: strength, itemCap: attackCapBonus === null ? null : 250 + attackCapBonus }, 1));
    notes.push('HP uses the Natural Durability percentage on item + stat/heroic changes. Flat unchanged AA bonuses cancel; other percentage HP modifiers are omitted.');
    notes.push('Mana uses WIS/HWIS for Beastlord, not INT/HINT. ATK is a displayed-rating estimate, not DPS; no extra HSTR-to-ATK bonus is invented.');
    result.assumptions = [...new Set(notes)];
    return result;
  }
  LC.referenceStats = { MODEL, project, stamina, wisdom, endurance };
})();
