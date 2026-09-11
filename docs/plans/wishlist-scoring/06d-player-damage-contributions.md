# 06D — Player damage across gear sets

Scope: level-100 Beastlord melee stats/effects, weapon procs and spell damage.
Pet damage is explicitly excluded. Keep the compact Stats / DPS display and
independent metric text colors on a neutral background.

Status: melee stats/effects and supported weapon procs are implemented in the
[v2 reference model](../../research/player-damage/model-v2.md). Spell damage is
specified in the [v3 reference model](../../research/player-damage/model-v3.md).
Complete and partial contributions are reported separately;
saved v1 scenarios require an explicit upgrade.

## Shared comparison policy

The current and proposed gear sets must use the same target, fight duration, buffs,
AAs and combat policy. Resolve gear-derived stats and effects separately for each
set. Shared assumptions must not freeze the item effects being compared.

Use a versioned reference model and keep its sources, applicability and limitations
visible in details. Do not label a partial model as total character DPS. Unknown
required inputs suppress only the affected component and any dependent subtotal.
Never turn omitted effects or an unsupported conversion into zero.

## 1. Melee stats and worn effects

Start with the smallest sourced contribution that supports a nonweapon replacement.
Evaluate the whole equipped set before and after that one replacement, preserving
unchanged weapon slots and augments unless augment transfer is explicitly modeled.

Research and define:

- ATK/offense and target mitigation interaction; do not invent a fixed DPS-per-ATK rate.
- STR/DEX and heroic-stat effects, separating displayed ratings from damage behavior.
- Ferocity and Cleave definitions, rank/level applicability, stacking and caps.
- AA/buff interactions and hand applicability, avoiding double counting bonuses
  already included in the reference scenario's attacks/round and damage coefficient.

Acceptance: an armor replacement with a supported changed effect produces a
recomputable melee contribution; covered/weaker duplicate effects do not stack
incorrectly; unchanged gear yields zero; unknown active effects remain unresolved.

## 2. Supported weapon procs

Resolve exact effects before assigning damage. Start with direct-damage weapon procs;
keep DoTs, heal/hate-only effects, buff procs and augment procs out until supported.
Define trigger frequency, per-hand treatment, proc modifiers, hit/resist/crit assumptions
and effect-list completeness. No proc-name substring may manufacture a spell value.

Acceptance: exact sourced spell identity and expected rate produce damage/time;
unknown rate or effect data remains unavailable; neither haste nor hit chance is
applied twice; proc damage is not also counted in the spell-rotation component.

## 3. Spell damage and focus

Use the fixed v3 level-100 Beastlord rotation: one Poantaar's Bite and one Kromrif
Lance per 32-second cycle. Resolve spell IDs/ranks, base damage, cast/recast timing
and eligibility from sources. Use the same rotation and target assumptions for both
sets, then apply each set's eligible focus separately. Nak's Maelstrom stays out
until its repeated-child probabilities are sourced.

Use the emulator-derived flat Spell Dmg rule and explicit focus stacking, level
decay, mana/casting uptime, crit/landing assumptions documented in model v3. A
"Spell stats DPS" partial fallback uses the same rotation with both loadouts
explicitly unfocused, so flat Spell Dmg can be compared without pretending that
unknown focus is zero. Focus damage is a modifier of the spell component, not an
additional duplicate damage contribution. DoTs remain excluded.

Acceptance: a supported focus swap changes expected spell damage under the same
rotation; nonqualifying or covered focus does not; missing spell/focus rules yield
an unavailable full spell component or the explicitly unfocused partial fallback;
a Beastlord result retains melee plus spell contributions because the class is hybrid.

## Delivery order and evidence

Deliver these in the order above, with independent regression coverage and a source
review for each numerical rule. Existing illustrative defaults are not evidence that
a new mechanic is correct. Emulator references must be labeled as such and pinned
before adopting their rules; they do not establish retail-server behavior.

Controlled combat samples remain desirable validation, not invented test fixtures.
Tests and any synthetic worked examples stay outside real character storage.
