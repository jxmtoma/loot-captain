'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(file, 'utf8');
const core = { window: {}, console };
core.window = core;
core.LootCaptain = {};
for (const file of ['content/shared/slots.js', 'content/shared/parser.js', 'content/shared/diff.js']) {
  vm.runInNewContext(read(file), core, { filename: file });
}
const LC = core.LootCaptain;
const hp = LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'hp');
const acHp = LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'ac10hp');
const stat = (num, source = 'manual') => ({ raw: String(num), num, source });

const zero = LC.diff.diffItems({ stats: { HP: stat(0) } }, { stats: { HP: stat(0) } }, hp);
assert.equal(zero.numericScoreAvailable, true);
assert.equal(zero.score, 0);
assert.equal(zero.diffs.HP.delta, 0);

const unknown = LC.diff.diffItems({ stats: { HP: stat(100) } }, { stats: {} }, hp);
assert.equal(unknown.numericScoreAvailable, false);
assert.equal(unknown.score, null);
assert.equal(unknown.diffs.HP.cand, 100);
assert.equal(unknown.diffs.HP.worn, null);
assert.equal(unknown.diffs.HP.delta, null);
assert.deepEqual(Array.from(unknown.missingScoreStats), ['HP']);

for (const value of [Infinity, -Infinity, NaN, { raw: '100', num: null }, { raw: '100' }, '12oops']) {
  assert.equal(LC.diff.numericStat(value), null);
}
const failed = LC.diff.diffItems({ stats: { HP: { raw: 'Infinity', num: Infinity } } }, null, hp);
assert.equal(failed.numericScoreAvailable, false);
assert.equal(failed.score, null);
assert.ok(failed.missingScoreStats.includes('HP'));

const loss = LC.diff.diffItems({ stats: { HP: stat(50) } }, { stats: { HP: stat(100) } }, hp);
assert.equal(loss.numericScoreAvailable, true);
assert.equal(loss.score, -50);
assert.equal(loss.diffs.HP.delta, -50);

const partial = LC.diff.diffItems({ stats: { HP: stat(100) } }, { stats: { HP: stat(50) } }, acHp);
assert.equal(partial.numericScoreAvailable, false);
assert.equal(partial.score, null);
assert.ok(partial.missingScoreStats.includes('AC'));
assert.equal(partial.diffs.AC.delta, null);

const empty = LC.diff.diffItems({ stats: { HP: stat(100) } }, null, hp);
assert.equal(empty.numericScoreAvailable, true);
assert.equal(empty.diffs.HP.worn, 0);
assert.equal(empty.score, 100);
const unresolvedWorn = { name: 'Unresolved', slot: 'Head', stats: {} };
assert.equal(LC.diff.bestComparisonTarget({ stats: { HP: stat(100) } }, [unresolvedWorn], hp), unresolvedWorn);
const paired = LC.diff.bestComparisonTarget({ stats: { HP: stat(100) } }, [
  { name: 'First unresolved', stats: {} },
  { name: 'Second known', stats: { HP: stat(10) } },
], hp);
assert.equal(paired.name, 'First unresolved');

const cand = { name: 'Candidate', slotKey: LC.slots.canonicalSlot('Head'), classes: ['WAR'], stats: { HP: stat(100) } };
const multi = LC.diff.compareCandidateMulti([
  { id: 'unknown', name: 'Unknown', cls: 'WAR', items: [{ name: 'Unknown Helm', slot: 'Head', stats: {} }] },
  { id: 'loss', name: 'Loss', cls: 'WAR', items: [{ name: 'Better Helm', slot: 'Head', stats: { HP: stat(150) } }] },
], cand, hp);
assert.equal(multi.results.length, 2);
assert.equal(multi.best.profile.id, 'loss');
assert.equal(multi.best.summary.score, -50);

const effectCandidate = {
  name: 'Focus Helm', slotKey: LC.slots.canonicalSlot('Head'), classes: ['WAR'], stats: {},
  effects: [{ type: 'focus', name: 'Casting Haste 20%', key: 'focus:haste', raw: 'Casting Haste 20%' }],
};
const effectsOnly = LC.diff.compareCandidateMulti([
  { id: 'effects', name: 'Effects', cls: 'WAR', items: [{ name: 'Old Helm', slot: 'Head', stats: {}, effects: [] }] },
], effectCandidate, hp);
assert.equal(effectsOnly.best, null);
assert.equal(effectsOnly.results[0].summary.hasEffects, true);

assert.equal(LC.diff.wishlistComparisonDirection(
  { stats: { HP: stat(150) } },
  [{ stats: { HP: stat(100) } }, { stats: {} }], hp,
), 0);

// Net positive requires its entire fixed domain, not just whichever fields arrived.
const netpos = LC.diff.SCORE_FORMULAS.find((formula) => formula.key === 'netpos');
assert.equal(LC.diff.diffItems({ stats: { HP: 10 } }, null, netpos).numericScoreAvailable, false);
const complete = Object.fromEntries(Array.from(LC.diff.POSITIVE_STATS, (key) => [key, 0]));
assert.equal(LC.diff.diffItems({ stats: complete }, null, netpos).score, 0);

for (const bad of [null, '', false, '12oops', '0x10', { num: '', raw: '' }]) {
  assert.equal(LC.diff.numericStat(bad), null);
}
const normalizedAttack = LC.diff.diffItems({ stats: { attack: 10 } }, { stats: { ATK: 15 } },
  { terms: { ATK: 1 } });
assert.equal(normalizedAttack.score, -5);
console.log('missing-data-comparison: ok');
