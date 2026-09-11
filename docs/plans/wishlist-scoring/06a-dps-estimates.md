# 06A — DPS estimates in small increments

Decision: implement an explicit-assumption calculator for level-100 Beastlords first.
This is a DPS estimate, not a combat meter or a validated live-game simulation.
The initial increment compares the selected weapon hand. It does not report a whole
character total or predict the consequences of changing weapon layouts.
The follow-on [06B](06b-equipped-weapon-dps.md) adds an optional equipped-weapon
subtotal with explicit assumptions for the unchanged hand; automatic hand rules
remain outside the validated scope.

Open a worn-weapon comparison, expand the estimate panel, choose **DPS estimate
(melee and procs)**, enter the shared assumptions and select **Calculate**. Changing
an input clears the old result. The normal stat reference model remains the default.

## Shared comparison contract

Both gear sets use one scenario: same class/level, hand/layout, target, buffs, AAs,
uptime, combat policy and expected damage assumptions. Only the selected item changes.
No independently tuned assumptions may favor one set. Missing inputs remain unavailable;
an explicit zero is valid where appropriate. Inputs are local to the comparison and do
not write snapshots, AA records, profiles or scores. Calibration is optional.

The user supplies effective combat inputs; the app does not derive them from displayed
ATK, heroic stats, item Haste or effect names. This also means changes to those modifiers
are outside the first increment. Same-layout comparisons are required. Augment damage,
augment procs, kicks, disciplines, buff procs and the other hand are excluded.

## Contribution definitions

| Contribution | Calculation and required inputs | Increment |
| --- | --- | --- |
| Melee | Expected attack attempts per second × hit probability × mean damage per landed strike. Weapon Damage and Delay plus shared effective haste, attacks per round, damage coefficient, mitigation fraction and flat damage bonus. | Implement selected hand first; add both hands and layout transitions after hand-specific rules and samples. |
| Weapon procs | Sum of expected triggers per minute × expected damage per trigger / 60. An exact effect key must have explicit rate and damage assumptions shared wherever that effect occurs. | First increment; no parsing damage text into a claimed live proc model. |
| Spell focus / rotation | Sum over a fixed rotation of casts per second × expected damage per cast. Evaluate eligible focus on each spell separately in each set under identical casting policy, target resists, crit policy, mana budget and fight duration. Focus contribution is the difference from that same rotation without focus, not an additional copy of spell damage. | Later: require spell IDs/ranks, base damage, cast/recast timing, focus applicability/stacking, partial resists, crits, DoT duration and uptime. |

Pet damage is outside the planned scope. Continue with the three player-damage
contributions in [06D](06d-player-damage-contributions.md).

Never label a sum of the first two rows as total character DPS. A future total requires
all included components to be known, with explicit inclusion rules preventing pet and
spell-triggered damage from also being counted as player weapon procs.

## First-increment arithmetic (model v1)

```text
attemptsPerSecond = 10 / Delay × (1 + hastePercent / 100) × attacksPerRound
landedDamage = Damage × damageMultiplier × mitigationMultiplier + damageBonus
meleeDPS = attemptsPerSecond × hitChance × landedDamage
procDPS = sum(procsPerMinute × damagePerProc / 60)
selectedHandSubtotal = meleeDPS + procDPS
```

`damageMultiplier` is an assumed mean base-damage coefficient, including any intended
critical-hit treatment, before mitigation. `mitigationMultiplier` is the remaining
fraction, 0–1. `damageBonus` is an assumed flat post-mitigation addition per landed
strike. The order is a model definition, not a claim about the server damage pipeline.
`attacksPerRound` includes hand activation and multiattack. Do not multiply either
critical hits or double attacks a second time. Proc damage is expected damage per
trigger including misses/resists/crits; its rate is already per minute, so haste and
melee hit chance are not applied again.

All numerical fields start blank. Effective haste must already reflect stacking/caps;
timer floors, slow, skill caps and weapon-specific bonus tables are not inferred.
The same bonus assumption is useful only where it applies to both weapons. If weapon
type/delay changes the real bonus or skill behavior, this scenario is not a prediction
of that change. No automatic naked-hand or two-handed identification is attempted.

RaidLoot imports do not certify a complete effect list. Proc totals therefore require
either complete source data or an explicit, unchecked-by-default confirmation that
the listed weapon procs are complete for both items. This confirmation belongs only to
the scenario; it never changes stored provenance. Unresolved effect types still block
the proc result, and blank rate/damage inputs never become zero.

### Synthetic recomputation (not a measurement)

Primary hand, dual wield; haste 100%, hit chance 0.8, attacks/round 1,
damage coefficient 2, mitigation fraction 0.5, flat bonus 10:

| Item | Damage / Delay | Melee DPS | Proc DPS | Selected-hand subtotal |
| --- | --- | --- | --- | --- |
| Current | 100 / 20 | 88 | 10 (2 PPM × 300 / 60) | 98 |
| Candidate | 120 / 30 | 69.333… | 20 (2 PPM × 600 / 60) | 89.333… |

Delta: −8.666… DPS for the selected hand. More weapon damage alone does not make the
candidate better. The two different proc keys have explicit expected damage values;
the exact same key must resolve to the same assumption in both sets. Missing either
proc assumption suppresses proc delta and subtotal, while melee remains visible.

## Evidence and limits

Reviewed 2026-09-09. [EQEmu attack.cpp](https://github.com/EQEmu/EQEmu/blob/master/zone/attack.cpp)
is an emulator reference, not live-server verification. Its timer converts item delay
to milliseconds using a factor of 100: one item-delay unit is 0.1 second. It also
models hand/level-dependent bonuses, target-dependent mitigation and additional proc
rules. Those complexities motivate explicit inputs rather than copied game formulas.
This source uses a moving branch; no claim of a pinned, validated combat implementation
is made for this calculator.

[Official July 2015 patch notes](https://www.everquest.com/news/july-patch-cliff-notes)
describe changes allowing independent proc effects on the same swing. This supports
keeping effect identity and rate separate; it does not establish a current universal
proc frequency. Era/server applicability must be checked before selecting assumptions.

No combat-log sample has been collected. The evidence gate therefore passes only for
the scenario arithmetic and its software tests; automatic live-DPS prediction remains
unsupported. Worked vectors are synthetic and must never enter real character data.

## Verification and subsequent increments

- Test identical-set zero deltas, slower weapons, both supported hands, unknown stats,
  missing/duplicate proc inputs, invalid numbers, unsupported classes/levels/layouts,
  request validation and no storage mutation.
- Preserve Damage/Delay and ranking regressions; test UI blank-input semantics.
- Next add sourced hand-specific rules and controlled samples before whole-loadout
  melee. Then supported weapon procs and spell rotation/focus. Pet damage is excluded.
- Keep components separate until all inclusion rules and unknown handling are tested.
