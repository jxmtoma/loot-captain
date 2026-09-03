// Loot Captain - item parsing (shared)
// Parses items from raidloot DOM, openDKP DOM, and openDKP JSON.

(function () {
  'use strict';
  const LC = window.LootCaptain = window.LootCaptain || {};

  const STAT_ALIASES = {
    ac: 'AC', hp: 'HP', mana: 'MANA', end: 'END', endur: 'END', endurance: 'END',
    atk: 'ATK', attack: 'ATK',
    hsta: 'HSta', hstr: 'HStr', hagi: 'HAgi', hdex: 'HDex', hint: 'HInt', hwis: 'HWis', hcha: 'HCha',
    sta: 'STA', stamina: 'STA', str: 'STR', strength: 'STR', agi: 'AGI', agility: 'AGI',
    dex: 'DEX', dexterity: 'DEX', int: 'INT', intelligence: 'INT', wis: 'WIS', wisdom: 'WIS',
    cha: 'CHA', charisma: 'CHA',
    'sv fire': 'SV FIRE', fire: 'SV FIRE', 'sv cold': 'SV COLD', cold: 'SV COLD',
    'sv magic': 'SV MAGIC', magic: 'SV MAGIC', 'sv poison': 'SV POISON', poison: 'SV POISON',
    'sv disease': 'SV DISEASE', disease: 'SV DISEASE', 'sv corrupt': 'SV CORRUPT',
    corrupt: 'SV CORRUPT', corruption: 'SV CORRUPT',
    heroics: 'Heroics', 'heal amount': 'Heal Amount', healamt: 'Heal Amount',
    'spell dmg': 'Spell Dmg', 'spell damage': 'Spell Dmg', clairvoyance: 'Clairvoyance',
    purity: 'Purity', luck: 'Luck', haste: 'Haste', dmg: 'Damage', damage: 'Damage', delay: 'Delay', range: 'Range',
    regen: 'Regen', 'hp regen': 'Regen', manaregen: 'ManaRegen', 'mana regen': 'ManaRegen',
    endregen: 'EndRegen', 'end regen': 'EndRegen',
  };
  const CLASS_ALIASES = {
    all: 'ALL', warrior: 'WAR', war: 'WAR', cleric: 'CLR', clr: 'CLR',
    paladin: 'PAL', pal: 'PAL', ranger: 'RNG', rng: 'RNG', shadowknight: 'SHD', shd: 'SHD',
    druid: 'DRU', dru: 'DRU', monk: 'MNK', mnk: 'MNK', bard: 'BRD', brd: 'BRD',
    rogue: 'ROG', rog: 'ROG', shaman: 'SHM', shm: 'SHM', necromancer: 'NEC', nec: 'NEC',
    wizard: 'WIZ', wiz: 'WIZ', magician: 'MAG', mag: 'MAG', enchanter: 'ENC', enc: 'ENC',
    beastlord: 'BST', bst: 'BST', berserker: 'BER', ber: 'BER',
  };

  const HEROIC_STATS = { STR: 'HStr', STA: 'HSta', AGI: 'HAgi', DEX: 'HDex', INT: 'HInt', WIS: 'HWis', CHA: 'HCha' };
  const NON_NUMERIC_LABEL = /^(?:slot|class|race|type|deity|skill|effect|click|focus|tools|required|restriction|lore|aug)/i;
  const EFFECT_STOP_WORDS = new Set(['a', 'an', 'and', 'beneficial', 'detrimental', 'effect', 'focus', 'for', 'of', 'on', 'proc', 'procs', 'spell', 'the', 'to', 'weapon', 'with']);

  function canonicalEffectType(raw) {
    const key = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (/^(?:spell)?focus(?:effect)?s?$/.test(key)) return 'focus';
    if (/^(?:weapon)?proc(?:effect)?s?$/.test(key)) return 'proc';
    return '';
  }

  function normalizeEffectText(raw) {
    let text = String(raw || '').replace(/<[^>]*>/g, ' ').toLowerCase();
    text = text.replace(/\b(?:spell )?focus(?: effect)?s?\s*:?/g, ' ')
      .replace(/\b(?:weapon )?proc(?: effect)?s?\s*:?/g, ' ')
      .replace(/\bl\s*\d+\b/g, ' ')
      .replace(/\b(?:rank|level|tier|version|v)\s*(?:[ivxlcdm]+|\d+)\b/g, ' ')
      .replace(/[+-]?\d+(?:\.\d+)?\s*%?/g, ' ')
      .replace(/\b(?:aggro|agro|threat)\b/g, 'hate')
      .replace(/\b(?:dmg|damaging)\b/g, 'damage')
      .replace(/\b(?:healing|heals)\b/g, 'heal')
      .replace(/\b(?:stuns|stunning)\b/g, 'stun')
      .replace(/\b(?:slows|slowing)\b/g, 'slow')
      .replace(/\b(?:debuffs|debuffing)\b/g, 'debuff')
      .replace(/\b(?:spell|casting|cast)\s+haste\b/g, 'haste')
      .replace(/\b(?:casts|casting|cast)\b/g, 'cast')
      .replace(/\b(?:preservation|preserve)\b/g, 'preserve');
    return [...new Set(text.replace(/[^a-z]+/g, ' ').trim().split(/\s+/)
      .filter((token) => token && !EFFECT_STOP_WORDS.has(token)))].sort().join(' ');
  }

  function effectRank(raw) {
    const text = String(raw || '');
    const level = text.match(/\bL\s*(\d+)\b/i);
    if (level) return level[1];
    const rank = text.match(/\b(?:rank|level|tier|version|v)\s*([ivxlcdm]+|\d+)\b/i);
    if (rank) return rank[1];
    const percent = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    return percent ? percent[1] + '%' : null;
  }

  function effectName(raw) {
    return String(raw || '').replace(/^\s*(?:spell )?focus(?: effect)?s?\s*:\s*/i, '')
      .replace(/^\s*(?:weapon )?proc(?: effect)?s?\s*:\s*/i, '').trim();
  }

  function normalizeEffect(value, defaultType) {
    const object = value && typeof value === 'object' ? value : null;
    const field = (name) => object && getField(object, name);
    const raw = String(object ? (field('raw') ?? field('description') ?? field('text') ?? field('name') ?? '') : value || '').trim();
    const type = canonicalEffectType(object && (field('type') || field('kind') || field('category'))) ||
      canonicalEffectType(defaultType) || canonicalEffectType(raw.match(/^\s*([^:]+):/)?.[1]);
    if (!type || !raw) return null;
    const name = effectName(String(field('name') || raw));
    const explicitId = field('id') ?? field('spellId') ?? field('effectId');
    const normalized = normalizeEffectText(name || raw);
    const key = field('key') ? String(field('key')) :
      (explicitId != null && String(explicitId).trim() ? type + ':id:' + String(explicitId).trim() : type + ':' + (normalized || 'unknown'));
    const rank = field('rank') != null ? String(field('rank')) : effectRank(raw);
    return { type, name: name || raw, key, rank, raw };
  }

  function normalizeEffects(effects) {
    const out = [];
    const seen = new Map();
    for (const effect of effects || []) {
      const normalized = normalizeEffect(effect);
      if (!normalized) continue;
      const identity = normalized.type + '|' + normalized.key;
      const index = seen.get(identity);
      if (index == null) {
        seen.set(identity, out.length);
        out.push(normalized);
      } else if (normalized.raw.length > out[index].raw.length) {
        out[index] = normalized;
      }
    }
    return out;
  }

  function parseStructuredEffects(value, defaultType) {
    if (value == null) return [];
    if (Array.isArray(value)) return normalizeEffects(value.flatMap((item) => parseStructuredEffects(item, defaultType)));
    if (typeof value === 'object') {
      if (value.type || value.kind || value.category || value.name || value.raw || value.description || value.text) {
        const effect = normalizeEffect(value, defaultType);
        return effect ? [effect] : [];
      }
      return normalizeEffects(Object.entries(value).flatMap(([key, item]) =>
        parseStructuredEffects(item, canonicalEffectType(key) || defaultType)));
    }
    const type = canonicalEffectType(defaultType);
    if (type) {
      const raw = String(value).trim();
      const effect = normalizeEffect({ type, name: raw.split(/\r?\n/)[0], raw }, type);
      return effect ? [effect] : [];
    }
    return String(value).split(/\r?\n/).map((line) => normalizeEffect(line.trim(), defaultType)).filter(Boolean);
  }

  function parseEffectLines(text) {
    const effects = [];
    const lines = String(text || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const match = line.match(/^\s*(Focus(?: Effect)?|Spell Focus|Proc(?: Effect)?|Weapon Proc|Procs|Effect)\s*:\s*(.+)$/i);
      if (!match) continue;
      const type = canonicalEffectType(match[1]);
      const name = match[2].trim();
      const details = [];
      while (lines[index + 1] && (/^\d+\s*:/.test(lines[index + 1]) || /^Recourse\s*:/i.test(lines[index + 1]))) {
        details.push(lines[++index]);
      }
      effects.push(...parseStructuredEffects({ type, name, raw: [name, ...details].join('\n') }, type));
    }
    return normalizeEffects(effects);
  }

  function effectSimilarity(a, b) {
    if (!a || !b || a.type !== b.type) return 0;
    if (a.key && a.key === b.key) return 1;
    const left = new Set(normalizeEffectText(a.name || a.raw).split(' ').filter(Boolean));
    const right = new Set(normalizeEffectText(b.name || b.raw).split(' ').filter(Boolean));
    if (!left.size || !right.size) return 0;
    let intersection = 0;
    for (const token of left) if (right.has(token)) intersection++;
    return intersection / Math.min(left.size, right.size);
  }

  function canonicalStat(raw) {
    const key = String(raw || '').replace(/:\s*$/, '').trim().replace(/\s+/g, ' ');
    return STAT_ALIASES[key.toLowerCase()] || key;
  }

  function normalizeStats(stats) {
    const out = {};
    for (const key of Object.keys(stats || {})) out[canonicalStat(key)] = stats[key];
    return out;
  }

  function parseAugmentTypes(value) {
    const text = Array.isArray(value) ? value.join(' ') : String(value || '');
    const match = text.match(/\bAug:\s*([\d,\s]+)/i);
    const bareTypes = /^\s*\d+(?:\s*[, ]\s*\d+)*\s*$/.test(text) ? text : '';
    return [...new Set((match ? match[1] : bareTypes).match(/\d+/g) || [])].map(Number);
  }

  function normalizeClass(value) {
    const key = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    return CLASS_ALIASES[key] || '';
  }

  function parseClasses(value) {
    if (Array.isArray(value)) return [...new Set(value.flatMap(parseClasses))];
    const text = String(value || '').trim();
    if (!text) return [];
    const direct = normalizeClass(text);
    if (direct) return [direct];
    return [...new Set(text.split(/[,;|/]+/).flatMap((part) => {
      const normalized = normalizeClass(part);
      return normalized ? [normalized] : part.split(/\s+/).map(normalizeClass).filter(Boolean);
    }))];
  }

  function classesFromText(text) {
    const line = String(text || '').split(/\r?\n/).find((value) => /^\s*class(?:es)?\s*:/i.test(value));
    return parseClasses(line && line.replace(/^\s*class(?:es)?\s*:\s*/i, ''));
  }

  function classMatches(characterClass, allowedClasses) {
    if (!Array.isArray(allowedClasses) || !allowedClasses.length || allowedClasses.includes('ALL')) return true;
    const normalized = normalizeClass(characterClass);
    return !normalized || allowedClasses.includes(normalized);
  }

  function getField(obj, name) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (name in obj) return obj[name];
    const key = Object.keys(obj).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return key == null ? undefined : obj[key];
  }

  // ---------- Raidloot DOM parsing ----------
  function parseRaidlootNode(node) {
    if (!node) return null;
    const id = (node.dataset && node.dataset.id) ? node.dataset.id : (node.id || '').replace(/^item/, '');
    const nameEl = node.querySelector('.itemname');
    const name = nameEl ? nameEl.textContent.trim() : '';
    const stats = {};
    const effects = [];
    node.querySelectorAll('label').forEach((lbl) => {
      const key = canonicalStat(lbl.textContent);
      if (!key) return;
      let valTxt = '';
      let cur = lbl.nextSibling;
      while (cur) {
        if (cur.nodeType === 1) {
          const tag = cur.tagName;
          if (tag === 'LABEL' || tag === 'BR') break;
          if (cur.classList && (cur.classList.contains('itemflag') || cur.classList.contains('note'))) break;
          valTxt += ' ' + cur.textContent;
        } else if (cur.nodeType === 3) {
          valTxt += cur.textContent;
        }
        cur = cur.nextSibling;
      }
      valTxt = valTxt.replace(/\s+/g, ' ').trim();
      effects.push(...parseStructuredEffects(valTxt, canonicalEffectType(key)));
      const num = valTxt.match(/-?\d+(\.\d+)?/);
      stats[key] = { raw: valTxt, num: NON_NUMERIC_LABEL.test(key) ? null : (num ? parseFloat(num[0]) : null) };
      const heroic = valTxt.match(/\+\s*(-?\d+(?:\.\d+)?)/);
      if (heroic && HEROIC_STATS[key]) stats[HEROIC_STATS[key]] = { raw: heroic[0], num: parseFloat(heroic[1]) };
    });
    effects.push(...parseEffectLines(node.innerText || node.textContent));
    // Derive regen stats from "+ N/tick" suffix on HP/MANA/END.
    const REGEN_MAP = { HP: 'Regen', MANA: 'ManaRegen', END: 'EndRegen' };
    for (const src of Object.keys(REGEN_MAP)) {
      const raw = stats[src] && stats[src].raw;
      if (!raw) continue;
      const m = raw.match(/\+\s*(-?\d+(?:\.\d+)?)\s*\/\s*tick/i);
      if (m) stats[REGEN_MAP[src]] = { raw: m[0], num: parseFloat(m[1]) };
    }
    let slot = null;
    if (node.classList) {
      const slotClasses = [];
      for (const c of node.classList) {
        if (c === 'item' || c === 'augment' || /^augment\d+$/.test(c)) continue;
        if (c === 'None') continue;
        if (c.indexOf('rlc-') === 0 || c.indexOf('lc-') === 0) continue;
        if (LC.slots.canonicalSlot(c)) slotClasses.push(c);
      }
      if (slotClasses.length) slot = slotClasses.join(', ');
    }
    if (!slot && stats.Slot) slot = stats.Slot.raw;
    const classes = parseClasses((stats.Class && stats.Class.raw) || classesFromText(node.textContent));
    const isAugment = (node.classList && node.classList.contains('augment')) ||
      /^aug_/i.test((stats.Type && stats.Type.raw) || '');
    const augmentTypes = parseAugmentTypes(node.textContent);
    const isWishlist = !!node.querySelector('.wish-remove');
    const isTotalsRow = (node.classList && node.classList.contains('Total')) || node.id === 'item0';
    return { id, name, slot, slotKey: LC.slots.canonicalSlot(slot), classes, stats, effects: normalizeEffects(effects), isAugment, augmentTypes, isWishlist, isTotalsRow };
  }

  // ---------- openDKP JSON parsing ----------
  // openDKP v2+ returns item objects from its REST API. The exact field names
  // vary by version; we normalize the common ones here.
  function parseOpenDkpJson(obj) {
    if (!obj) return null;
    const stats = {};
    const effects = [];
    const nestedStats = getField(obj, 'stats');
    let classValue = getField(obj, 'classes');
    if (classValue == null) classValue = getField(obj, 'class');
    if (classValue == null && nestedStats && typeof nestedStats === 'object') {
      classValue = getField(nestedStats, 'classes');
      if (classValue == null) classValue = getField(nestedStats, 'class');
    }
    // Common stat field patterns in openDKP item JSON.
    const statFields = [
      'ac', 'hp', 'mana', 'end', 'atk',
      'hsta', 'hstr', 'hagi', 'hdex', 'hint', 'hwis', 'hcha',
      'sta', 'str', 'agi', 'dex', 'int', 'wis', 'cha',
      'svfire', 'svcold', 'svmagic', 'svpoison', 'svdisease', 'svcorrupt',
      'heroics', 'healamount', 'spelldmg', 'clairvoyance',
      'purity', 'luck', 'haste', 'dmg', 'damage', 'delay', 'range',
      'hpregen', 'manaregen', 'endregen', 'hp_regen', 'mana_regen', 'end_regen',
    ];
    const statLabels = {
      ac: 'AC', hp: 'HP', mana: 'MANA', end: 'END', atk: 'ATK',
      hsta: 'HSta', hstr: 'HStr', hagi: 'HAgi', hdex: 'HDex', hint: 'HInt', hwis: 'HWis', hcha: 'HCha',
      sta: 'STA', str: 'STR', agi: 'AGI', dex: 'DEX', int: 'INT', wis: 'WIS', cha: 'CHA',
      svfire: 'SV FIRE', svcold: 'SV COLD', svmagic: 'SV MAGIC', svpoison: 'SV POISON',
      svdisease: 'SV DISEASE', svcorrupt: 'SV CORRUPT',
      heroics: 'Heroics', healamount: 'Heal Amount', spelldmg: 'Spell Dmg', clairvoyance: 'Clairvoyance',
      purity: 'Purity', luck: 'Luck', haste: 'Haste', dmg: 'Damage', damage: 'Damage', delay: 'Delay', range: 'Range',
      hpregen: 'Regen', manaregen: 'ManaRegen', endregen: 'EndRegen',
      hp_regen: 'Regen', mana_regen: 'ManaRegen', end_regen: 'EndRegen',
    };
    for (const f of statFields) {
      const v = getField(obj, f);
      if (v == null) continue;
      const label = canonicalStat(statLabels[f] || f);
      stats[label] = { raw: String(v), num: parseFloat(v) };
    }
    for (const [key, value] of Object.entries(obj)) {
      effects.push(...parseStructuredEffects(value, canonicalEffectType(key)));
    }
    // openDKP may nest stats under an object.
    if (nestedStats && typeof nestedStats === 'object') {
      for (const k of Object.keys(nestedStats)) {
        const v = nestedStats[k];
        if (v == null) continue;
        if (canonicalEffectType(k)) {
          effects.push(...parseStructuredEffects(v, canonicalEffectType(k)));
          continue;
        }
        const label = canonicalStat(statLabels[k.toLowerCase()] || k);
        stats[label] = { raw: String(v), num: parseFloat(v) };
      }
    }
    const name = getField(obj, 'name') || getField(obj, 'itemName') || getField(obj, 'item_name') || '';
    const rawSlot = getField(obj, 'slot') || getField(obj, 'slotName') || getField(obj, 'slot_name') ||
      getField(obj, 'equipSlot') || getField(obj, 'slots') || getField(obj, 'allowedSlots') || '';
    const slot = Array.isArray(rawSlot) ? rawSlot.join(', ') : rawSlot;
    const rawId = getField(obj, 'id') != null ? getField(obj, 'id') : getField(obj, 'itemId');
    const id = rawId != null ? String(rawId) : '';
    const classes = parseClasses(classValue);
    const type = getField(obj, 'type') || getField(obj, 'itemType') || getField(obj, 'item_type') || '';
    const augmentTypes = parseAugmentTypes(getField(obj, 'augTypes') || getField(obj, 'augSlots') ||
      getField(obj, 'augType') || getField(obj, 'augSlot') || type);
    const isAugment = !!(getField(obj, 'isAugment') || getField(obj, 'augment') || getField(obj, 'is_aug')) ||
      augmentTypes.length > 0 || /\baugment(?:ation)?\b/i.test(String(type)) || /\baugment(?:ation)?\b/i.test(String(slot));
    return {
      id,
      name,
      slot,
      slotKey: LC.slots.canonicalSlot(slot),
      classes,
      stats,
      effects: normalizeEffects(effects),
      isAugment,
      augmentTypes,
      isWishlist: false,
      isTotalsRow: false,
    };
  }

  // ---------- openDKP DOM parsing ----------
  function parseOpenDkpDom(container) {
    if (!container) return null;
    const text = container.textContent || '';
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    // Try to find a name (first strong/bold or a link to /items/).
    let name = '';
    const link = container.querySelector('a[href*="/items/"]');
    if (link) name = link.textContent.trim();
    if (!name) {
      const strong = container.querySelector('strong, b, .item-name, .itemname');
      if (strong) name = strong.textContent.trim();
    }
    if (!name) {
      // Fallback: first non-empty line.
      name = lines[0] || '';
      const marker = name.search(/\b(?:Magic|Lore|No Trade|Prestige|Class:|Race:|Size:|AC:)\b/i);
      if (marker > 0) name = name.slice(0, marker).trim();
    }
    const stats = {};
    const effects = parseEffectLines(text);
    const classes = classesFromText(text);
    // Look for "Label: value [+heroic]" patterns from the EQ-style hover card.
    const labelRe = /([A-Za-z][A-Za-z ]{1,30}?):\s*(-?\d+(?:\.\d+)?)(?:\s+([+-]\d+(?:\.\d+)?))?/g;
    let m;
    while ((m = labelRe.exec(text)) !== null) {
      const key = canonicalStat(m[1]);
      const num = parseFloat(m[2]);
      stats[key] = { raw: m[0], num };
      if (m[3] && HEROIC_STATS[key]) {
        stats[HEROIC_STATS[key]] = { raw: m[3], num: parseFloat(m[3]) };
      }
    }
    // Slot detection from common patterns and the plain slot line in hover cards.
    let slot = '';
    const slotLine = lines.find((line) => /^\s*(?:Slots?|Equip Slots?|EquipSlot)\s*:/i.test(line));
    const sm = (slotLine && slotLine.match(/^(?:Slots?|Equip Slots?|EquipSlot)\s*:\s*([A-Za-z ,/]+)$/i)) ||
      text.match(/(?:Slots?|Equip Slots?|EquipSlot)\s*:\s*([A-Za-z ,/]+?)(?=\s+(?:Class|Race|Size|AC|HP|MANA|END|DMG|Damage|Delay|Ratio|Required)\s*:|$)/i);
    if (sm) slot = sm[1].trim();
    if (!slot) {
      const slotNames = ['Charm', 'Ear', 'Head', 'Face', 'Neck', 'Shoulders', 'Shoulder', 'Arms', 'Arm', 'Back', 'Wrist', 'Range', 'Hands', 'Hand', 'Primary', 'Secondary', 'Finger', 'Fingers', 'Chest', 'Legs', 'Leg', 'Feet', 'Foot', 'Waist', 'Power Source'];
      slot = lines.find((line) => slotNames.some((candidate) => line.toLowerCase() === candidate.toLowerCase())) || '';
      if (!slot) {
        // Skip the item name: "Bracer of the Frigid Hand" is not a hands slot.
        const slotMatch = text.replace(name, ' ').match(/\b(Charm|Ears?|Heads?|Faces?|Necks?|Shoulders?|Arms?|Back|Wrists?|Ranges?|Hands?|Primary|Secondary|Fingers?|Chests?|Legs?|Feet|Waist|Power Source)\b/i);
        slot = slotMatch ? slotMatch[1] : '';
      }
    }
    const augmentTypes = parseAugmentTypes(text);
    const isAugment = augmentTypes.length > 0 || /\baugment(?:ation)?\b/i.test(text);
    return {
      id: '',
      name,
      slot,
      slotKey: LC.slots.canonicalSlot(slot),
      classes,
      stats,
      effects,
      isAugment,
      augmentTypes,
      isWishlist: false,
      isTotalsRow: false,
    };
  }

  function parseOpenDkpTooltip(container) {
    if (!container) return null;
    const text = container.textContent || '';
    if (!/(?:\bAC|\bHP|\bMana|\bStrength)\s*:\s*-?\d/i.test(text) && !parseEffectLines(text).length) return null;
    const item = parseOpenDkpDom(container);
    return item && item.name && item.slotKey ? item : null;
  }

  LC.parser = {
    parseRaidlootNode,
    parseOpenDkpJson,
    parseOpenDkpDom,
    parseOpenDkpTooltip,
    parseAugmentTypes,
    canonicalStat,
    normalizeStats,
    normalizeClass,
    parseClasses,
    classMatches,
    canonicalEffectType,
    normalizeEffects,
    parseStructuredEffects,
    effectSimilarity,
  };
})();
