// RaidLoot HTML parser. Loaded in the offscreen DOM context and the service worker.

const PARSER_EQUIPMENT_SLOTS = new Set([
  'charm', 'ear', 'head', 'face', 'neck', 'shoulders', 'arms', 'back',
  'wrist', 'range', 'hands', 'primary', 'finger', 'chest', 'legs', 'feet',
  'waist', 'secondary', 'powersource',
]);
const PARSER_PAIRED_SLOTS = new Set(['ear', 'wrist', 'finger']);
const PARSER_HEROIC_STATS = { STR: 'HStr', STA: 'HSta', AGI: 'HAgi', DEX: 'HDex', INT: 'HInt', WIS: 'HWis', CHA: 'HCha' };
const PARSER_NON_NUMERIC_LABEL = /^(?:slot|class|race|type|deity|skill|effect|click|focus|tools|required|restriction|lore|aug)/i;
const PARSER_CLASS_ALIASES = {
  all: 'ALL', warrior: 'WAR', war: 'WAR', cleric: 'CLR', clr: 'CLR', paladin: 'PAL', pal: 'PAL',
  ranger: 'RNG', rng: 'RNG', shadowknight: 'SHD', shd: 'SHD', druid: 'DRU', dru: 'DRU',
  monk: 'MNK', mnk: 'MNK', bard: 'BRD', brd: 'BRD', rogue: 'ROG', rog: 'ROG', shaman: 'SHM', shm: 'SHM',
  necromancer: 'NEC', nec: 'NEC', wizard: 'WIZ', wiz: 'WIZ', magician: 'MAG', mag: 'MAG',
  enchanter: 'ENC', enc: 'ENC', beastlord: 'BST', bst: 'BST', berserker: 'BER', ber: 'BER',
};
const PARSER_EFFECT_STOP_WORDS = new Set(['a', 'an', 'and', 'beneficial', 'detrimental', 'effect', 'focus', 'for', 'of', 'on', 'proc', 'procs', 'spell', 'the', 'to', 'weapon', 'with']);

function parserCanonicalEffectType(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (/^(?:spell)?focus(?:effect)?s?$/.test(key)) return 'focus';
  if (/^(?:weapon)?proc(?:effect)?s?$/.test(key)) return 'proc';
  return '';
}

function parserNormalizeEffectText(raw) {
  let text = String(raw || '').replace(/<[^>]*>/g, ' ').toLowerCase();
  text = text.replace(/\b(?:spell )?focus(?: effect)?s?\s*:?/g, ' ')
    .replace(/\b(?:weapon )?proc(?: effect)?s?\s*:?/g, ' ')
    .replace(/\bl\s*\d+\b/g, ' ')
    .replace(/\b(?:rank|level|tier|version|v)\s*(?:[ivxlcdm]+|\d+)\b/g, ' ')
    .replace(/[+-]?\d+(?:\.\d+)?\s*%?/g, ' ')
    .replace(/\b(?:aggro|agro|threat)\b/g, ' hate')
    .replace(/\b(?:dmg|damaging)\b/g, ' damage')
    .replace(/\b(?:healing|heals)\b/g, ' heal')
    .replace(/\b(?:stuns|stunning)\b/g, ' stun')
    .replace(/\b(?:slows|slowing)\b/g, ' slow')
    .replace(/\b(?:debuffs|debuffing)\b/g, ' debuff')
    .replace(/\b(?:spell|casting|cast)\s+haste\b/g, ' haste')
    .replace(/\b(?:casts|casting|cast)\b/g, ' cast')
    .replace(/\b(?:preservation|preserve)\b/g, ' preserve');
  return [...new Set(text.replace(/[^a-z]+/g, ' ').trim().split(/\s+/)
    .filter((token) => token && !PARSER_EFFECT_STOP_WORDS.has(token)))].sort().join(' ');
}

function parserEffectRank(raw) {
  const text = String(raw || '');
  const level = text.match(/\bL\s*(\d+)\b/i);
  if (level) return level[1];
  const rank = text.match(/\b(?:rank|level|tier|version|v)\s*([ivxlcdm]+|\d+)\b/i);
  if (rank) return rank[1];
  const percent = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return percent ? percent[1] + '%' : null;
}

function parserEffectName(raw) {
  return String(raw || '').replace(/^\s*(?:spell )?focus(?: effect)?s?\s*:\s*/i, '')
    .replace(/^\s*(?:weapon )?proc(?: effect)?s?\s*:\s*/i, '').trim();
}

function parserNormalizeEffect(value, defaultType) {
  const object = value && typeof value === 'object' ? value : null;
  const raw = String(object ? (object.raw ?? object.description ?? object.text ?? object.name ?? '') : value || '').trim();
  const type = parserCanonicalEffectType(object && (object.type || object.kind || object.category)) ||
    parserCanonicalEffectType(defaultType) || parserCanonicalEffectType(raw.match(/^\s*([^:]+):/)?.[1]);
  if (!type || !raw) return null;
  const name = parserEffectName(String(object && object.name || raw));
  const explicitId = object && (object.id ?? object.spellId ?? object.effectId);
  const normalized = parserNormalizeEffectText(name || raw);
  const key = object && object.key ? String(object.key) :
    (explicitId != null && String(explicitId).trim() ? type + ':id:' + String(explicitId).trim() : type + ':' + (normalized || 'unknown'));
  const rank = object && object.rank != null ? String(object.rank) : parserEffectRank(raw);
  return { type, name: name || raw, key, rank, raw };
}

function parserNormalizeEffects(effects) {
  const out = [];
  const seen = new Map();
  for (const effect of effects || []) {
    const normalized = parserNormalizeEffect(effect);
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

function parserParseStructuredEffects(value, defaultType) {
  if (value == null) return [];
  if (Array.isArray(value)) return parserNormalizeEffects(value.flatMap((item) => parserParseStructuredEffects(item, defaultType)));
  if (typeof value === 'object') {
    if (value.type || value.kind || value.category || value.name || value.raw || value.description || value.text) {
      const effect = parserNormalizeEffect(value, defaultType);
      return effect ? [effect] : [];
    }
    return parserNormalizeEffects(Object.entries(value).flatMap(([key, item]) =>
      parserParseStructuredEffects(item, parserCanonicalEffectType(key) || defaultType)));
  }
  const type = parserCanonicalEffectType(defaultType);
  if (type) {
    const raw = String(value).trim();
    const effect = parserNormalizeEffect({ type, name: raw.split(/\r?\n/)[0], raw }, type);
    return effect ? [effect] : [];
  }
  return String(value).split(/\r?\n/).map((line) => parserNormalizeEffect(line.trim(), defaultType)).filter(Boolean);
}

function parserParseEffectLines(text) {
  const effects = [];
  const lines = String(text || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^\s*(Focus(?: Effect)?|Spell Focus|Proc(?: Effect)?|Weapon Proc|Procs|Effect)\s*:\s*(.+)$/i);
    if (!match) continue;
    const type = parserCanonicalEffectType(match[1]);
    const name = match[2].trim();
    const details = [];
    while (lines[index + 1] && (/^\d+\s*:/.test(lines[index + 1]) || /^Recourse\s*:/i.test(lines[index + 1]))) {
      details.push(lines[++index]);
    }
    effects.push(...parserParseStructuredEffects({ type, name, raw: [name, ...details].join('\n') }, type));
  }
  return parserNormalizeEffects(effects);
}

function sameItemName(a, b) {
  return String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') ===
    String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function raidlootIconUrl(value) {
  const url = String(value || '').trim();
  if (/^\/\/(?:cdn\.raidloot\.com|dlil5rqe0ybd2\.cloudfront\.net)\//i.test(url)) return 'https:' + url;
  return /^https:\/\/(?:cdn\.raidloot\.com|dlil5rqe0ybd2\.cloudfront\.net)\//i.test(url) ? url : '';
}

function parserCanonicalSingleSlot(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  const aliases = {
    shoulder: 'shoulders', arm: 'arms', hand: 'hands', leg: 'legs', foot: 'feet',
    finger: 'finger', fingers: 'finger', 'power-source': 'powersource',
  };
  s = aliases[s] || s;
  const m = s.match(/^(ear|wrist|finger|fingers)(-[12])?$/);
  if (m) return { key: m[1] === 'fingers' ? 'finger' : m[1], paired: true };
  return PARSER_EQUIPMENT_SLOTS.has(s) ? { key: s, paired: PARSER_PAIRED_SLOTS.has(s) } : null;
}

function parserCanonicalSlot(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  const allExcept = text.match(/^all\s+except\s+(.+)$/i);
  const rawSlots = allExcept
    ? [...PARSER_EQUIPMENT_SLOTS].filter((key) => !allExcept[1].split(/\s*(?:,|\/|\band\b)\s*/i)
      .map(parserCanonicalSingleSlot).filter(Boolean).some((slot) => slot.key === key))
    : /^all$/i.test(text) ? [...PARSER_EQUIPMENT_SLOTS] : text.split(/\s*(?:,|\/|\band\b)\s*/i);
  const slots = rawSlots
    .map(parserCanonicalSingleSlot)
    .filter(Boolean);
  if (!slots.length) return null;
  const unique = slots.filter((slot, index) => slots.findIndex((item) => item.key === slot.key) === index);
  if (unique.length === 1) return unique[0];
  return { key: unique[0].key, paired: unique.some((slot) => slot.paired), keys: unique.map((slot) => slot.key) };
}

function parserInstalledSlot(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/^fingers(?=-|$)/, 'finger');
  return parserCanonicalSingleSlot(text) ? text : '';
}

function parserAugmentLocation(raw) {
  const match = String(raw || '').match(/\(\s*in\s+([^()]+?)\s*\)/i);
  return match ? parserInstalledSlot(match[1]) : '';
}

function parserAugmentSlot(node, text) {
  const classSlot = [...(node.classList || [])].map((value) => String(value).match(/^augment(\d+)$/i)).find(Boolean);
  const textSlot = String(text || '').match(/\bSlot\s+(\d+)\s*,\s*type\b/i);
  return classSlot ? Number(classSlot[1]) : textSlot ? Number(textSlot[1]) : '';
}

function parserNormalizeClass(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return PARSER_CLASS_ALIASES[key] || '';
}

function parserParseClasses(value) {
  if (Array.isArray(value)) return [...new Set(value.flatMap(parserParseClasses))];
  const text = String(value || '').trim();
  if (!text) return [];
  const direct = parserNormalizeClass(text);
  if (direct) return [direct];
  return [...new Set(text.split(/[,;|/]+/).flatMap((part) => {
    const normalized = parserNormalizeClass(part);
    return normalized ? [normalized] : part.split(/\s+/).map(parserNormalizeClass).filter(Boolean);
  }))];
}

function parserAugmentTypes(value) {
  const text = Array.isArray(value) ? value.join(' ') : String(value || '');
  const match = text.match(/\bAug:\s*([\d,\s]+)/i);
  const bareTypes = /^\s*\d+(?:\s*[, ]\s*\d+)*\s*$/.test(text) ? text : '';
  return [...new Set((match ? match[1] : bareTypes).match(/\d+/g) || [])].map(Number);
}

function parseProfileMetadata(title, heading, bodyText) {
  const metadata = { name: String(title || '').trim(), level: '', cls: '' };
  const candidates = [heading, title].map((value) => String(value || '').trim()).filter(Boolean);
  for (const text of candidates) {
    const grouped = text.match(/^(.+?)\s*\((\d{1,3})\s+([^()]+?)\)\s*(?:[-|].*)?$/);
    const dashed = text.match(/^(.+?)\s*[-|]\s*(?:level\s*)?(\d{1,3})\s+([A-Za-z][A-Za-z ]*?)\s*(?:[-|].*)?$/i);
    const match = grouped || dashed;
    if (match) {
      metadata.name = match[1].trim();
      metadata.level = match[2];
      metadata.cls = match[3].trim();
      break;
    }
  }
  const text = [heading, title, bodyText].filter(Boolean).join('\n');
  if (!metadata.level) {
    const level = text.match(/\b(?:level|lvl)\s*[:=]?\s*(\d{1,3})\b/i);
    if (level) metadata.level = level[1];
  }
  if (!metadata.cls) {
    const cls = text.match(/(?:^|\n)\s*class(?:es)?\s*:\s*([A-Za-z][A-Za-z ]*)/i);
    if (cls) metadata.cls = cls[1].trim();
  }
  return metadata;
}

function parseProfileHtml(html, profileId) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const inv = doc.getElementById('inv') || doc;
  const parsedItems = Array.from(inv.querySelectorAll('div.item[id^="item"][data-id]')).map(parseItemNode);
  const wornEquipment = parsedItems.filter((it) => it && !it.isAugment && !it.isWishlist && !it.isTotalsRow && it.slotKey);
  const items = parsedItems.filter((it) => it && !it.isWishlist && !it.isTotalsRow && it.slotKey).map((item) => {
    if (!item.isAugment) return item;
    const slot = parserInstalledSlot(item.slot) || parserAugmentLocation(item.stats && item.stats.Slot && item.stats.Slot.raw);
    if (!slot) return { ...item, parentId: item.parentId || '' };
    const root = parserCanonicalSingleSlot(slot).key;
    const candidates = wornEquipment.filter((worn) => parserCanonicalSingleSlot(parserInstalledSlot(worn.slot) || worn.slot)?.key === root);
    const exact = candidates.find((worn) => parserInstalledSlot(worn.slot) === slot);
    const index = Number(slot.match(/-(\d+)$/)?.[1]) - 1;
    const parent = exact || (index >= 0 ? candidates[index] : candidates[0]);
    return {
      ...item,
      slot,
      slotKey: parserCanonicalSlot(slot),
      parentId: parent ? parent.id || parent.name : '',
    };
  });
  const titleEl = doc.querySelector('title');
  const title = titleEl ? titleEl.textContent.trim() : '';
  const headingEl = doc.querySelector('h1') || doc.querySelector('h2');
  const metadata = parseProfileMetadata(title, headingEl && headingEl.textContent, doc.body && doc.body.textContent);
  return { id: profileId, ...metadata, items, fetchedAt: Date.now() };
}

function parseItemPage(html, expectedId) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let div = null;
  if (expectedId) {
    div = doc.getElementById('item' + expectedId) ||
      doc.querySelector('div.item[data-id="' + expectedId + '"]');
  }
  if (!div) div = doc.querySelector('div.item[data-id]');
  if (!div) return null;
  const item = parseItemNode(div);
  if (!item) return null;
  if (!item.slot && item.stats && item.stats.Slot && item.stats.Slot.raw) item.slot = item.stats.Slot.raw;
  item.slotKey = parserCanonicalSlot(item.slot);
  return item;
}

function parseSearchItem(html, name) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cleanName = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const node = Array.from(doc.querySelectorAll('div.item[data-id]'))
    .find((candidate) => String(candidate.querySelector('.itemname')?.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ') === cleanName);
  return node ? parseItemNode(node) : null;
}

function parseItemNode(node) {
  if (!node) return null;
  const id = node.dataset && node.dataset.id ? node.dataset.id : (node.id || '').replace(/^item/, '');
  const nameEl = node.querySelector('.itemname');
  const name = nameEl ? nameEl.textContent.trim() : '';
  const iconEl = node.querySelector('img.itemicon');
  const icon = iconEl ? raidlootIconUrl(iconEl.getAttribute('src')) : '';
  const stats = {};
  const effects = [];
  node.querySelectorAll('label').forEach((lbl) => {
    const key = lbl.textContent.replace(/:\s*$/, '').trim();
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
    effects.push(...parserParseStructuredEffects(valTxt, parserCanonicalEffectType(key)));
    const num = valTxt.match(/-?\d+(\.\d+)?/);
    stats[key] = { raw: valTxt, num: PARSER_NON_NUMERIC_LABEL.test(key) ? null : (num ? parseFloat(num[0]) : null) };
    const heroic = valTxt.match(/\+\s*(-?\d+(?:\.\d+)?)/);
    if (heroic && PARSER_HEROIC_STATS[key]) stats[PARSER_HEROIC_STATS[key]] = { raw: heroic[0], num: parseFloat(heroic[1]) };
  });
  effects.push(...parserParseEffectLines(node.innerText || node.textContent));
  const regenMap = { HP: 'Regen', MANA: 'ManaRegen', END: 'EndRegen' };
  for (const src of Object.keys(regenMap)) {
    const statKey = Object.keys(stats).find((key) => key.toUpperCase() === src);
    const raw = statKey && stats[statKey].raw;
    if (!raw) continue;
    const m = raw.match(/\+\s*(-?\d+(?:\.\d+)?)\s*\/\s*tick/i);
    if (m) stats[regenMap[src]] = { raw: m[0], num: parseFloat(m[1]) };
  }
  let slot = null;
  if (node.classList) {
    const slotClasses = [];
    for (const c of node.classList) {
      if (c === 'item' || c === 'augment' || /^augment\d+$/.test(c) || c === 'None' || c.indexOf('rlc-') === 0) continue;
      if (parserCanonicalSlot(c)) slotClasses.push(c);
    }
    if (slotClasses.length) slot = slotClasses.join(', ');
  }
  if (!slot && stats.Slot) slot = stats.Slot.raw;
  const classLine = (node.textContent || '').split(/\r?\n/).find((line) => /^\s*class(?:es)?\s*:/i.test(line));
  const classes = parserParseClasses((stats.Class && stats.Class.raw) || (classLine && classLine.replace(/^\s*class(?:es)?\s*:\s*/i, '')));
  const isAugment = (node.classList && node.classList.contains('augment')) || /^aug_/i.test((stats.Type && stats.Type.raw) || '');
  const augmentTypes = parserAugmentTypes(node.textContent);
  if (isAugment) slot = parserAugmentLocation(stats.Slot && stats.Slot.raw) || parserAugmentLocation(node.textContent) || slot;
  const isWishlist = !!node.querySelector('.wish-remove');
  const isTotalsRow = (node.classList && node.classList.contains('Total')) || node.id === 'item0';
  return { id, name, icon, slot, slotKey: parserCanonicalSlot(slot), classes, stats, effects: parserNormalizeEffects(effects), isAugment, augmentTypes, augSlot: isAugment ? parserAugmentSlot(node, node.textContent) : '', isWishlist, isTotalsRow };
}
