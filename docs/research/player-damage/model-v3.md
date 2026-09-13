# Player hybrid damage reference model — v3

This increment adds a spell contribution to the level-100 Beastlord player
damage estimate. Beastlords are hybrid: the estimate retains melee, supported
weapon procs, and spell damage together. Bounded class-specific Wizard,
Magician, Enchanter and Necromancer spell-only references are also supported as
described below. Pet damage, unsupported class mechanics and retail combat-log
measurement remain outside this model.

The model is emulator-derived and versioned. It is a reference estimate, not a
claim about every live server or a replacement for measured combat data. Current
RaidLoot data can belong to a different rules era.

## Fixed Beastlord spell rotation

The default v3 rotation uses one cast of each ordinary direct-damage spell per
32-second cycle:

| Spell | Rank IDs | Level | Damage | Resist | Cast | Recast | Mana |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| Poantaar's Bite | 36379 / 36380 / 36381 | 98 | 8391 / 8811 / 9252 | Poison | 0.5s | 30s | 1648 / 1714 / 1783 |
| Kromrif Lance | 36401 / 36402 / 36403 | 99 | 6757 / 7095 / 7450 | Cold | 0.5s | 30s | 1164 / 1211 / 1260 |

The cycle and one-cast-per-spell policy are explicit reference assumptions. The
same spells, ranks, target, landing outcome, and cycle apply to current and
candidate gear. Nak's Maelstrom (36474–36476) remains excluded: the
[public spell list](https://www.raidloot.com/spells/beastlord) documents 33/33/34
child-repeat probabilities, but a shared 12-second scheduling/global recast
policy is not established by that evidence.

## Spell damage calculation

For each direct-damage spell:

```text
totalMs = 1000 × (castSeconds + max(recastSeconds, recoverySeconds or 0))
factor = totalMs <= 2500 ? 0.25
  : totalMs < 7000 ? 0.167 × floor((totalMs - 1000) / 1000)
  : totalMs / 7000
extra = min(floor(SpellDmg × factor), floor(baseDamage / 2))
critFactor = 1 + critChance × (critMultiplier - 1)
expectedDamage = ((baseDamage + extra + type3Flat) × critFactor
  + baseDamage × focusMean / 100 × (focusCritScaled ? critFactor : 1))
  × landingMultiplier
```

The flat Spell Dmg rule is the pinned emulator timing rule, not retail calibration.
Beastlord's 0.5s cast + 30s recast retains the existing 30500/7000 arithmetic. Level-100
Beastlords qualify under the selected reference rules. The v3 default uses
`critChance = 0`, `critMultiplier = 2`, and `landingMultiplier = 1`; these are
editable reference assumptions rather than a complete critical or resistance
engine. The flat coefficient and cap intentionally use the documented floors;
focus means and expected critical factors are reference arithmetic and do not
reproduce every in-game per-hit integer-rounding step.

Focus is resolved independently for each loadout. The strongest eligible focus
for the spell's resist type is used; tied maxima with different lower bounds are
ambiguous without actual equipment ordering and suppress the spell component.
Focus timing is record-specific. Cold Damage 35–100 L100 uses SPA 302 with an
8–22 DD range, applied **before** crit, so `focusCritScaled = 1`; its SPA 124
35–100 packet is DoT-only with a minimum duration of 12 seconds and is excluded.
Poison Damage 35–100 L100 uses SPA 124 for the ordinary direct-damage spell,
applied **after** DD crit, so `focusCritScaled = 0`; it has no minimum-duration
restriction in the verified record. Each focus range uses the mean of its chosen
uniform integer range. Do not generalize Cold limits to Poison.
Focus records must prove the spell type and level limits. A focus list that is
unknown or incomplete does not silently become zero focus. Proc applicability is
not assumed from an ordinary spell focus record.

`type3Flat` is the strongest applicable exact SPA 303 bonus, selected separately
from percentage focus and applied before crit. [Type3 FC Kromrif Lance
(36812)](https://www.raidloot.com/spells?name=36812) adds 532 for SPA 385 group
2512, restricted to 36401–36403; [Type3 FC Poantaar's Bite
(36809)](https://www.raidloot.com/spells?name=36809) adds 661 for group 2517,
restricted to 36379–36381. Duplicate copies do not stack. Recognized records
outside the eligible spell IDs contribute no bonus without becoming unresolved;
unknown/conflicting records still block full Spell DPS. Spell stats DPS excludes
both kinds of focus.

## Mana and melee uptime

With a shared reference mana budget of 100 mana per second:

```text
uptime = min(1, manaBudget / (sumSpellMana / cycleSeconds))
meleeAvailability = 1 - uptime ×
  (sumCastSeconds / cycleSeconds) × (1 - meleeDuringCast)
```

The v3 defaults are `cycleSeconds = 32`, `manaBudget = 100`, and
`meleeDuringCast = 0`. Spell damage is multiplied by `uptime`; melee damage is
multiplied by `meleeAvailability`. The proc component keeps its existing
realized PPM assumption and is not scaled a second time by spell uptime.

## Outputs and availability

The player estimate sums exactly one best available melee component, available
supported weapon procs, and exactly one spell output. When focus coverage is
complete, that output is full Spell DPS. When focus coverage is incomplete, the
model may emit the partial **Spell stats DPS** fallback: both loadouts use the
same explicitly unfocused rotation, so flat Spell Dmg can still be compared
without pretending unknown focus is zero. The subtotal selects one of those
spell outputs, never both. Unknown flat Spell Dmg, unresolved spell records, and
ambiguous focus ties suppress the affected output rather than inventing a number.

Spell-focus confirmation is comparison-specific and bound to the current and
candidate loadout. It is independent of proc confirmation and is never saved as
a blanket scenario assumption. Existing v1 and v2 saved scenarios retain their
prior behavior; v3 is an explicit upgrade/default for new spell-aware estimates.

## Sources and limits

### Class-specific caster increments

Level-100 Wizard/WIZ, Magician/MAG, Enchanter/ENC and Necromancer/NEC profiles
select their own spell model when no scenario is saved. Each defaults to rank 1,
landing 1, crit chance 0, crit multiplier 2 and mana budget 1000/second; no melee
layout is needed or used. These are declared reference scenarios, not optimal
rotations. Their minimum cycles are 9 seconds for Wizard, 12.5 for Magician,
13 for Enchanter and 30 for Necromancer.

[RaidLoot's Wizard list](https://www.raidloot.com/spells/wizard) supplies:

| Rank | ID | Level | Base damage | Mana | Cast | Recast | Resist |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I | 35821 | 99 | 23156 | 3740 | 3.75s | 5.25s | Cold -50 |
| II | 35822 | 99 | 24314 | 3890 | 3.75s | 5.25s | Cold -50 |
| III | 35823 | 99 | 25894 | 4046 | 3.75s | 5.25s | Cold -50 |

The other class-specific records are [Spear of Blistersteel on the Mage list](https://www.raidloot.com/spells/mage),
[Mindcleave on the Enchanter list](https://www.raidloot.com/spells/enchanter), and
[Pyre of Marnek on the Necromancer list](https://www.raidloot.com/spells/necro).

All four caster models use the same focus/Spell Dmg pipeline and select exactly
one of Spell DPS or unfocused Spell stats DPS for the compact subtotal. Unknown/
conflicting focus remains unresolved; known ineligible focus remains irrelevant.
Melee, weapon procs and pets are excluded. Wizard excludes Weave/children,
innate crits, twincast and burns; Magician excludes summoned-pet and conditional
damage; Enchanter excludes Mind Squall, mana-return, auras and support effects;
Necromancer is limited to the single Pyre of Marnek DoT and excludes other DoTs,
clipping/overlap and DoT Spell Dmg scaling. With the default cycles, +70 Spell
Dmg adds 7.5 Wizard DPS and 10 direct Magician/Enchanter DPS; it does not change
the bounded Necromancer DoT model.

The shared per-profile scenario remains v3 with its existing revision semantics.
Missing `spells.model` in saved v3 data means `beastlord`; v1/v2 upgrades also
retain Beastlord assumptions. A model/class mismatch is unavailable rather than
silently applying another class's rotation. Manual DPS stays Beastlord-only.

- [RaidLoot Beastlord spell list](https://www.raidloot.com/spells/beastlord)
- [RaidLoot Rain of Fear armor and focus records](https://www.raidloot.com/raid/rofarmor)
- [RaidLoot Cold Damage 35–100 L100 record](https://www.raidloot.com/spells?name=33141)
- [RaidLoot Poison Damage 35–100 L100 record](https://www.raidloot.com/spells?name=33145)
- [EQEmu flat Spell Dmg rule](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/effects.cpp#L365)
- [EQEmu spell-damage rule flags](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/common/ruletypes.h#L492)
- [EQEmu strongest focus selection](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/spell_effects.cpp#L6515)

The fixed spell values and flat Spell Dmg calculation are emulator/reference
inputs. They do not establish retail-server behavior, complete resistance
mitigation, spell critical rules, cast weaving, or every Beastlord ability.
