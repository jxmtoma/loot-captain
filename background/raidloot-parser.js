// RaidLoot HTML parser. Loaded in the offscreen DOM context and the service worker.

const PARSER_EQUIPMENT_SLOTS = new Set([
  'charm', 'ear', 'head', 'face', 'neck', 'shoulders', 'arms', 'back',
  'wrist', 'range', 'hands', 'primary', 'finger', 'chest', 'legs', 'feet',
  'waist', 'secondary', 'powersource',
]);
const PARSER_PAIRED_SLOTS = new Set(['ear', 'wrist', 'finger']);
const PARSER_HEROIC_STATS = { STR: 'HStr', STA: 'HSta', AGI: 'HAgi', DEX: 'HDex', INT: 'HInt', WIS: 'HWis', CHA: 'HCha' };

function sameItemName(a, b) {
  return String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') ===
    String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parserCanonicalSlot(raw) {
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

function parseProfileHtml(html, profileId) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const inv = doc.getElementById('inv') || doc;
  const items = Array.from(inv.querySelectorAll('div.item[id^="item"][data-id]'))
    .map(parseItemNode)
    .filter((it) => it && !it.isAugment && !it.isWishlist && !it.isTotalsRow && it.slotKey);
  const titleEl = doc.querySelector('title');
  const title = titleEl ? titleEl.textContent.trim() : '';
  const m = title.match(/^(.+?)\s*\((\d+)\s+(.+?)\)\s*$/);
  return { id: profileId, name: m ? m[1] : title, level: m ? m[2] : '', cls: m ? m[3] : '', items, fetchedAt: Date.now() };
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
  const stats = {};
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
    const num = valTxt.match(/-?\d+(\.\d+)?/);
    stats[key] = { raw: valTxt, num: num ? parseFloat(num[0]) : null };
    const heroic = valTxt.match(/\+\s*(-?\d+(?:\.\d+)?)/);
    if (heroic && PARSER_HEROIC_STATS[key]) stats[PARSER_HEROIC_STATS[key]] = { raw: heroic[0], num: parseFloat(heroic[1]) };
  });
  const regenMap = { HP: 'Regen', MANA: 'ManaRegen', END: 'EndRegen' };
  for (const src of Object.keys(regenMap)) {
    const raw = stats[src] && stats[src].raw;
    if (!raw) continue;
    const m = raw.match(/\+\s*(-?\d+(?:\.\d+)?)\s*\/\s*tick/i);
    if (m) stats[regenMap[src]] = { raw: m[0], num: parseFloat(m[1]) };
  }
  let slot = null;
  if (node.classList) {
    for (const c of node.classList) {
      if (c === 'item' || c === 'augment' || /^augment\d+$/.test(c) || c === 'None' || c.indexOf('rlc-') === 0) continue;
      slot = c;
      break;
    }
  }
  if (!slot && stats.Slot) slot = stats.Slot.raw;
  const isAugment = (node.classList && node.classList.contains('augment')) || /^aug_/i.test((stats.Type && stats.Type.raw) || '');
  const isWishlist = !!node.querySelector('.wish-remove');
  const isTotalsRow = (node.classList && node.classList.contains('Total')) || node.id === 'item0';
  return { id, name, slot, slotKey: parserCanonicalSlot(slot), stats, isAugment, isWishlist, isTotalsRow };
}
