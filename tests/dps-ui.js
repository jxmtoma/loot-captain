'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(file, 'utf8');
let deferDps = false;
let resolveDps;
const makeElement = (tag = 'div') => {
  const element = {
    tagName: tag.toUpperCase(), children: [], listeners: {}, dataset: {}, attrs: {},
    value: '', type: '', hidden: false, disabled: false, required: false, checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    isConnected: true,
    _text: '',
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return this._text + this.children.map((child) => child.textContent || '').join(''); },
    appendChild(child) { this.children.push(child); return child; },
    insertBefore(child, before) { const index = this.children.indexOf(before); if (index < 0) this.children.push(child); else this.children.splice(index, 0, child); return child; },
    replaceChildren(...children) { this.children = children; this._text = ''; },
    addEventListener(type, callback) { (this.listeners[type] = this.listeners[type] || []).push(callback); },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    find(predicate) { if (predicate(this)) return this; for (const child of this.children) { const hit = child.find && child.find(predicate); if (hit) return hit; } return null; },
    click() { return Promise.all((this.listeners.click || []).map((callback) => callback({ preventDefault() {}, stopPropagation() {} }))); },
  };
  return element;
};

const calls = [];
let savedScenario = null;
let referenceDps = 10;
const context = {
  console,
  chrome: { runtime: { getURL: (value) => 'chrome-extension://test/' + value } },
  document: { createElement: makeElement, createTextNode: (value) => ({ textContent: String(value), find() { return null; } }) },
  LootCaptain: {
    diff: {
      STAT_ORDER: [],
      weaponRatio: (item) => item && item.stats && item.stats.Damage / item.stats.Delay,
      weaponType: (item) => item && item.slotKey && item.slotKey.key === 'primary' ? 'two-hand' : null,
      resolveFormula: (profile, formula) => formula,
    },
    slots: { canonicalSlot: (slot) => ({ key: String(slot).toLowerCase(), keys: [String(slot).toLowerCase()] }) },
    parser: { canWear: () => true, itemRequiredLevel: () => 1 },
    state: {
      async getCharacterProjection(cand, profile, worn, confirmed, mode, assumptions, confirmation) {
        calls.push({ cand, profile, worn, confirmed, mode, assumptions, confirmation });
        if (mode === 'dps-reference' && ['Wizard', 'WIZ'].includes(profile.cls)) return { ok: true,
          projection: context.LootCaptain.dps.referenceProject(profile, cand, worn, null, confirmation) };
        if (mode === 'dps-reference' && ['Berserker', 'BER'].includes(profile.cls)) return { ok: true,
          projection: context.LootCaptain.dps.referenceProject(profile, cand, worn, null, confirmation) };
        if (mode === 'dps' && deferDps) return new Promise((resolve) => { resolveDps = resolve; });
        if (mode === 'dps') return { ok: true, projection: { mode: 'dps', rule: { key: 'bst100-dps', version: 1 }, outputs: [
          { metric: 'Melee DPS', available: true, current: 100, candidate: 110, delta: 10 },
          { metric: 'Proc DPS', available: false, reason: 'Proc rate is unknown.' },
        ], assumptions: ['Same assumptions for both gear sets.'] } };
        if (mode === 'dps-reference' && (!cand.stats || !worn.stats)) return { ok: true, projection: {
          mode: 'dps-reference', scenario: savedScenario || { version: 1, revision: 0, layout: 'dual-wield', hastePercent: 100,
            primary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 10, attacksPerRound: 1 },
            secondary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 0, attacksPerRound: .5 } },
          scenarioRevision: savedScenario ? savedScenario.revision : 0, scenarioDefault: !savedScenario, comparisonBinding: 'test-binding', upgradeScenario: { version: 3, revision: savedScenario ? savedScenario.revision : 0, layout: 'dual-wield', hastePercent: 100, primary: {}, secondary: {}, combat: {}, procs: {}, spells: { rank: 1, cycleSeconds: 32, landingMultiplier: 1, criticalChance: 0, criticalMultiplier: 2, manaPerSecond: 100, meleeDuringCast: 0 } }, effectSources: { current: [], candidate: [] }, procSources: { current: [], candidate: [] }, outputs: [{ metric: 'Melee stats DPS', available: false, reason: 'Required gear stats are unavailable.' }],
        } };
        if (mode === 'dps-reference' && cand.id === 'player-candidate') return { ok: true, projection: {
          mode: 'dps-reference', scenario: savedScenario || { version: 3, revision: 0, layout: 'dual-wield', hastePercent: 100 }, scenarioRevision: 0, scenarioDefault: true, comparisonBinding: 'test-binding',
          outputs: [{ metric: 'Player DPS', available: true, current: 200, candidate: 212.5, delta: 12.5, partial: true, includedComponents: ['melee stats', 'spell DPS'], excludedComponents: ['weapon procs'] }],
        } };
        if (mode === 'dps-reference' && cand.id === 'spell-candidate') return { ok: true, projection: {
          mode: 'dps-reference', scenario: { version: 3, revision: 0, layout: 'dual-wield', hastePercent: 100 }, scenarioRevision: 0, scenarioDefault: true, comparisonBinding: 'test-binding',
          effectSources: { current: [], candidate: [] }, procSources: { current: [], candidate: [] },
          outputs: [{ metric: 'Spell stats DPS', available: true, current: 40, candidate: 44, delta: 4, partial: true, reason: 'Unfocused spell reference; focus modifiers excluded.' }],
        } };
        if (mode === 'dps-reference') return { ok: true, projection: {
          mode: 'dps-reference', scenario: savedScenario || { version: 1, revision: 0, layout: 'dual-wield', hastePercent: 100,
            primary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 10, attacksPerRound: 1 },
            secondary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 0, attacksPerRound: .5 } },
          scenarioRevision: savedScenario ? savedScenario.revision : 0, scenarioDefault: !savedScenario, comparisonBinding: 'test-binding', upgradeScenario: { version: 3, revision: savedScenario ? savedScenario.revision : 0, layout: 'dual-wield', hastePercent: 100,
            primary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 10, attacksPerRound: 1 },
            secondary: { hitChance: .8, mitigationMultiplier: .5, damageMultiplier: 2, damageBonus: 0, attacksPerRound: .5 },
            combat: { baseStrength: 100, baseDexterity: 100, strengthCap: 730, dexterityCap: 730, offenseBase: 400, attackScale: 1, attackCap: 610, targetMitigation: 1000, criticalDifficulty: 8900, otherCriticalBonusPct: 100, criticalDamageMultiplier: 2, doubleAttackSkill: 0, grantedDoubleAttackPct: 30, otherDoubleAttackBonusPct: 0 },
            procs: { primaryPpm: 2, secondaryPpm: 1, landingMultiplier: 1 }, spells: { rank: 1, cycleSeconds: 32, landingMultiplier: 1, criticalChance: 0, criticalMultiplier: 2, manaPerSecond: 100, meleeDuringCast: 0 } }, outputs: [{ metric: 'Melee stats DPS', available: true, current: 100, candidate: 100 + referenceDps, delta: referenceDps, partial: true }], effectSources: { current: [], candidate: [] }, procSources: { current: [], candidate: [] },
        } };
        return { ok: true, projection: { mode: 'reference', needsConfirmation: false, outputs: [], assumptions: [], rule: { sources: [] } } };
      },
      async saveDpsScenario(profileId, scenario, expectedRevision) {
        if (scenario.hastePercent == null || Object.values(scenario.primary || {}).some((value) => value == null) ||
            Object.values(scenario.secondary || {}).some((value) => value == null)) {
          calls.push({ saveDpsScenario: true, profileId, scenario, expectedRevision });
          return { ok: false, error: 'Scenario values are required.' };
        }
        savedScenario = scenario;
        referenceDps = 20;
        calls.push({ saveDpsScenario: true, profileId, scenario, expectedRevision });
        return { ok: true, scenario: { ...scenario, revision: expectedRevision + 1 } };
      },
    },
  },
};
context.window = context;
for (const file of ['dps', 'damage-catalog', 'player-damage']) vm.runInNewContext(read('content/shared/' + file + '.js'), context);
vm.runInNewContext(read('content/shared/ui.js'), context, { filename: 'content/shared/ui.js' });

(async () => {
  const worn = { id: 'worn', name: 'Old Claw', slot: 'Primary', slotKey: { key: 'primary', keys: ['primary'] }, stats: { Damage: 100, Delay: 20 }, effects: [{ type: 'proc', key: 'proc:old', name: 'Old Proc' }] };
  const candidate = { id: 'candidate', name: 'New Claw', slot: 'Primary', effects: [{ type: 'proc', key: 'proc:new', name: 'New Proc' }] };
  const offhand = { id: 'offhand', name: 'Offhand Claw', slot: 'Secondary', slotKey: { key: 'primary', keys: ['primary', 'secondary'] }, effects: [{ type: 'proc', key: 'proc:old', name: 'Shared Proc' }] };
  const profile = { id: 'profile', cls: 'Beastlord', level: '100', items: [worn, offhand] };
  const panel = context.LootCaptain.ui.buildComparePanel(candidate, worn, { diffs: {}, hasData: false }, 'Primary', [], 0, 'stats', 'worn', profile);
  const estimateDetails = panel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'Stat estimates and experimental DPS'));
  assert.ok(estimateDetails);
  const damageDetails = panel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'Damage contributions'));
  assert.ok(damageDetails);
  await damageDetails.children.find((child) => child.tagName === 'SUMMARY').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(damageDetails.textContent, /Melee stats DPS/);
  const damageChecks = damageDetails.find ? (() => {
    const found = [];
    const walk = (node) => { if (node.tagName === 'INPUT' && node.type === 'checkbox') found.push(node); for (const child of node.children || []) walk(child); };
    walk(damageDetails); return found;
  })() : [];
  assert.equal(damageChecks[2].disabled, false);
  damageChecks[0].checked = true;
  (damageChecks[0].listeners.change || []).forEach((callback) => callback({ target: damageChecks[0] }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).confirmation.effectsComplete, true);
  assert.equal(calls.at(-1).confirmation.weaponProcsComplete, false);
  assert.equal(calls.at(-1).confirmation.spellFocusComplete, false);
  const dpsReferenceBadge = context.LootCaptain.ui.buildComparisonBadge({ target: worn,
    diff: { numericScoreAvailable: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-melee', version: 1 }, false,
    { ...candidate, slotKey: { key: 'primary' }, stats: { Damage: 120, Delay: 20 } }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(dpsReferenceBadge.textContent, /Stats \+35 · Melee stats est\. \+10 \(partial\)/);
  assert.equal(dpsReferenceBadge.textContent.match(/[+-]?\d+(?:\.\d+)?/g).length, 2);
  assert.equal(dpsReferenceBadge.dataset.state, 'upgrade');
  assert.equal(dpsReferenceBadge.__lcDpsMetric.dataset.state, 'upgrade');
  assert.equal(dpsReferenceBadge.__lcDpsMetric.textContent, ' · Melee stats est. +10 (partial)');
  const overviewPanel = context.LootCaptain.ui.buildComparePanel({ ...candidate, id: 'overview-candidate', stats: { Damage: 120, Delay: 20 } }, worn,
    { diffs: {}, hasData: false, formula: { key: 'role-melee', version: 1 }, breakdown: [], missingScoreStats: [] }, 'Primary', [], 0, 'stats', 'worn', profile);
  await new Promise((resolve) => setImmediate(resolve));
  const overviewDps = overviewPanel.find((node) => node.tagName === 'P' && node.className === 'lc-dps-overview');
  assert.match(overviewDps.textContent, /Melee stats est\. 100 → 110 \(Δ \+10\) \(partial\)/);
  assert.match(overviewDps.title, /melee stats only/);
  const casterBstBadge = context.LootCaptain.ui.buildComparisonBadge({ target: worn,
    diff: { numericScoreAvailable: true, score: 1, formula: { key: 'role-caster', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-caster', version: 1 }, false,
    { ...candidate, id: 'caster-bst-candidate', stats: { Damage: 120, Delay: 20 } }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(casterBstBadge.textContent, /Melee stats est/);
  const playerBadge = context.LootCaptain.ui.buildComparisonBadge({ target: worn,
    diff: { numericScoreAvailable: true, score: 1, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-melee', version: 1 }, false,
    { ...candidate, id: 'player-candidate', stats: { Damage: 120, Delay: 20 } }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(playerBadge.textContent, /DPS est\. \+12\.50 \(partial\)/);
  assert.match(playerBadge.title, /Includes melee stats, spell DPS\. Excludes weapon procs\./);
  const spellPanel = context.LootCaptain.ui.buildComparePanel({ ...candidate, id: 'spell-candidate', stats: { Damage: 120, Delay: 20 } }, worn,
    { diffs: {}, hasData: false, formula: { key: 'role-melee', version: 1 }, breakdown: [], missingScoreStats: [] }, 'Primary', [], 0, 'stats', 'worn', profile);
  const spellDetails = spellPanel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'Damage contributions'));
  await spellDetails.children.find((child) => child.tagName === 'SUMMARY').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(spellDetails.textContent, /Spell stats DPS: current 40 → candidate 44 .*Unfocused spell reference; focus modifiers excluded/);
  const nonBstBadge = context.LootCaptain.ui.buildComparisonBadge({ target: worn,
    diff: { numericScoreAvailable: true, score: 1, formula: { key: 'role-caster', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-caster', version: 1 }, false,
    { ...candidate, id: 'cleric-candidate', stats: { Damage: 120, Delay: 20 } }, { ...profile, id: 'cleric', cls: 'Cleric' });
  assert.match(nonBstBadge.textContent, /DPS not modeled/);

  referenceDps = -5;
  const negativeDpsBadge = context.LootCaptain.ui.buildComparisonBadge({ target: worn,
    diff: { numericScoreAvailable: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-melee', version: 1 }, false,
    { id: 'negative-candidate', ...candidate, slotKey: { key: 'primary' }, stats: { Damage: 110, Delay: 20 } }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(negativeDpsBadge.dataset.state, 'upgrade');
  assert.equal(negativeDpsBadge.__lcDpsMetric.dataset.state, 'downgrade');
  assert.match(negativeDpsBadge.textContent, /Melee stats est\. -5 \(partial\)/);

  referenceDps = 0;
  const zeroDpsBadge = context.LootCaptain.ui.buildComparisonBadge({ target: worn,
    diff: { numericScoreAvailable: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-melee', version: 1 }, false,
    { id: 'zero-candidate', ...candidate, slotKey: { key: 'primary' }, stats: { Damage: 100, Delay: 20 } }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(zeroDpsBadge.__lcDpsMetric.dataset.state, 'sidegrade');

  const armor = { id: 'armor', name: 'Armor', slot: 'Head', slotKey: { key: 'head', keys: ['head'] }, stats: { HP: 1 } };
  const unsupportedDpsBadge = context.LootCaptain.ui.buildComparisonBadge({ target: armor,
    diff: { numericScoreAvailable: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'head' } },
    { key: 'role-melee', version: 1 }, false, { ...armor, id: 'armor-candidate' }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(unsupportedDpsBadge.textContent, /Melee stats est\. 0 \(partial\)/);
  assert.equal(unsupportedDpsBadge.__lcDpsMetric.dataset.state, 'sidegrade');

  const incompleteWeapon = { id: 'incomplete', name: 'Unknown Claw', slot: 'Primary', slotKey: { key: 'primary', keys: ['primary'] } };
  const unavailableDpsBadge = context.LootCaptain.ui.buildComparisonBadge({ target: incompleteWeapon,
    diff: { numericScoreAvailable: true, score: 0, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } },
    { key: 'role-melee', version: 1 }, false, { ...incompleteWeapon, id: 'incomplete-candidate' }, profile);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(unavailableDpsBadge.textContent, /DPS unavailable/);
  assert.equal(unavailableDpsBadge.__lcDpsMetric.dataset.state, 'nomatch');
  const secondProfile = { ...profile, id: 'second', name: 'Second', items: [worn, offhand] };
  const multiBadge = context.LootCaptain.ui.buildMultiComparisonBadges({
    best: { profile: secondProfile, empty: false, summary: { comparable: true, numericScoreAvailable: true, recommendationAvailable: true, score: 35, rows: [{ diff: { numericScoreAvailable: true, comparable: true, hasData: true, score: 35, formula: { key: 'role-melee', version: 1 } } }] },
      comparison: { rows: [{ target: worn, diff: { numericScoreAvailable: true, comparable: true, hasData: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } }] } },
    results: [
      { profile, empty: false, summary: { comparable: true, numericScoreAvailable: true, recommendationAvailable: true, score: 35, rows: [{ diff: { numericScoreAvailable: true, comparable: true, hasData: true, score: 35, formula: { key: 'role-melee', version: 1 } } }] }, comparison: { rows: [{ target: worn, diff: { numericScoreAvailable: true, comparable: true, hasData: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } }] } },
      { profile: secondProfile, empty: false, summary: { comparable: true, numericScoreAvailable: true, recommendationAvailable: true, score: 35, rows: [{ diff: { numericScoreAvailable: true, comparable: true, hasData: true, score: 35, formula: { key: 'role-melee', version: 1 } } }] }, comparison: { rows: [{ target: worn, diff: { numericScoreAvailable: true, comparable: true, hasData: true, score: 35, formula: { key: 'role-melee', version: 1 } }, slotKey: { key: 'primary' } }] } },
    ], mixedFormulas: false,
  }, { ...candidate, slotKey: { key: 'primary' }, stats: { Damage: 120, Delay: 20 } }, { key: 'role-melee', version: 1 }, false)[0];
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(multiBadge.textContent, /^Second P Stats \+35 · Melee stats est\./);
  assert.match(multiBadge.title, /Character Second/);
  const scenarioDetails = panel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'DPS assumptions'));
  assert.ok(scenarioDetails);
  const scenarioSummary = scenarioDetails.children.find((child) => child.tagName === 'SUMMARY');
  await scenarioSummary.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(scenarioDetails.textContent, /Illustrative reference defaults/);
  const save = scenarioDetails.find((node) => node.tagName === 'BUTTON' && node.textContent === 'Save for this character');
  assert.ok(save);
  await save.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).saveDpsScenario, true);
  assert.equal(calls.at(-1).profileId, 'profile');
  assert.equal(calls.at(-1).scenario.version, 1);
  assert.equal(calls.at(-1).scenario.revision, 0);
  const scenarioNumbers = [];
  const collectScenarioNumbers = (node) => { if (node.tagName === 'INPUT' && node.type === 'number') scenarioNumbers.push(node); for (const child of node.children || []) collectScenarioNumbers(child); };
  collectScenarioNumbers(scenarioDetails);
  scenarioNumbers[0].value = '';
  await save.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).scenario.hastePercent, null);
  assert.match(scenarioDetails.textContent, /Scenario values are required/);
  scenarioNumbers[0].value = '100';
  await save.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).scenario.revision, 1);
  assert.equal(calls.at(-1).scenario.version, 1);
  const upgrade = scenarioDetails.find((node) => node.tagName === 'BUTTON' && node.textContent === 'Enable gear stats and procs');
  assert.ok(upgrade);
  await upgrade.click();
  const upgradedSave = scenarioDetails.find((node) => node.tagName === 'BUTTON' && node.textContent === 'Save for this character');
  await upgradedSave.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).scenario.version, 3);
  assert.ok(calls.at(-1).scenario.combat && calls.at(-1).scenario.procs && calls.at(-1).scenario.spells);
  assert.match(scenarioDetails.textContent, /Spell rotation/);
  await Promise.resolve();
  const mode = panel.find((node) => node.tagName === 'SELECT' && node.children.some((option) => option.value === 'reference'));
  assert.ok(mode);
  mode.value = 'dps';
  await Promise.all((mode.listeners.change || []).map((callback) => callback({ target: mode })));
  await Promise.resolve();
  assert.match(panel.textContent, /Enter assumptions/);
  const scopeSelect = panel.find((node) => node.tagName === 'SELECT' && node.children.some((option) => option.value === 'equipped-weapons'));
  assert.ok(scopeSelect);
  assert.equal(scopeSelect.value, 'selected-hand');
  const calculate = panel.find((node) => node.tagName === 'BUTTON' && node.textContent === 'Calculate');
  assert.ok(calculate);
  await calculate.click();
  await Promise.resolve();
  assert.equal(calls.at(-1).mode, 'dps');
  assert.equal(calls.at(-1).assumptions.hastePercent, null);
  assert.equal(calls.at(-1).assumptions.procListsConfirmed, false);
  assert.equal(calls.at(-1).assumptions.scope, 'selected-hand');
  assert.equal(calls.at(-1).assumptions.otherHand, undefined);
  assert.equal(calls.at(-1).assumptions.procAssumptions[0].procsPerMinute, null);
  assert.match(panel.textContent, /Melee DPS: current 100 → candidate 110/);
  assert.match(estimateDetails.textContent, /Stat estimates and experimental DPS/);
  const allSelects = [];
  const walk = (node) => { if (node.tagName === 'SELECT') allSelects.push(node); for (const child of node.children || []) walk(child); };
  walk(panel);
  assert.ok(allSelects.length >= 3);
  const dpsSelects = allSelects.filter((select) => select !== mode);
  const selectValue = (value) => dpsSelects.find((select) => select.required && select.children.some((option) => option.value === value));
  const handSelect = selectValue('primary');
  const layoutSelect = selectValue('dual-wield');
  handSelect.value = 'primary'; (handSelect.listeners.change || []).forEach((callback) => callback({ target: handSelect }));
  layoutSelect.value = 'dual-wield'; (layoutSelect.listeners.change || []).forEach((callback) => callback({ target: layoutSelect }));
  scopeSelect.value = 'equipped-weapons'; (scopeSelect.listeners.change || []).forEach((callback) => callback({ target: scopeSelect }));
  assert.match(panel.textContent, /both equipped weapon hands/);
  const otherDetails = panel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'Other equipped hand assumptions'));
  assert.ok(otherDetails);
  assert.equal(otherDetails.hidden, false);
  assert.match(otherDetails.textContent, /Offhand Claw/);
  layoutSelect.value = 'two-hand'; (layoutSelect.listeners.change || []).forEach((callback) => callback({ target: layoutSelect }));
  assert.equal(otherDetails.hidden, true);
  layoutSelect.value = 'dual-wield'; (layoutSelect.listeners.change || []).forEach((callback) => callback({ target: layoutSelect }));
  scopeSelect.value = 'selected-hand'; (scopeSelect.listeners.change || []).forEach((callback) => callback({ target: scopeSelect }));
  assert.equal(otherDetails.hidden, true);
  assert.match(panel.textContent, /selected hand only/);
  scopeSelect.value = 'equipped-weapons'; (scopeSelect.listeners.change || []).forEach((callback) => callback({ target: scopeSelect }));
  assert.equal(otherDetails.hidden, false);
  const numberInputs = [];
  const collectNumbers = (node) => { if (node.tagName === 'INPUT' && node.type === 'number') numberInputs.push(node); for (const child of node.children || []) collectNumbers(child); };
  collectNumbers(panel);
  const dpsNumberInputs = numberInputs.filter((input) => (input.listeners.input || []).length);
  dpsNumberInputs.forEach((input, index) => { input.value = index === 0 ? '0' : '1'; });
  const otherFrequency = numberInputs.find((input) => /other-hand proc:old procs per minute/.test(input.attrs['aria-label'] || ''));
  const otherDamage = numberInputs.find((input) => /other-hand proc:old damage per proc/.test(input.attrs['aria-label'] || ''));
  assert.ok(otherFrequency); assert.ok(otherDamage);
  otherFrequency.value = '2';
  (otherFrequency.listeners.input || []).forEach((callback) => callback({ target: otherFrequency }));
  otherDamage.value = '0';
  (otherDamage.listeners.input || []).forEach((callback) => callback({ target: otherDamage }));
  assert.equal(otherFrequency.value, '2');
  assert.equal(otherDamage.value, '0');
  const checkboxes = [];
  const collectCheckboxes = (node) => { if (node.tagName === 'INPUT' && node.type === 'checkbox') checkboxes.push(node); for (const child of node.children || []) collectCheckboxes(child); };
  collectCheckboxes(panel);
  checkboxes.slice(-2).forEach((procCheck) => {
    procCheck.checked = true;
    (procCheck.listeners.input || []).forEach((callback) => callback({ target: procCheck }));
  });
  assert.equal(calls.at(-1).assumptions.hastePercent, null);
  deferDps = true;
  const pending = calculate.click();
  await Promise.resolve();
  assert.equal(calculate.disabled, true);
  dpsNumberInputs[0].value = '0.5';
  (dpsNumberInputs[0].listeners.input || []).forEach((callback) => callback({ target: dpsNumberInputs[0] }));
  assert.equal(calculate.disabled, false);
  resolveDps({ ok: true, projection: { mode: 'dps', rule: { key: 'stale', version: 1 }, outputs: [{ metric: 'Melee DPS', available: true, current: 1, candidate: 999, delta: 998 }] } });
  await pending;
  await Promise.resolve();
  assert.doesNotMatch(panel.textContent, /candidate 999/);
  deferDps = false;
  await calculate.click();
  await Promise.resolve();
  assert.equal(calls.at(-1).assumptions.hastePercent, 0.5);
  assert.equal(calls.at(-1).assumptions.scope, 'equipped-weapons');
  assert.equal(calls.at(-1).assumptions.procListsConfirmed, true);
  assert.equal(calls.at(-1).assumptions.otherHand.hitChance, 1);
  assert.equal(calls.at(-1).assumptions.otherHand.procListsConfirmed, true);
  assert.equal(calls.at(-1).assumptions.otherHand.procAssumptions[0].key, 'proc:old');
  assert.equal(calls.at(-1).assumptions.otherHand.procAssumptions[0].procsPerMinute, 2);
  assert.equal(calls.at(-1).assumptions.otherHand.procAssumptions[0].damagePerProc, 0);
  mode.value = 'reference';
  await Promise.all((mode.listeners.change || []).map((callback) => callback({ target: mode })));
  await Promise.resolve();
  assert.equal(calls.at(-1).mode, 'reference');
  const wizardWorn = { id: 'wizard-worn', slot: 'Chest', name: 'Wizard Robe', stats: { 'Spell Dmg': 70 }, effectsKnown: true, effects: [] };
  const wizard = { id: 'wizard', cls: 'Wizard', level: 100, items: [wizardWorn] };
  for (const [damage, state] of [[140, 'upgrade'], [0, 'downgrade'], [70, 'sidegrade']]) {
    const badge = context.LootCaptain.ui.buildComparisonBadge({ target: wizardWorn,
      diff: { numericScoreAvailable: true, score: 35, formula: { key: 'role-caster', version: 1 } }, slotKey: { key: 'chest' } },
      { key: 'role-caster', version: 1 }, false, { ...wizardWorn, id: 'wizard-' + damage, stats: { 'Spell Dmg': damage } }, wizard);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(badge.textContent, /Stats \+35 · DPS est\./);
    assert.equal(badge.textContent.match(/[+-]?\d+(?:\.\d+)?/g).length, 2);
    assert.equal(badge.dataset.state, 'upgrade');
    assert.equal(badge.__lcDpsMetric.dataset.state, state);
    assert.match(badge.title, /Includes Spell DPS/);
  }
  const wizardPanel = context.LootCaptain.ui.buildComparePanel({ ...wizardWorn, id: 'wizard-panel' }, wizardWorn,
    { diffs: {}, hasData: false }, 'Chest', [], 0, 'stats', 'worn', wizard);
  const wizardEditor = wizardPanel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'DPS assumptions'));
  await wizardEditor.children.find((child) => child.tagName === 'SUMMARY').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(wizardEditor.textContent, /wizard-hoarfrost.*Ethereal Hoarfrost/);
  assert.doesNotMatch(wizardEditor.textContent, /Primary hand|Shared haste|Melee during cast|Poantaar|Layout/);
  assert.equal(wizardPanel.find((node) => node.tagName === 'OPTION' && node.value === 'dps'), null);
  await wizardEditor.find((node) => node.tagName === 'BUTTON' && node.textContent === 'Save for this character').click();
  assert.equal(calls.at(-1).profileId, 'wizard');
  assert.equal(calls.at(-1).scenario.spells.model, 'wizard-hoarfrost');
  assert.equal(calls.at(-1).scenario.spells.cycleSeconds, 12);
  assert.equal(calls.at(-1).scenario.layout, null);
  assert.doesNotThrow(() => context.LootCaptain.dps.validateScenario(calls.at(-1).scenario));
  const berserkerWorn = { id: 'berserker-worn', slot: 'Primary', name: 'Berserker Greatblade', stats: { Damage: 282, Delay: 32 }, effectsKnown: true, effects: [] };
  const berserker = { id: 'berserker', cls: 'Berserker', level: 100, items: [berserkerWorn] };
  const berserkerPanel = context.LootCaptain.ui.buildComparePanel({ ...berserkerWorn, id: 'berserker-candidate', stats: { Damage: 300, Delay: 32 } }, berserkerWorn,
    { diffs: {}, hasData: false }, 'Primary', [], 0, 'stats', 'worn', berserker);
  const berserkerEditor = berserkerPanel.find((node) => node.tagName === 'DETAILS' && node.children.some((child) => child.tagName === 'SUMMARY' && child.textContent === 'DPS assumptions'));
  await berserkerEditor.children.find((child) => child.tagName === 'SUMMARY').click();
  await new Promise((resolve) => setImmediate(resolve));
  const berserkerLayout = berserkerEditor.find((node) => node.tagName === 'SELECT' && node.children.some((option) => option.value === 'two-hand'));
  assert.ok(berserkerLayout);
  berserkerLayout.value = 'two-hand';
  await berserkerEditor.find((node) => node.tagName === 'BUTTON' && node.textContent === 'Save for this character').click();
  assert.equal(calls.at(-1).profileId, 'berserker');
  assert.equal(calls.at(-1).scenario.layout, 'two-hand');
  assert.equal(calls.at(-1).scenario.spells.model, 'beastlord');
  assert.doesNotThrow(() => context.LootCaptain.dps.validateScenario(calls.at(-1).scenario));
  console.log('DPS UI integration check passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
