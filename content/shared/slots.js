// Loot Captain - slot canonicalization (shared)

const EQUIPMENT_SLOTS = new Set([
  'charm', 'ear', 'head', 'face', 'neck', 'shoulders', 'arms', 'back',
  'wrist', 'range', 'hands', 'primary', 'finger', 'chest', 'legs', 'feet',
  'waist', 'secondary', 'powersource',
]);
const PAIRED_SLOTS = new Set(['ear', 'wrist', 'finger']);

function canonicalSingleSlot(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  const aliases = {
    shoulder: 'shoulders',
    arm: 'arms',
    hand: 'hands',
    leg: 'legs',
    foot: 'feet',
    finger: 'finger',
    fingers: 'finger',
    'power-source': 'powersource',
  };
  s = aliases[s] || s;
  const m = s.match(/^(ear|wrist|finger|fingers)(-[12])?$/);
  if (m) {
    const root = m[1] === 'fingers' ? 'finger' : m[1];
    return { key: root, paired: true };
  }
  if (EQUIPMENT_SLOTS.has(s)) return { key: s, paired: PAIRED_SLOTS.has(s) };
  return null;
}

function canonicalSlot(raw) {
  if (!raw) return null;
  const slots = String(raw).split(/\s*(?:,|\/|\band\b)\s*/i)
    .map(canonicalSingleSlot)
    .filter(Boolean);
  if (!slots.length) return null;
  const unique = slots.filter((slot, index) => slots.findIndex((item) => item.key === slot.key) === index);
  if (unique.length === 1) return unique[0];
  return {
    key: unique[0].key,
    paired: unique.some((slot) => slot.paired),
    keys: unique.map((slot) => slot.key),
  };
}

// Expose for content scripts (loaded as classic scripts, so attach to window).
window.LootCaptain = window.LootCaptain || {};
window.LootCaptain.slots = { canonicalSlot, EQUIPMENT_SLOTS, PAIRED_SLOTS };
