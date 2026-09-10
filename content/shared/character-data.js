// Local character observations. This module deliberately contains no EQ conversion formulas.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const ATTRIBUTES = ['STR', 'STA', 'AGI', 'DEX', 'INT', 'WIS', 'CHA'];
  const METRICS = ['HP', 'MANA', 'END', 'ATK', 'Accuracy', ...ATTRIBUTES.flatMap((key) => [key, key + 'Cap', 'H' + key])];
  const text = (value, max = 1000) => {
    if (value == null) return '';
    if (typeof value !== 'string' || value.length > max) throw new Error('Text is too long or invalid');
    return value.trim();
  };
  function number(value, { integer = false, max = 1e9 } = {}) {
    const raw = typeof value === 'object' && value !== null ? value.raw : value;
    const input = raw == null ? '' : String(raw).trim();
    if (!input) return { raw: '', num: null };
    if (input.length > 40 || !/^\d+(?:\.\d+)?$/.test(input)) throw new Error('Use a non-negative number; leave unknown values blank');
    const num = Number(input);
    if (!Number.isFinite(num) || num > max || integer && !Number.isInteger(num)) throw new Error('Number is outside the allowed range');
    return { raw: input, num };
  }
  function readings(values) {
    if (values == null) values = {};
    if (typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid readings');
    return Object.fromEntries(METRICS.map((key) => [key, number(values[key])]));
  }
  function aaRanks(values) {
    if (!Array.isArray(values) || values.length > 128) throw new Error('Enter at most 128 AA records');
    const names = new Set(), ids = new Set();
    return values.map((value) => {
      if (!value || typeof value !== 'object') throw new Error('Invalid AA record');
      const name = text(value.name, 200), id = text(value.id, 100);
      if (!name && !id) throw new Error('Each AA needs a name or ID');
      if (name && names.has(name.toLowerCase()) || id && ids.has(id)) throw new Error('Duplicate AA record: ' + (name || id));
      if (name) names.add(name.toLowerCase());
      if (id) ids.add(id);
      const rank = number(value.rank, { integer: true, max: 100000 });
      return { name, id, rank, ...(value.assumed === true && rank.num !== null ? { assumed: true } : {}),
        definitionVersion: text(value.definitionVersion, 200), classMask: text(value.classMask, 200),
        requiredLevel: number(value.requiredLevel, { integer: true, max: 255 }),
        expansion: text(value.expansion, 200), description: text(value.description, 4000) };
    });
  }
  function observed(value) {
    const raw = text(value, 80), time = Date.parse(raw);
    if (!raw || !Number.isFinite(time) || time > Date.now() + 300000) throw new Error('Enter a valid observation time, not in the future');
    return new Date(time).toISOString();
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    return value == null ? null : value;
  }
  const serialize = (value) => JSON.stringify(stable(value));
  function statValue(value) {
    const num = value && typeof value === 'object' ? value.num :
      typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : null;
    return typeof num === 'number' && Number.isFinite(num) ? num : { unknown: String(value && value.raw || '') };
  }
  async function fingerprint(profile) {
    const physical = { cls: String(profile.cls || '').toLowerCase(), level: String(profile.level || ''),
      server: String(profile.server || '').trim().toLowerCase(), items: (profile.items || []).map((item) => ({
        id: String(item.id || ''), name: item.name || '', slot: String(item.slot || '').trim().toLowerCase(),
        isAugment: !!item.isAugment, parentId: String(item.parentId || ''), augSlot: String(item.augSlot || ''),
        augmentTypes: (item.augmentTypes || []).map(String).sort(),
        stats: Object.fromEntries(Object.entries(item.stats || {}).map(([key, value]) => [key.toUpperCase(), statValue(value)])),
        effects: (Array.isArray(item.effects) ? item.effects : []).map((effect) => ({
          type: effect.type, name: effect.name, rank: effect.rank, raw: effect.raw, kind: effect.kind,
        })).sort((a, b) => serialize(a).localeCompare(serialize(b))),
      })) };
    const digest = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialize(physical)));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function snapshot(input, profile, binding, ranks) {
    if (!input || typeof input !== 'object') throw new Error('Invalid snapshot');
    const values = readings(input.readings);
    if (!Object.values(values).some((value) => value.num !== null)) throw new Error('Enter at least one in-game reading');
    return { id: root.crypto.randomUUID(), observedAt: observed(input.observedAt),
      observedAtRaw: text(input.observedAtRaw, 80), timeZone: text(input.timeZone, 100),
      observer: text(input.observer, 200), sourceReferences: text(input.sourceReferences, 4000),
      profileId: String(profile.id), cls: profile.cls || '', level: profile.level || '', server: profile.server || '',
      expansion: text(input.expansion, 200), patch: text(input.patch, 200),
      includesHeroics: ['yes', 'no', 'unknown'].includes(input.includesHeroics) ? input.includesHeroics : 'unknown',
      unbuffed: input.unbuffed === true, gearConfirmed: input.gearConfirmed === true,
      conditions: text(input.conditions, 4000), modifiers: text(input.modifiers, 4000),
      readings: values, aaRanks: ranks, binding, invalidatedAt: null, invalidationReason: '' };
  }
  function observation(input, baseline) {
    if (!input || typeof input !== 'object') throw new Error('Invalid observation');
    const before = readings(input.before), after = readings(input.after), restored = readings(input.restored);
    if (![before, after, restored].some((stage) => Object.values(stage).some((value) => value.num !== null))) {
      throw new Error('Enter at least one observation reading');
    }
    const slot = text(input.slot, 100), oldItem = text(input.oldItem, 300), newItem = text(input.newItem, 300);
    if (!slot || !oldItem || !newItem) throw new Error('Enter the slot and both item names');
    const active = METRICS.filter((key) => [before, after, restored].some((stage) => stage[key].num != null));
    const incomplete = active.some((key) => [before, after, restored].some((stage) => stage[key].num == null));
    const inconsistent = active.some((key) => before[key].num != null && restored[key].num != null && before[key].num !== restored[key].num);
    const itemChanges = text(input.itemChanges, 8000);
    const conditionsUnchanged = input.conditionsUnchanged === true;
    const baselineConfirmed = baseline.unbuffed === true && baseline.gearConfirmed === true && !!baseline.conditions;
    const observer = text(input.observer, 200);
    return { id: root.crypto.randomUUID(), kind: 'manual_gear_swap', observedAt: observed(input.observedAt),
      observedAtRaw: text(input.observedAtRaw, 80), timeZone: text(input.timeZone, 100), observer,
      sourceReferences: text(input.sourceReferences, 4000), slot, oldItem, newItem, itemChanges,
      conditionsUnchanged, before, after, restored, baselineSnapshot: baseline,
      reviewStatus: inconsistent ? 'inconsistent' : incomplete || !conditionsUnchanged || !baselineConfirmed || !itemChanges || !observer ? 'incomplete' : 'pending',
    };
  }
  async function status(profile) {
    const data = profile.characterData;
    if (!data) return { state: 'missing', message: 'No character snapshot saved.' };
    if (data.version !== 1) return { state: 'unsupported', message: 'Unsupported character-data version. Export it before changing versions.' };
    const current = data.snapshot;
    if (!current) return { state: 'missing', message: 'No character snapshot saved.' };
    if (current.invalidatedAt || current.binding !== await fingerprint(profile)) {
      return { state: 'stale', message: 'Snapshot needs a new in-game capture: ' + (current.invalidationReason || 'gear or character context changed') + '.' };
    }
    const missing = ['cls', 'level', 'server', 'expansion', 'patch', 'observer', 'conditions'].filter((key) => !current[key]);
    if ((current.aaRanks || []).some((entry) => entry.assumed)) missing.push('confirmed AA ranks');
    if (!current.unbuffed) missing.push('unbuffed confirmation');
    if (!current.gearConfirmed) missing.push('worn-gear confirmation');
    if (current.includesHeroics === 'unknown') missing.push('heroic display convention');
    return missing.length ? { state: 'partial', message: 'Partial snapshot saved. Missing: ' + missing.join(', ') + '.' } :
      { state: 'recorded', message: 'Snapshot saved for this gear. Review the available projection rules below.' };
  }
  LC.characterData = { ATTRIBUTES, METRICS, number, aaRanks, snapshot, observation, fingerprint, serialize, status };
})();
