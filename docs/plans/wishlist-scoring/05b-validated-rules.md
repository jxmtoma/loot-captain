# 05B — Versioned rules and AA selection

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Implemented reference estimates — 2026-09-09; optional calibrated Accuracy retained.

## Default reference estimates

`bst100-reference` v2 estimates before-softcap AC, HP, mana, endurance and displayed ATK for level-100 Beastlords
without a snapshot or calibration. It includes base/heroic contributions, three AA defaults,
saved rank overrides, and cap-dependent ranges. See the [model contract](../../research/character-projection/reference-model.md)
for formulas, pinned sources, assumptions and exclusions. This follows the user’s explicit
choice of consistent estimates; it does not claim live-game validation.

## Scope shipped

The first registered rule is `bst-accuracy` version 1, for a level-100 Beastlord. It uses the
[developer's published post-400 rule](https://forums.everquest.com/index.php?threads/heroic-stats-mod2-calculated-incorrectly.266158/post-4048883):

`Accuracy = 151 + floor((Heroic DEX − 400) × 149 / 3600)`

The implementation rejects inputs outside 400–4000 and non-integer heroic totals. This is an
Accuracy modifier in points, not a hit-rate percentage, critical chance, DPS, or HP-equivalent
score. The reference vector `hDex 2000 → Accuracy 217` is tested; it is not an in-game sample.

For the optional calibrated Accuracy mode, a source formula alone does not enable projection. The user records a reversible A→B→A swap
with numeric Heroic DEX and Accuracy values, unchanged conditions, item changes, observer,
and capture references. All three states must match the rule, the starting values must match
the saved snapshot, restoration must match A, and the swap must cross an Accuracy breakpoint.
Incomplete or inconsistent observations cannot validate a rule.

The **Projection rule validation** section in Manage Characters explains failed checks. When
checks pass, the user explicitly reviews and approves the observation. This is user-approved
calibration, not independent certification and not a validation of every character statistic.
`reviewStatus` stays pending for general research; `ruleApprovals` records the particular rule.

## Validity boundaries

Approvals bind the exact rule version and observation contents to class, level, server,
expansion, patch, recorded AA definitions/ranks, and conditions. The usable Heroic DEX range
is restricted further to the interval actually covered by the observation. There is no
extrapolation to the entire source domain based on one swap. Deleting the observation removes
its approvals. Changing relevant context prevents reuse; stale snapshots require recapture.

The approval action uses the existing revision/binding-protected character-data mutation.
Page content cannot approve a rule, ordinary profile saves cannot replace approvals, and a
failed write leaves the saved state unchanged. No test fixtures are added to user profiles.

## AA workflow: no typing names one at a time

The normal AA workflow is now compact:

1. Expand **AA & character stats** only when needed. Choose the active expansion and load
   the checklist. Class and level come from the saved profile.
2. New catalog entries start at the maximum eligible rank, explicitly marked `assumed`.
   Existing saved ranks, zeros, unknowns and exceptions are preserved. No ownership is inferred.
3. Search an AA name to edit it. No rows are shown for an empty search; up to eight matching
   records appear in a fixed-height scroll area. Definitions stay collapsed.
4. **Confirm current ranks** confirms the current selections without resetting exceptions.
   **Reset to max defaults** explicitly replaces loaded entries with assumed maxima.
   **Save AA ranks** persists the draft. Assumed values cannot validate a projection rule.
5. Snapshot, swap-observation and rule-review forms remain collapsed until requested.

RaidLoot's level filter collapses ranks and its expansion filter omits older abilities.
The loader therefore fetches one complete class catalog and locally selects ranks at or below
both the saved level and chosen expansion. It checks class masks and retains passive stat
abilities. It does not treat activation IDs as ability/rank IDs. Loading a checklist does not
change saved ownership until the user saves.

Real-source browser verification found 43 entries for Beastlord/100/Rain of Fear, including
Natural Durability and Planar Power rank 55. The list is a filtered stat-AA catalog, not an
exhaustive record of the character's purchased abilities. Loading another filter preserves
existing inputs and does not apply old-filter maxima to the new selection.

No verified native owned-AA export was established. The [eqaainfo project](https://github.com/kauffman12/eqaainfo)
uses network captures to build definitions; that is not a native owned-rank export and is not
integrated here. No packet capture, account sync, or new host permission was added.

## Still unimplemented

Complete AA multiplier/cap modeling, post-softcap AC mitigation, other heroic modifiers and other classes/levels remain
outside v2. Reference estimates use explicit defaults; calibrated Accuracy retains its
observation and ownership requirements.

## Files and checks

- `content/shared/projection.js`: reference rule, observation checks, context/range gates.
- Character data/editor: Accuracy reading, approval UI and persistence.
- RaidLoot parser/offscreen/worker: full-class AA catalog and local eligibility filtering.
- `tests/projection.js`: reference vectors, positive/negative changes, approval requirements,
  missing/stale/out-of-range data, sender/target validation, and catalog filtering.
- Full `node tests/regression.js` plus isolated Chrome verification using synthetic characters
  and a real downloaded RaidLoot catalog. These are software tests, not live-game calibration.

05C defaults to reference estimates and offers calibrated Accuracy as a separate model.
`tests/reference-stats.js` covers the reference calculations and runtime boundary.

## AC update

Reference v2 adds before-softcap AC (item AC and AGI/HAGI), with results ordered
AC → HP → MANA → END → ATK. Softcap mitigation/shield exceptions remain outside the model;
AC is never anchored to a generic sheet total. See the reference model for details.
