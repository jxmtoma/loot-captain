# Player damage reference review

Scope: [06D](../../plans/wishlist-scoring/06d-player-damage-contributions.md).
Pet damage is excluded. The resulting melee and proc implementation is described
in [model-v2.md](model-v2.md). The hybrid Beastlord spell contribution is described
in [model-v3.md](model-v3.md); its implementation and software checks are verified.

## Pinned melee reference

Reviewed EQEmu revision `4aceae18b94ffaafc08e2b17bc41cd72c77f795d`:

- [attack.cpp](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/attack.cpp)
  — `offense`, `RollD20`, `CheckDoubleAttack`, `TryCriticalHit`.
- [bonuses.cpp](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/bonuses.cpp)
  — critical-chance and double-attack bonus collection.

These are emulator rules, not verified retail-server coefficients. Important findings:

| Mechanic | Reference behavior | Consequence for the next increment |
| --- | --- | --- |
| ATK/STR | Offense affects a random damage distribution against target mitigation. | A fixed DPS-per-ATK weight would be unjustified. Add target/offense inputs before using this relationship. |
| Cleave | Critical-chance bonus scales the DEX-derived critical term. | A displayed 40% modifier is not +40 percentage points of crit chance. |
| Ferocity | Double attack follows different formulas depending on whether the character has the skill or only a granted chance. | Establish the Beastlord skill/AA branch; do not assume a universal multiplier. |
| Worn stacking | The ordinary effect collector selects the strongest applicable positive bonus; additive worn behavior is a separate configurable rule. | Resolve active bonuses across the whole loadout instead of adding item ranks together. |

The [official class guide](https://www.everquest.com/news/imported-eq-enus-51126)
supports the qualitative roles of Cleave and Ferocity, but does not establish modern
rank coefficients or the player's baseline probabilities.

## Integration decisions

1. Keep attack count and critical damage separate. The existing scenario's
   `attacksPerRound` and `damageMultiplier` may already include those contributions;
   multiplying by another complete bonus would double count them.
2. Evaluate strongest applicable effects before and after replacement. A weaker
   duplicate can be covered by an effect elsewhere in the loadout.
3. Resolve exact rank/skill applicability. A spell whose name contains “Ferocity”
   is not automatically the worn Ferocity effect.
4. Preserve unknown effect lists and unsupported fields as unresolved. Do not
   assume that unparsed effects are absent.
5. Version any changed scenario semantics. Existing saved assumptions must retain
   their meaning rather than silently becoming pre-crit or pre-double-attack values.

## Arithmetic checks

Run `python3 docs/research/player-damage/check_reference_vectors.py`.
The synthetic vectors exercise both double-attack branches, critical-chance modifier
arithmetic, highest-only stacking and unknown inputs. They are research checks, not
measured damage, full combat simulation or evidence that every reference rule applies
to the user's server. No fixtures are written to character storage.

## Subsequent source work

Weapon procs: [Rain of Fear Tier 4](https://www.raidloot.com/raid/rof4) identifies
Tolvak's Force of Corruption VI; the [Plane of War list](https://www.raidloot.com/raid/powar)
includes Strike of Flames VI. Resolve exact spell IDs and effect data before adding a
catalog. Proc frequency remains a separate input; damage text alone does not establish it.

Spell damage: the [Beastlord spell list](https://www.raidloot.com/spells/beastlord)
provides the fixed Poantaar's Bite and Kromrif Lance direct-damage rotation used by
v3. Nak's Maelstrom remains excluded because its repeat selection is unresolved.
The supported focus catalog covers exact resist families and DD-relevant limits;
unsupported or incomplete focus lists use the explicitly unfocused Spell stats DPS
partial fallback. Do not apply a corruption focus to poison, disease or cold strikes.

No controlled combat sample was collected in this review. The v2/v3 models use
explicit baseline semantics and separately labeled partial results; they do not
claim a complete retail combat simulation or retail-server equivalence.
