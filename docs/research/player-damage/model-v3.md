# Player hybrid damage reference model — v3

This increment adds a spell contribution to the level-100 Beastlord player
damage estimate. Beastlords are hybrid: the estimate retains melee, supported
weapon procs, and spell damage together. Pet damage, DoTs, other classes, and
retail combat-log measurement remain outside this model.

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
candidate gear. Nak's Maelstrom is excluded because its repeated-child
probabilities were not verified.

## Spell damage calculation

For each direct-damage spell:

```text
extra = min(floor(SpellDmg × 30500 / 7000), floor(baseDamage / 2))
critFactor = 1 + critChance × (critMultiplier - 1)
expectedDamage = ((baseDamage + extra) × critFactor
  + baseDamage × focusMean / 100 × (focusCritScaled ? critFactor : 1))
  × landingMultiplier
```

The flat Spell Dmg rule is the pinned emulator rule for fixed spells. Level-100
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
