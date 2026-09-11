# 06B — Equipped weapon DPS under shared assumptions

Status: implemented; model `bst-melee-proc-dps` v2 for equipped-weapon scope,
with selected-hand v1 retained.

This increment extends [06A](06a-dps-estimates.md) to an optional equipped-weapon
subtotal. It compares the current primary/secondary weapons with the same loadout
after replacing the selected weapon. It is still a scenario calculator, not a
whole-character DPS prediction. The selected-hand calculator remains the default.

## Decision and evidence boundary

The original next step calls for controlled combat samples before automatic hand
rules or whole-loadout simulation. No such observations are available. This increment
instead adds the arithmetic for an unchanged second weapon using explicit hand-specific
inputs. It does not infer any new live-game constants or claim that the evidence gate
for automatic combat rules has passed.

The comparison keeps the same layout, target, buffs, AAs and combat policy. Haste is
shared by both hands and both sets. Each hand has its own hit chance, mean base-damage
coefficient, mitigation fraction, flat damage bonus and expected attacks per round.
Those hand-specific inputs remain identical before and after the replacement.

Proc rates and expected damage are entered per hand and effect key. The same proc
may exist on both weapons and must not be deduplicated across hands. Each hand can
have a different expected rate; both gear sets still use the same rate for that hand.
No automatic offhand proc reduction, dual-wield probability or damage bonus is assumed.

### Source review

Reviewed 2026-09-09. [EQEmu attack.cpp](https://raw.githubusercontent.com/EQEmu/EQEmu/master/zone/attack.cpp)
contains separate primary/offhand damage-bonus paths, conditional secondary bonuses,
independent weapon timers, hand-specific extra attacks and secondary-hand proc handling.
Its bonus calculation depends on level, delay, weapon type and configurable rules.
[EQEmu mob.cpp](https://raw.githubusercontent.com/EQEmu/EQEmu/master/zone/mob.cpp)
includes Beastlord in the warrior-class predicate used by that damage-bonus path.
These are moving emulator sources, not a verified retail-server rule set.

That evidence supports separating inputs by hand; it does not establish numerical
defaults for this calculator. No emulator formula has been added to the model.
[Official 2015 proc notes](https://www.everquest.com/news/july-patch-cliff-notes)
also describe independent proc rolls, without supplying a universal current rate.
Before implementing automatic rules, pin the relevant source revision and validate
its applicability against controlled observations on the intended server/era.

## Behavior

- Choose **Both equipped weapon hands** in the DPS scope control.
- For dual wield, enter assumptions for the selected and unchanged hands separately.
  The unchanged hand's weapon and proc list are shown for review.
- For a two-handed weapon or one-hand plus shield, only the primary weapon attacks in
  this model. Shield attacks, unarmed attacks and layout transitions are not included.
- Show per-hand melee, proc and subtotal rows, followed by weapon melee, weapon proc
  and weapon subtotal rows. Label them as weapon contributions, never character DPS.
- An unknown component suppresses its aggregate but leaves other known rows visible.
  A missing other-hand input is not zero. Complete empty proc lists yield zero; an
  incomplete list requires the existing explicit scenario confirmation.
- Bind requests to both stored weapon-slot identities. Replacing/removing/adding a
  weapon while a panel is open requires reopening the comparison.
- Preserve profile storage, preference scores, Damage/Delay, reference estimates and
  the original selected-hand calculation.

## Recomputable synthetic example

Use the primary example from 06A: 100/20 → 120/30, haste 100%, hit chance 0.8,
base coefficient 2, mitigation 0.5, bonus 10, one expected attack per round. Its melee
is 88 → 69.333… and proc DPS is 10 → 20.

The unchanged secondary is 70/20. It uses the same haste, hit chance, base coefficient
and mitigation, but bonus 0 and 0.5 expected attacks per round. Its expected melee DPS
is `10/20 × 2 × 0.5 × 0.8 × (70 × 2 × 0.5) = 28`. Its complete proc list is empty.

| Contribution | Current | Candidate | Delta |
| --- | ---: | ---: | ---: |
| Primary melee | 88 | 69.333… | −18.666… |
| Primary procs | 10 | 20 | +10 |
| Secondary melee | 28 | 28 | 0 |
| Secondary procs | 0 | 0 | 0 |
| Weapon subtotal | 126 | 117.333… | −8.666… |

The unchanged secondary adds context to absolute weapon DPS without changing the
replacement delta. These numbers are test fixtures, not measured Beastlord performance.

## Verification and next step

Regression checks cover the example, secondary replacement, independent hand assumptions,
shared proc keys, missing other-hand inputs, single attacking-hand layouts, stale equipment,
scope switching, blank/zero semantics and no storage mutation.
`node tests/regression.js`, JavaScript syntax checks and the existing evidence-register
check pass. UI verification uses the synthetic DOM harness, not a live-game measurement.

Automatic hand rules remain pending controlled observations with server/era, weapon skill,
layout, haste, AAs, target and elapsed combat time recorded. Continue with melee
stats/effects, weapon procs and spell-focus/rotation under [06D](06d-player-damage-contributions.md).
Pet damage is excluded from the planned scope.
