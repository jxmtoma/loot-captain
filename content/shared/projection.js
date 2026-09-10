// Versioned, source-backed rules. Unsupported character outputs stay unavailable.
(function () {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const LC = root.LootCaptain = root.LootCaptain || {};
  const RULE = Object.freeze({ key: 'bst-accuracy', version: 1, name: 'Heroic DEX → Accuracy',
    source: 'https://forums.everquest.com/index.php?threads/heroic-stats-mod2-calculated-incorrectly.266158/post-4048883',
    sourceDate: '2021-07-20', min: 400, max: 4000 });
  const numeric = (value) => {
    const num = value && typeof value === 'object' ? value.num : value;
    return typeof num === 'number' && Number.isFinite(num) ? num : null;
  };
  function accuracy(hdex) {
    if (!Number.isInteger(hdex) || hdex < RULE.min || hdex > RULE.max) return null;
    return 151 + Math.floor((hdex - 400) * 149 / 3600);
  }
  function context(snapshot) {
    return { cls: String(snapshot.cls || '').toLowerCase(), level: Number(snapshot.level),
      server: String(snapshot.server || '').trim().toLowerCase(), expansion: snapshot.expansion, patch: snapshot.patch,
      conditions: snapshot.conditions, aaRanks: [...(snapshot.aaRanks || [])].sort((a, b) => LC.characterData.serialize(a).localeCompare(LC.characterData.serialize(b))) };
  }
  function contextReason(snapshot) {
    if (!snapshot) return 'Capture an in-game character snapshot in Manage Characters.';
    if (!['beastlord', 'bst'].includes(String(snapshot.cls || '').toLowerCase()) || Number(snapshot.level) !== 100) {
      return 'The initial rule supports level-100 Beastlords only.';
    }
    for (const key of ['server', 'expansion', 'patch', 'conditions', 'observer']) if (!snapshot[key]) return 'Snapshot is missing ' + key + '.';
    if ((snapshot.aaRanks || []).some((entry) => entry.assumed)) return 'Confirm AA ranks before rule validation; maximum defaults are assumptions, not measured ownership.';
    if (!snapshot.unbuffed || !snapshot.gearConfirmed) return 'Reconfirm an unbuffed in-game snapshot for the current worn gear.';
    return '';
  }
  function assess(observation) {
    if (!observation) return { ok: false, reason: 'Select a saved gear-swap observation.' };
    if (observation.reviewStatus !== 'pending') return { ok: false, reason: 'Use a complete, consistent observation pending review; incomplete or inconsistent records cannot validate a rule.' };
    const reason = contextReason(observation.baselineSnapshot);
    if (reason) return { ok: false, reason };
    if (!observation.conditionsUnchanged || !observation.observer || !observation.itemChanges || !observation.sourceReferences) {
      return { ok: false, reason: 'Record unchanged conditions, item changes, observer and capture references for this observation.' };
    }
    const points = ['before', 'after', 'restored'].map((stage) => ({
      hdex: numeric(observation[stage] && observation[stage].HDEX),
      accuracy: numeric(observation[stage] && observation[stage].Accuracy),
    }));
    if (points.some((point) => point.hdex == null || point.accuracy == null)) return { ok: false, reason: 'Record Heroic DEX and the Accuracy modifier for before, after and restored states.' };
    if (points[0].hdex !== points[2].hdex || points[0].accuracy !== points[2].accuracy) return { ok: false, reason: 'Restored readings do not match the starting readings.' };
    const baseline = observation.baselineSnapshot.readings || {};
    if (numeric(baseline.HDEX) !== points[0].hdex || numeric(baseline.Accuracy) !== points[0].accuracy) return { ok: false, reason: 'Starting readings do not match the saved baseline snapshot.' };
    if (points.some((point) => accuracy(point.hdex) == null || accuracy(point.hdex) !== point.accuracy)) return { ok: false, reason: 'Readings do not match this published rule, or lie outside its 400–4000 Heroic DEX domain.' };
    if (points[0].accuracy === points[1].accuracy) return { ok: false, reason: 'Use a swap that crosses an Accuracy breakpoint; an unchanged result is inconclusive.' };
    return { ok: true, reason: 'Readings match the source rule. Review their authenticity and unchanged conditions before approving.',
      range: [Math.min(points[0].hdex, points[1].hdex), Math.max(points[0].hdex, points[1].hdex)] };
  }
  function approve(data, value) {
    if (!value || value.ruleKey !== RULE.key || value.version !== RULE.version || value.confirmed !== true) throw new Error('Confirm the observation review for the supported rule');
    const observation = data.observations.find((entry) => entry.id === value.observationId);
    const result = assess(observation);
    if (!result.ok) throw new Error(result.reason);
    return { ruleKey: RULE.key, version: RULE.version, observationId: observation.id,
      evidence: LC.characterData.serialize(observation), context: context(observation.baselineSnapshot),
      range: result.range, approvedAt: new Date().toISOString() };
  }
  function matchingApproval(data, snapshot, low, high) {
    return (data.ruleApprovals || []).find((approval) => {
      if (approval.ruleKey !== RULE.key || approval.version !== RULE.version ||
          LC.characterData.serialize(approval.context) !== LC.characterData.serialize(context(snapshot))) return false;
      const observation = data.observations.find((entry) => entry.id === approval.observationId);
      const result = assess(observation);
      return result.ok && approval.evidence === LC.characterData.serialize(observation) &&
        low >= result.range[0] && high <= result.range[1];
    });
  }
  async function snapshotReason(profile) {
    const data = profile.characterData;
    if (!data || !data.snapshot) return 'Capture an in-game character snapshot in Manage Characters.';
    if (data.version !== 1) return 'Unsupported character-data version.';
    const snapshot = data.snapshot;
    if (snapshot.invalidatedAt || snapshot.binding !== await LC.characterData.fingerprint(profile)) return 'Snapshot is stale. Recapture it for the current worn gear.';
    if (String(snapshot.profileId) !== String(profile.id)) return 'Snapshot belongs to another character.';
    if (LC.characterData.serialize(snapshot.aaRanks || []) !== LC.characterData.serialize(data.aaRanks || [])) return 'AA records changed; recapture the snapshot.';
    return contextReason(snapshot);
  }
  function itemNumber(item, key) {
    const entry = Object.entries(item && item.stats || {}).find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (!entry) return null;
    const value = entry[1];
    if (typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim())) return numeric(Number(value));
    return numeric(value);
  }
  async function project(profile, candidate, worn, confirmed = false) {
    const unavailable = (reason) => ({ metric: 'Accuracy', available: false, reason });
    const outputs = [
      { metric: 'HP', available: false, reason: 'No validated STA/HSTA and AA multiplier conversion for this character.' },
      { metric: 'MANA', available: false, reason: 'No validated Beastlord WIS/HWIS-to-mana conversion.' },
      { metric: 'ATK', available: false, reason: 'No validated STR/HSTR and item-ATK cap conversion.' },
    ];
    const result = { outputs, rule: RULE, needsConfirmation: false, snapshotId: profile.characterData?.snapshot?.id || null };
    const reason = await snapshotReason(profile);
    if (reason) { result.reason = reason; outputs.unshift(unavailable(reason)); return result; }
    if (!worn) { outputs.unshift(unavailable('Choose an equipped baseline; empty-slot and wishlist projections are not supported.')); return result; }
    const snapshot = profile.characterData.snapshot, baseline = snapshot.readings || {};
    const currentHDex = numeric(baseline.HDEX), currentAccuracy = numeric(baseline.Accuracy);
    const oldHDex = itemNumber(worn, 'HDex'), newHDex = itemNumber(candidate, 'HDex');
    if ([currentHDex, currentAccuracy, oldHDex, newHDex].some((value) => value == null)) { outputs.unshift(unavailable('Need snapshot Heroic DEX/Accuracy and known Heroic DEX on both items; omitted values are unknown.')); return result; }
    const nextHDex = currentHDex + newHDex - oldHDex;
    if (accuracy(currentHDex) == null || accuracy(nextHDex) == null || accuracy(currentHDex) !== currentAccuracy) {
      outputs.unshift(unavailable('Current readings or replacement fall outside the supported rule.')); return result;
    }
    const approval = matchingApproval(profile.characterData, snapshot, Math.min(currentHDex, nextHDex), Math.max(currentHDex, nextHDex));
    if (!approval) { outputs.unshift(unavailable('Approve a matching in-game Accuracy observation covering this Heroic DEX range in Manage Characters.')); return result; }
    result.needsConfirmation = true;
    if (!confirmed) { outputs.unshift(unavailable('Confirm wearability and unchanged augments, other effects and power-source conditions for this comparison.')); return result; }
    const projected = accuracy(nextHDex);
    outputs.unshift({ metric: 'Accuracy', available: true, confidence: 'Derived (conditional)', current: currentAccuracy,
      projected, delta: projected - currentAccuracy, heroicBefore: currentHDex, heroicAfter: nextHDex,
      observationId: approval.observationId, approvedRange: approval.range,
      assumption: 'Selected item changes only; all other gear, augments, effects, AA ranks, buffs and power-source conditions stay unchanged.' });
    return result;
  }
  LC.projection = { RULE, accuracy, assess, approve, snapshotReason, project };
})();
