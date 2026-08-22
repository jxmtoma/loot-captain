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
    purity: 'Purity', luck: 'Luck', haste: 'Haste', damage: 'Damage', delay: 'Delay', range: 'Range',
    regen: 'Regen', 'hp regen': 'Regen', manaregen: 'ManaRegen', 'mana regen': 'ManaRegen',
    endregen: 'EndRegen', 'end regen': 'EndRegen',
  };

  const HEROIC_STATS = { STR: 'HStr', STA: 'HSta', AGI: 'HAgi', DEX: 'HDex', INT: 'HInt', WIS: 'HWis', CHA: 'HCha' };

  function canonicalStat(raw) {
    const key = String(raw || '').replace(/:\s*$/, '').trim().replace(/\s+/g, ' ');
    return STAT_ALIASES[key.toLowerCase()] || key;
  }

  function normalizeStats(stats) {
    const out = {};
    for (const key of Object.keys(stats || {})) out[canonicalStat(key)] = stats[key];
    return out;
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
      const num = valTxt.match(/-?\d+(\.\d+)?/);
      stats[key] = { raw: valTxt, num: num ? parseFloat(num[0]) : null };
      const heroic = valTxt.match(/\+\s*(-?\d+(?:\.\d+)?)/);
      if (heroic && HEROIC_STATS[key]) stats[HEROIC_STATS[key]] = { raw: heroic[0], num: parseFloat(heroic[1]) };
    });
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
      for (const c of node.classList) {
        if (c === 'item' || c === 'augment' || /^augment\d+$/.test(c)) continue;
        if (c === 'None') continue;
        if (c.indexOf('rlc-') === 0 || c.indexOf('lc-') === 0) continue;
        slot = c;
        break;
      }
    }
    if (!slot && stats.Slot) slot = stats.Slot.raw;
    const isAugment = (node.classList && node.classList.contains('augment')) ||
      /^aug_/i.test((stats.Type && stats.Type.raw) || '');
    const isWishlist = !!node.querySelector('.wish-remove');
    const isTotalsRow = (node.classList && node.classList.contains('Total')) || node.id === 'item0';
    return { id, name, slot, slotKey: LC.slots.canonicalSlot(slot), stats, isAugment, isWishlist, isTotalsRow };
  }

  // ---------- openDKP JSON parsing ----------
  // openDKP v2+ returns item objects from its REST API. The exact field names
  // vary by version; we normalize the common ones here.
  function parseOpenDkpJson(obj) {
    if (!obj) return null;
    const stats = {};
    // Common stat field patterns in openDKP item JSON.
    const statFields = [
      'ac', 'hp', 'mana', 'end', 'atk',
      'hsta', 'hstr', 'hagi', 'hdex', 'hint', 'hwis', 'hcha',
      'sta', 'str', 'agi', 'dex', 'int', 'wis', 'cha',
      'svfire', 'svcold', 'svmagic', 'svpoison', 'svdisease', 'svcorrupt',
      'heroics', 'healamount', 'spelldmg', 'clairvoyance',
      'purity', 'luck', 'haste', 'damage', 'delay', 'range',
    ];
    const statLabels = {
      ac: 'AC', hp: 'HP', mana: 'MANA', end: 'END', atk: 'ATK',
      hsta: 'HSta', hstr: 'HStr', hagi: 'HAgi', hdex: 'HDex', hint: 'HInt', hwis: 'HWis', hcha: 'HCha',
      sta: 'STA', str: 'STR', agi: 'AGI', dex: 'DEX', int: 'INT', wis: 'WIS', cha: 'CHA',
      svfire: 'SV FIRE', svcold: 'SV COLD', svmagic: 'SV MAGIC', svpoison: 'SV POISON',
      svdisease: 'SV DISEASE', svcorrupt: 'SV CORRUPT',
      heroics: 'Heroics', healamount: 'Heal Amount', spelldmg: 'Spell Dmg', clairvoyance: 'Clairvoyance',
      purity: 'Purity', luck: 'Luck', haste: 'Haste', damage: 'Damage', delay: 'Delay', range: 'Range',
    };
    for (const f of statFields) {
      const v = getField(obj, f);
      if (v == null) continue;
      const label = canonicalStat(statLabels[f] || f);
      stats[label] = { raw: String(v), num: parseFloat(v) };
    }
    // openDKP may nest stats under an object.
    const nestedStats = getField(obj, 'stats');
    if (nestedStats && typeof nestedStats === 'object') {
      for (const k of Object.keys(nestedStats)) {
        const v = nestedStats[k];
        if (v == null) continue;
        const label = canonicalStat(statLabels[k.toLowerCase()] || k);
        stats[label] = { raw: String(v), num: parseFloat(v) };
      }
    }
    const name = getField(obj, 'name') || getField(obj, 'itemName') || getField(obj, 'item_name') || '';
    const slot = getField(obj, 'slot') || getField(obj, 'slotName') || getField(obj, 'slot_name') || getField(obj, 'equipSlot') || '';
    const rawId = getField(obj, 'id') != null ? getField(obj, 'id') : getField(obj, 'itemId');
    const id = rawId != null ? String(rawId) : '';
    return {
      id,
      name,
      slot,
      slotKey: LC.slots.canonicalSlot(slot),
      stats,
      isAugment: false,
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
    const slotRe = /(Slot|Equip Slot|EquipSlot)\s*:?\s*([A-Za-z -]+)/i;
    const sm = text.match(slotRe);
    if (sm) slot = sm[2].trim();
    if (!slot) {
      const slotNames = ['Charm', 'Ear', 'Head', 'Face', 'Neck', 'Shoulders', 'Shoulder', 'Arms', 'Arm', 'Back', 'Wrist', 'Range', 'Hands', 'Hand', 'Primary', 'Secondary', 'Finger', 'Fingers', 'Chest', 'Legs', 'Leg', 'Feet', 'Foot', 'Waist', 'Power Source'];
      slot = lines.find((line) => slotNames.some((candidate) => line.toLowerCase() === candidate.toLowerCase())) || '';
      if (!slot) {
        const slotMatch = text.match(/\b(Charm|Ears?|Heads?|Faces?|Necks?|Shoulders?|Arms?|Back|Wrists?|Ranges?|Hands?|Primary|Secondary|Fingers?|Chests?|Legs?|Feet|Waist|Power Source)\b/i);
        slot = slotMatch ? slotMatch[1] : '';
      }
    }
    return {
      id: '',
      name,
      slot,
      slotKey: LC.slots.canonicalSlot(slot),
      stats,
      isAugment: false,
      isWishlist: false,
      isTotalsRow: false,
    };
  }

  function parseOpenDkpTooltip(container) {
    if (!container) return null;
    const text = container.textContent || '';
    if (!/(?:\bAC|\bHP|\bMana|\bStrength)\s*:\s*-?\d/i.test(text)) return null;
    const item = parseOpenDkpDom(container);
    return item && item.name && item.slotKey ? item : null;
  }

  LC.parser = {
    parseRaidlootNode,
    parseOpenDkpJson,
    parseOpenDkpDom,
    parseOpenDkpTooltip,
    canonicalStat,
    normalizeStats,
  };
})();
