// Exact, source-backed damage effects used by the DPS model.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};

  const SOURCES = Object.freeze([
    { label: 'RaidLoot Ferocity spell records', url: 'https://www.raidloot.com/spells?name=Ferocity' },
    { label: 'RaidLoot Cleave spell records', url: 'https://www.raidloot.com/spells?name=Cleave' },
    { label: 'RaidLoot Force of Corruption VI', url: 'https://www.raidloot.com/spells?name=23815' },
    { label: 'RaidLoot Strike of Flames VI', url: 'https://www.raidloot.com/spells?name=23735' },
    { label: 'RaidLoot Rain of Fear Tier 4 item record', url: 'https://www.raidloot.com/raid/rof4' },
    { label: 'RaidLoot Plane of War item record', url: 'https://www.raidloot.com/raid/powar' },
    { label: 'RaidLoot Strike of Venom V', url: 'https://www.raidloot.com/spells?name=23774' },
    { label: 'RaidLoot Rain of Fear Tier 3 item record', url: 'https://www.raidloot.com/raid/rof3' },
    { label: 'RaidLoot Beastlord spell list', url: 'https://www.raidloot.com/spells/beastlord' },
  ]);

  const source = (index) => SOURCES[index];
  const spellSource = (label, spellId) => ({ label, url: 'https://www.raidloot.com/spells?name=' + spellId });
  const CLEAVE_IX_IDS = Object.freeze({ 5: 21460, 10: 21461, 15: 21462, 20: 21463, 22: 23386, 25: 23387, 27: 30589,
    30: 30590, 32: 33183, 35: 38643, 37: 38913, 40: 38914, 42: 39804, 45: 39805,
    47: 41951, 49: 41952, 51: 41953 });
  const wornRecords = [
    ...['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map((rank, index) => ({
      family: 'ferocity', name: 'Ferocity ' + rank, spellId: [3886, 3887, 3888, 6323, 6324, 7835, 9615, 15841][index],
      bonusPct: [3, 6, 9, 12, 15, 18, 18, 18][index], flatDamage: 0, source: source(0),
    })),
    ...['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map((rank, index) => ({
      family: 'cleave', name: 'Cleave ' + rank, spellId: [3883, 3884, 3885, 6321, 6322, 7834, 9614, 15840][index],
      bonusPct: 40 * (index + 1), flatDamage: 0, source: source(1),
    })),
    // Cleave IX is accepted only because this exact spell record is sourced.
    { family: 'cleave', name: 'Cleave IX', spellId: 20516, bonusPct: 360, flatDamage: 0,
      source: spellSource('RaidLoot Cleave IX', 20516) },
    ...[5, 10, 15, 20, 22, 25, 27, 30, 32, 35, 37, 40, 42, 45, 47, 49, 51].map((flatDamage) => ({
      family: 'cleave', name: 'Cleave IX - ' + String(flatDamage).padStart(2, '0'),
      spellId: CLEAVE_IX_IDS[flatDamage],
      bonusPct: 360, flatDamage, source: spellSource('RaidLoot Cleave IX - ' + String(flatDamage).padStart(2, '0'), CLEAVE_IX_IDS[flatDamage]),
    })),
  ];
  const procRecords = [
    { name: 'Force of Corruption VI', spellId: 23815, baseDamage: 460, resist: 'Corruption -25', rateMultiplier: 1, source: source(2) },
    { name: 'Strike of Flames VI', spellId: 23735, baseDamage: 510, resist: 'Fire -190', rateMultiplier: 1, source: source(3) },
    { name: 'Strike of Venom V', spellId: 23774, baseDamage: 420, resist: 'Poison -180', rateMultiplier: 1, source: source(6) },
    { name: 'Strike of Venom VIII', spellId: 23777, baseDamage: 750, resist: 'Poison -200', rateMultiplier: 1, source: spellSource('RaidLoot Strike of Venom VIII', 23777) },
  ];
  const SPELL_SOURCE = source(8);
  const focusRecords = [
    { spellId: 36812, name: 'Type3 FC Kromrif Lance', flatDamage: 532, spellGroup: 2512, eligibleSpellIds: [36401, 36402, 36403], critScaled: true, source: spellSource('RaidLoot Type3 FC Kromrif Lance', 36812) },
    { spellId: 36809, name: "Type3 FC Poantaar's Bite", flatDamage: 661, spellGroup: 2517, eligibleSpellIds: [36379, 36380, 36381], critScaled: true, source: spellSource("RaidLoot Type3 FC Poantaar's Bite", 36809) },
    { spellId: 33139, name: 'Cold Damage 35-70 L100', minPct: 8, maxPct: 15, maxLevel: 100, decayPctPerLevel: 5, resist: 'Cold', ddComponent: true, critScaled: true, source: spellSource('RaidLoot Cold Damage 35-70 L100', 33139) },
    { spellId: 33140, name: 'Cold Damage 40-70 L100', minPct: 9, maxPct: 15, maxLevel: 100, decayPctPerLevel: 5, resist: 'Cold', ddComponent: true, critScaled: true, source: spellSource('RaidLoot Cold Damage 40-70 L100', 33140) },
    { spellId: 33141, name: 'Cold Damage 35-100 L100', minPct: 8, maxPct: 22, maxLevel: 100, decayPctPerLevel: 5, resist: 'Cold', ddComponent: true, critScaled: true, source: spellSource('RaidLoot Cold Damage 35-100 L100', 33141) },
    { spellId: 33142, name: 'Cold Damage 40-100 L100', minPct: 9, maxPct: 22, maxLevel: 100, decayPctPerLevel: 5, resist: 'Cold', ddComponent: true, critScaled: true, source: spellSource('RaidLoot Cold Damage 40-100 L100', 33142) },
    { spellId: 37939, name: 'Cold Damage 45-70 L100', minPct: 10, maxPct: 15, maxLevel: 100, decayPctPerLevel: 5, resist: 'Cold', ddComponent: true, critScaled: true, source: spellSource('RaidLoot Cold Damage 45-70 L100', 37939) },
    { spellId: 37940, name: 'Cold Damage 45-100 L100', minPct: 10, maxPct: 22, maxLevel: 100, decayPctPerLevel: 5, resist: 'Cold', ddComponent: true, critScaled: true, source: spellSource('RaidLoot Cold Damage 45-100 L100', 37940) },
    { spellId: 33145, name: 'Poison Damage 35-100 L100', minPct: 35, maxPct: 100, maxLevel: 100, decayPctPerLevel: 5, resist: 'Poison', ddComponent: false, critScaled: false, targetLimits: ['exclude caster ae', 'exclude caster pb', 'exclude target ae', 'exclude old giants', 'exclude old dragons'], source: spellSource('RaidLoot Poison Damage 35-100 L100', 33145) },
    { spellId: 33143, name: 'Poison Damage 35-70 L100', minPct: 35, maxPct: 70, maxLevel: 100, decayPctPerLevel: 5, resist: 'Poison', ddComponent: false, critScaled: false, targetLimits: ['exclude caster ae', 'exclude caster pb', 'exclude target ae', 'exclude old giants', 'exclude old dragons'], source: spellSource('RaidLoot Poison Damage 35-70 L100', 33143) },
    { spellId: 33146, name: 'Poison Damage 40-100 L100', minPct: 40, maxPct: 100, maxLevel: 100, decayPctPerLevel: 5, resist: 'Poison', ddComponent: false, critScaled: false, targetLimits: ['exclude caster ae', 'exclude caster pb', 'exclude target ae', 'exclude old giants', 'exclude old dragons'], source: spellSource('RaidLoot Poison Damage 40-100 L100', 33146) },
    { spellId: 33144, name: 'Poison Damage 40-70 L100', minPct: 40, maxPct: 70, maxLevel: 100, decayPctPerLevel: 5, resist: 'Poison', ddComponent: false, critScaled: false, targetLimits: ['exclude caster ae', 'exclude caster pb', 'exclude target ae', 'exclude old giants', 'exclude old dragons'], source: spellSource('RaidLoot Poison Damage 40-70 L100', 33144) },
    { spellId: 37942, name: 'Poison Damage 45-100 L100', minPct: 45, maxPct: 100, maxLevel: 100, decayPctPerLevel: 5, resist: 'Poison', ddComponent: false, critScaled: false, targetLimits: ['exclude caster ae', 'exclude caster pb', 'exclude target ae', 'exclude old giants', 'exclude old dragons'], source: spellSource('RaidLoot Poison Damage 45-100 L100', 37942) },
    { spellId: 37941, name: 'Poison Damage 45-70 L100', minPct: 45, maxPct: 70, maxLevel: 100, decayPctPerLevel: 5, resist: 'Poison', ddComponent: false, critScaled: false, targetLimits: ['exclude caster ae', 'exclude caster pb', 'exclude target ae', 'exclude old giants', 'exclude old dragons'], source: spellSource('RaidLoot Poison Damage 45-70 L100', 37941) },
  ];
  const rotationRecords = Object.freeze([
    [
      { spellId: 36379, name: "Poantaar's Bite", level: 98, baseDamage: 8391, castSeconds: .5, recastSeconds: 30, mana: 1648, resist: 'Poison', source: SPELL_SOURCE },
      { spellId: 36401, name: 'Kromrif Lance', level: 99, baseDamage: 6757, castSeconds: .5, recastSeconds: 30, mana: 1164, resist: 'Cold', source: SPELL_SOURCE },
    ],
    [
      { spellId: 36380, name: "Poantaar's Bite Rk. II", level: 98, baseDamage: 8811, castSeconds: .5, recastSeconds: 30, mana: 1714, resist: 'Poison', source: SPELL_SOURCE },
      { spellId: 36402, name: 'Kromrif Lance Rk. II', level: 99, baseDamage: 7095, castSeconds: .5, recastSeconds: 30, mana: 1211, resist: 'Cold', source: SPELL_SOURCE },
    ],
    [
      { spellId: 36381, name: "Poantaar's Bite Rk. III", level: 98, baseDamage: 9252, castSeconds: .5, recastSeconds: 30, mana: 1783, resist: 'Poison', source: SPELL_SOURCE },
      { spellId: 36403, name: 'Kromrif Lance Rk. III', level: 99, baseDamage: 7450, castSeconds: .5, recastSeconds: 30, mana: 1260, resist: 'Cold', source: SPELL_SOURCE },
    ],
  ]);
  const LEGACY_PROC_KEYS = Object.freeze({ 23815: 'proc:corruption force', 23735: 'proc:flames strike', 23774: 'proc:strike v venom', 23777: 'proc:strike venom' });
  const byName = (records) => new Map(records.map((record) => [normalizeName(record.name), record]));
  const byId = (records) => new Map(records.map((record) => [String(record.spellId), record]));
  const wornByName = byName(wornRecords), wornById = byId(wornRecords);
  const procByName = byName(procRecords), procById = byId(procRecords);
  const focusByName = byName(focusRecords), focusById = byId(focusRecords);

  function normalizeName(value) {
    return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function exactName(value, records) {
    const name = normalizeName(value);
    if (!name) return null;
    return records.get(name) || null;
  }

  function ids(effect, type) {
    const values = [];
    for (const key of ['spellId', 'effectId', 'id']) {
      if (effect && effect[key] != null && /^\d+$/.test(String(effect[key]).trim())) values.push(String(effect[key]).trim());
    }
    const key = String(effect && effect.key || '').trim();
    const keyMatch = key.match(new RegExp('^(?:' + type + '|spell)(?::id)?:(\\d+)$', 'i'));
    if (keyMatch) values.push(keyMatch[1]);
    return [...new Set(values)];
  }

  function rawText(effect) {
    return [effect && effect.raw, effect && effect.description, effect && effect.text]
      .filter((value) => value != null && String(value).trim()).map(String).join('\n');
  }

  function rawName(raw) {
    const line = String(raw || '').split(/\r?\n/).map((value) => value.trim()).find(Boolean) || '';
    return line.replace(/^\s*(?:worn|proc|weapon\s+proc)\s*(?:effect)?\s*:\s*/i, '').trim();
  }

  function nameCandidates(effect) {
    const values = [];
    if (effect && effect.name != null) values.push(String(effect.name));
    const raw = rawText(effect);
    if (raw) values.push(rawName(raw));
    const key = String(effect && effect.key || '').trim().replace(/^(?:worn|proc):/i, '');
    if (key && !/^id:\d+$/i.test(key)) values.push(key);
    return [...new Set(values.map(normalizeName).filter(Boolean))];
  }

  function rawConflicts(effect, record) {
    const raw = rawText(effect);
    if (!raw) return false;
    const damageValues = [...raw.matchAll(/decrease\s+current\s+hp\s+by\s+(\d+)/ig)].map((match) => Number(match[1]));
    if (damageValues.length > 1 || damageValues.some((value) => value !== record.baseDamage)) return true;
    if (/\b(?:if\b|based\s+on\b|per\s+tick\b|(?:damage|decrease current hp)\s+over\s+time\b|duration\s*:|recourse\s*:|cast\s*:)/i.test(raw)) return true;
    if (/\b(?:increase\s+|decrease\s+(?!current\s+hp))/i.test(raw) && damageValues.length === 0) return true;
    if (damageValues.length === 0 && (raw.split(/\r?\n/).length > 1 || /\d+\s*:\s*|resist\s*:|proc\s+rate/i.test(raw))) return true;
    return false;
  }

  function resolveProc(effect) {
    if (!effect || effect.type !== 'proc') return null;
    // Known identities retain their conflict checks; descriptions cover new ranks.
    if (ids(effect, 'proc').some((id) => procById.has(id)) ||
        nameCandidates(effect).some((name) => procByName.has(name))) return resolve(effect, 'proc');
    const spellIds = ids(effect, 'proc');
    if (spellIds.length > 1) return null;
    const lines = rawText(effect).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const cleanName = (value) => rawName(value).replace(/\s+Proc Rate\s*:\s*[+-]?\d+\s*$/i, '').trim();
    const explicitName = cleanName(effect.name);
    const header = lines.length && !/^(?:\d+\s*:|Decrease\s+Current\s+HP|Resist\s*:)/i.test(lines[0]) ? cleanName(lines.shift()) : '';
    if (explicitName && header && normalizeName(explicitName) !== normalizeName(header)) return null;
    const name = explicitName || header;
    if (!name) return null;
    let baseDamage = null;
    // ponytail: one unconditional HP-damage line; richer proc effects need their own model.
    for (const line of lines) {
      const damage = line.match(/^(?:\d+\s*:\s*)?Decrease\s+Current\s+HP\s+by\s+(\d{1,3}(?:,\d{3})+|\d+)\s*$/i);
      if (damage) {
        if (baseDamage !== null) return null;
        baseDamage = Number(damage[1].replace(/,/g, ''));
      } else if (!/^(?:Resist\s*:\s*[A-Za-z]+(?:\s+[+-]?\d+)?|Proc Rate\s*:\s*[+-]?\d+|Target\s*:\s*Single|Range\s*:\s*\d+'?|Casting\s*:\s*0s|Can Reflect\s*:\s*(?:Yes|No)|Focusable\s*:\s*(?:Yes|No))$/i.test(line)) return null;
    }
    if (baseDamage === null || !Number.isSafeInteger(baseDamage)) return null;
    return { name, spellId: spellIds[0] || null, baseDamage, rateMultiplier: 1, descriptionBased: true };
  }

  function wornRawConflicts(effect, record) {
    const raw = rawText(effect);
    if (!raw) return false;
    if (record.family === 'ferocity') {
      const values = [...raw.matchAll(/increase\s+chance\s+to\s+double\s+attack\s+by\s+([+-]?\d+(?:\.\d+)?)\s*%/ig)].map((match) => Number(match[1]));
      return values.some((value) => value !== record.bonusPct);
    }
    const critValues = [...raw.matchAll(/increase\s+chance\s+to\s+critical\s+hit\s+with\s+[^\n]+?\s+by\s+([+-]?\d+(?:\.\d+)?)\s*%/ig)].map((match) => Number(match[1]));
    if (critValues.some((value) => value !== record.bonusPct)) return true;
    const flatValues = [...raw.matchAll(/increase\s+hit\s+damage\s+bonus\s+by\s+([+-]?\d+(?:\.\d+)?)/ig)].map((match) => Number(match[1]));
    return flatValues.some((value) => value !== record.flatDamage);
  }

  function romanRank(value) {
    const match = String(value == null ? '' : value).trim().toUpperCase().match(/^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/);
    return match ? match[1] : null;
  }

  function nameRank(name) {
    const match = String(name || '').match(/\b(I{1,3}|IV|V|VI{0,3}|IX|X)(?:\s*-|\s*$)/i);
    return match ? match[1].toUpperCase() : null;
  }

  function keyNameConflicts(effect, records) {
    const key = String(effect && effect.key || '').trim();
    if (!key || /^(?:worn|proc|spell):(?:id:)?\d+$/i.test(key)) return false;
    const stripped = key.replace(/^(?:worn|proc):/i, '');
    const keyRecord = exactName(stripped, records);
    if (!keyRecord) return false;
    return nameCandidates({ ...effect, key: '' }).some((name) => name !== normalizeName(keyRecord.name) && !!exactName(name, records));
  }

  function legacySingleLineArtifact(effect, record, explicitRank, parsedRawName, rawLines, rawHasExplicitRank) {
    // Some saved page effects omit provenance; exact raw/name/rank/key checks
    // keep this repair narrower than trusting an arbitrary rank field.
    const recordRank = nameRank(record.name);
    if (!explicitRank || rawLines.length !== 1 || rawHasExplicitRank || !recordRank || !recordRank.startsWith('V') ||
        explicitRank !== recordRank.slice(1) || normalizeName(parsedRawName) !== normalizeName(record.name)) return false;
    const key = String(effect && effect.key || '').trim();
    const canonicalKey = LEGACY_PROC_KEYS[record.spellId];
    if (key && key !== canonicalKey) return false;
    return true;
  }

  function resolve(effect, type) {
    if (!effect || typeof effect !== 'object' || effect.type !== type) return null;
    const records = type === 'worn' ? { byName: wornByName, byId: wornById } : { byName: procByName, byId: procById };
    if (keyNameConflicts(effect, records.byName)) return null;
    const names = nameCandidates(effect);
    const nameRecords = names.map((name) => exactName(name, records.byName)).filter(Boolean);
    const uniqueNames = [...new Set(nameRecords)];
    if (uniqueNames.length > 1) return null;
    const spellIds = ids(effect, type);
    if (spellIds.length > 1) return null;
    const idRecord = spellIds.length ? records.byId.get(spellIds[0]) || null : null;
    if (spellIds.length && !idRecord) return null;
    if (idRecord && uniqueNames.length && idRecord !== uniqueNames[0]) return null;
    const explicitName = effect.name == null ? '' : String(effect.name).trim();
    const parsedRawName = rawName(rawText(effect));
    if (explicitName && parsedRawName && normalizeName(explicitName) !== normalizeName(parsedRawName)) return null;
    if (explicitName && !exactName(explicitName, records.byName)) return null;
    const record = idRecord || uniqueNames[0] || null;
    if (!record) return null;
    if (parsedRawName && !/^\d+\s*:/.test(parsedRawName) && normalizeName(parsedRawName) !== normalizeName(record.name)) return null;
    const explicitRank = romanRank(effect.rank);
    const rawLines = rawText(effect).split(/\r?\n/).filter((line) => line.trim());
    const rawHasExplicitRank = /\b(?:rank|level|tier|version)\s*(?:I{1,3}|IV|V|VI{0,3}|IX|X|\d+)\b/i.test(rawText(effect));
    // Backcompat for already-saved effects from the old parser: it mistook
    // the V in a bare Roman suffix (VI -> I, VIII -> III) for "version".
    // New parser output no longer needs this path. A full multi-line packet
    // whose first line exactly names this record is authoritative; explicit
    // rank fields without that packet still reject mismatches.
    const recordRank = nameRank(record.name);
    const parserRankArtifact = explicitRank && rawLines.length > 1 && !rawHasExplicitRank &&
      parsedRawName && normalizeName(parsedRawName) === normalizeName(record.name) && recordRank &&
      recordRank.startsWith('V') && explicitRank === recordRank.slice(1);
    const singleLineLegacyArtifact = type === 'proc' && legacySingleLineArtifact(effect, record, explicitRank,
      parsedRawName, rawLines, rawHasExplicitRank);
    if (explicitRank && !parserRankArtifact && !singleLineLegacyArtifact && explicitRank !== recordRank) return null;
    if (type === 'proc' && rawConflicts(effect, record)) return null;
    if (type === 'worn' && wornRawConflicts(effect, record)) return null;
    return { ...record };
  }

  function focusRawConflicts(effect, record) {
    const raw = rawText(effect);
    if (!raw || raw.split(/\r?\n/).filter((line) => line.trim()).length === 1) return false;
    const packet = raw.match(new RegExp('(?:SPA\\s*' + (record.ddComponent ? '302' : '124') + '[^\\n]*Base1\\s*=\\s*|v' + (record.ddComponent ? '302' : '124') + '[^\\n]*?)(\\d+)\\s*(?:Base2\\s*=\\s*|%\\s*to\\s*)(\\d+)', 'i'));
    const textPacket = raw.match(new RegExp('Increase\\s+Spell\\s+Damage\\s+by\\s+(\\d+(?:\\.\\d+)?)%\\s+to\\s+(\\d+(?:\\.\\d+)?)%[^\\n]*' + (record.ddComponent ? 'Before\\s+Crit' : 'Before\\s+DoT\\s+Crit'), 'i'));
    const min = packet ? Number(packet[1]) : textPacket ? Number(textPacket[1]) : null;
    const max = packet ? Number(packet[2]) : textPacket ? Number(textPacket[2]) : null;
    if (min == null || max == null || min !== record.minPct || max !== record.maxPct) return true;
    const levels = [...raw.matchAll(/Limit\s+Max\s+Level\s*:\s*(\d+)/ig)].map((match) => Number(match[1]));
    const decays = [...raw.matchAll(/lose\s+(\d+(?:\.\d+)?)%\s+per\s+level/ig)].map((match) => Number(match[1]));
    const resists = [...raw.matchAll(/Limit\s+Resist\s*:\s*([A-Za-z]+)/ig)].map((match) => match[1].toLowerCase());
    if (levels.some((level) => level !== record.maxLevel)) return true;
    if (decays.some((decay) => decay !== record.decayPctPerLevel)) return true;
    if (resists.some((resist) => resist !== record.resist.toLowerCase())) return true;
    const maxDurations = [...raw.matchAll(/Limit\s+Max\s+Duration\s*:\s*([^\s]+)/ig)].map((match) => match[1].toLowerCase());
    const minDurations = [...raw.matchAll(/Limit\s+Min\s+Duration\s*:\s*([^\s]+)/ig)].map((match) => match[1].toLowerCase());
    const minManas = [...raw.matchAll(/Limit\s+Min\s+Mana\s+Cost\s*:\s*(\d+)/ig)].map((match) => Number(match[1]));
    if (record.ddComponent && maxDurations.some((duration) => duration !== '0s')) return true;
    if (!record.ddComponent && maxDurations.length) return true;
    if (record.ddComponent && (minDurations.length !== 1 || minDurations.some((duration) => duration !== '12s'))) return true;
    if (!record.ddComponent && minDurations.length) return true;
    if (record.ddComponent && (minManas.length !== 2 || minManas.some((mana) => mana !== 10))) return true;
    if (!record.ddComponent && minManas.length) return true;
    const effects = [...raw.matchAll(/Limit\s+Effect\s*:\s*([^\n]+)/ig)].map((match) => match[1].trim().toLowerCase());
    if (effects.some((effect) => effect !== 'current hp')) return true;
    const types = [...raw.matchAll(/Limit\s+Type\s*:\s*([^\n]+)/ig)].map((match) => match[1].trim().toLowerCase());
    if (types.some((type) => !['detrimental', 'exclude combat skills'].includes(type))) return true;
    const targets = [...raw.matchAll(/Limit\s+Target\s*:\s*([^\n]+)/ig)].map((match) => match[1].trim().toLowerCase());
    const allowedTargets = record.targetLimits || ['exclude caster ae', 'exclude caster pb', 'exclude target ae'];
    if (targets.some((target) => !allowedTargets.includes(target))) return true;
    const unknownLimits = [...raw.matchAll(/^\s*(?:\d+\s*:\s*)?Limit\s+([^:]+):/gim)].map((match) => match[1].trim().toLowerCase());
    if (unknownLimits.some((limit) => !['max level', 'effect', 'type', 'target', 'min duration', 'min mana cost', 'resist', 'max duration'].includes(limit))) return true;
    return false;
  }

  function flatFocusRawConflicts(effect, record, exactIdentity = false) {
    for (const key of ['spellId', 'effectId', 'id']) {
      if (effect[key] != null && String(effect[key]).trim() !== String(record.spellId)) return true;
    }
    if (effect.critScaled != null && effect.critScaled !== true) return true;
    for (const key of ['flatDamage', 'spellGroup']) {
      if (effect[key] != null && Number(effect[key]) !== record[key]) return true;
    }
    if (effect.eligibleSpellIds != null && (!Array.isArray(effect.eligibleSpellIds) ||
        effect.eligibleSpellIds.length !== record.eligibleSpellIds.length ||
        record.eligibleSpellIds.some((id) => !effect.eligibleSpellIds.includes(id)))) return true;
    const lines = rawText(effect).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (normalizeName(lines[0]) === normalizeName(record.name)) lines.shift();
    if (!lines.length) return false;
    if (lines.length > 2) return true;
    const damage = lines[0].replace(/^\d+\s*:\s*/, '').match(/^(?:SPA\s+303\s+Base1\s*=\s*(\d+)|Increase Spell Damage by (\d+) \(v303, Before Crit\))$/i);
    if (!damage || Number(damage[1] || damage[2]) !== record.flatDamage) return true;
    // Exact identity supplies catalog group limits; raw-only matching must prove them.
    if (lines.length === 1) return !exactIdentity;
    const group = lines[1].replace(/^\d+\s*:\s*/, '').match(/^(?:SPA\s+385\s+Base1\s*=\s*(\d+)|Limit Spell Group:\s*(\d+))$/i);
    const spells = lines[1].replace(/^\d+\s*:\s*/, '').match(/^Limit Spells:\s*(.+)$/i);
    const names = spells ? spells[1].split(',').map(normalizeName) : [];
    const baseName = record.name.replace(/^Type3 FC /, '');
    const exactList = names.length === 3 && [baseName, baseName + ' Rk. II', baseName + ' Rk. III']
      .every((name) => names.includes(normalizeName(name)));
    return !(group && Number(group[1] || group[2]) === record.spellGroup || exactList);
  }

  function resolveFocus(effect) {
    if (!effect || typeof effect !== 'object' || effect.type !== 'focus') return null;
    const names = [effect.name, rawName(rawText(effect))].map(normalizeName).filter(Boolean);
    const nameRecords = names.map((name) => focusByName.get(name)).filter(Boolean);
    const uniqueNames = [...new Set(nameRecords)];
    if (uniqueNames.length > 1) return null;
    const spellIds = ids(effect, 'focus');
    if (spellIds.length > 1) return null;
    const idRecord = spellIds.length ? focusById.get(spellIds[0]) || null : null;
    if (spellIds.length && !idRecord) return null;
    if (idRecord && uniqueNames.length && idRecord !== uniqueNames[0]) return null;
    const explicitName = effect.name == null ? '' : String(effect.name).trim();
    if (explicitName && !focusByName.has(normalizeName(explicitName))) return null;
    const packetRecords = !idRecord && !uniqueNames.length && rawText(effect)
      ? focusRecords.filter((entry) => entry.flatDamage != null && !flatFocusRawConflicts(effect, entry)) : [];
    const record = idRecord || uniqueNames[0] || (packetRecords.length === 1 ? packetRecords[0] : null);
    if (!record) return null;
    const parsedRawName = rawName(rawText(effect));
    if (record.flatDamage != null) {
      if (flatFocusRawConflicts(effect, record, !!(idRecord || uniqueNames.length))) return null;
      return { ...record, eligibleSpellIds: [...record.eligibleSpellIds] };
    }
    if (parsedRawName && !/^\d+\s*:/.test(parsedRawName) && normalizeName(parsedRawName) !== normalizeName(record.name)) return null;
    if (focusRawConflicts(effect, record)) return null;
    return { spellId: record.spellId, name: record.name, minPct: record.minPct, maxPct: record.maxPct,
      maxLevel: record.maxLevel, decayPctPerLevel: record.decayPctPerLevel, resist: record.resist,
      critScaled: record.critScaled, source: record.source };
  }

  const wizardRotationRecords = [23156, 24314, 25894].map((baseDamage, index) => ({
    spellId: 35821 + index, name: 'Ethereal Hoarfrost' + ['', ' Rk. II', ' Rk. III'][index],
    level: 99, baseDamage, mana: [3740, 3890, 4046][index], castSeconds: 3.75, recastSeconds: 5.25,
    resist: 'Cold', resistAdjust: -50,
    source: { label: 'RaidLoot Wizard spell list', url: 'https://www.raidloot.com/spells/wizard' },
  }));
  const casterRotationRecords = {
    'magician-spear': [24460, 25683, 26967].map((baseDamage, index) => ({
      spellId: 36022 + index, name: 'Spear of Blistersteel' + ['', ' Rk. II', ' Rk. III'][index],
      level: 100, baseDamage, mana: [3951, 4109, 4273][index], castSeconds: 3.5, recastSeconds: 9,
      resist: 'Fire', resistAdjust: 0,
      source: { label: 'RaidLoot Magician spell list', url: 'https://www.raidloot.com/spells/mage' },
    })),
    'enchanter-mindcleave': [20791, 21831, 22922].map((baseDamage, index) => ({
      spellId: 36237 + index, name: 'Mindcleave' + ['', ' Rk. II', ' Rk. III'][index],
      level: 100, baseDamage, mana: [3316, 3449, 3587][index], castSeconds: 4, recastSeconds: 9,
      resist: 'Lowest', resistAdjust: 0,
      source: { label: 'RaidLoot Enchanter spell list', url: 'https://www.raidloot.com/spells/enchanter' },
    })),
    'necro-pyre': [8271, 8685, 9119].map((tickDamage, index) => ({
      spellId: 35610 + index, name: 'Pyre of Marnek' + ['', ' Rk. II', ' Rk. III'][index],
      level: 99, baseDamage: tickDamage, tickDamage, tickCount: 5, tickIntervalSeconds: 6,
      durationSeconds: 30, kind: 'dot', mana: [8854, 9208, 9668][index], castSeconds: 3, recastSeconds: 1.5,
      resist: 'Fire', resistAdjust: -100,
      source: { label: 'RaidLoot Necromancer spell list', url: 'https://www.raidloot.com/spells/necro' },
    })),
  };
  function spellRotation(rank, model = 'beastlord') {
    if (!Number.isInteger(rank) || rank < 1 || rank > 3) return [];
    if (model === 'wizard-hoarfrost') return [{ ...wizardRotationRecords[rank - 1] }];
    if (casterRotationRecords[model]) return [{ ...casterRotationRecords[model][rank - 1] }];
    if (model !== 'beastlord') return [];
    return rotationRecords[rank - 1].map((spell) => ({ ...spell }));
  }

  const catalog = {
    version: 1,
    sources: SOURCES,
    resolveWorn: (effect) => resolve(effect, 'worn'),
    resolveProc,
    resolveFocus,
    spellRotation,
  };
  LC.damageCatalog = Object.freeze(catalog);
})();
