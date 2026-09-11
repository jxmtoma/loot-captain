# Player damage catalog

This catalog resolves only exact, source-backed effect identities. It does not
infer a spell from a name fragment, a numeric suffix, or a generic “decrease HP”
line. Unknown effects remain unavailable.

## Worn effects

RaidLoot's Ferocity records are spell IDs 3886, 3887, 3888, 6323, 6324, 7835,
9615, and 15841 for Ferocity I–VIII. Their double-attack bonuses are 3, 6, 9,
12, 15, 18, 18, and 18 percent. The VIII record is distinct from the earlier
rank and is accepted by ID or exact full name.

RaidLoot's Cleave records are spell IDs 3883, 3884, 3885, 6321, 6322, 7834,
9614, and 15840 for Cleave I–VIII. Their critical-hit bonuses are 40, 80, 120,
160, 200, 240, 280, and 320 percent. Cleave IX is accepted for the verified
record 20516 (360 percent), and the separate “Cleave IX - N” records are
accepted only for the exact full names and IDs in the catalog because those
records add a separate hit-damage bonus.

The resolver requires `effect.type === "worn"`. This prevents similarly named
spells such as the Beastlord buff Merciless Ferocity from being treated as a
worn item effect. The parser now leaves bare Roman suffixes such as `VI` and
`VIII` alone; the catalog retains a narrow compatibility path for old saved
effects carrying the former `I`/`III` parser artifacts, but only when the full
raw packet name exactly matches the catalog record.

## Direct weapon procs

RaidLoot identifies Force of Corruption VI as spell 23815, corruption resist
-25, and 460 direct damage. Strike of Flames VI is spell 23735, fire resist
-190, and 510 direct damage. Strike of Venom V is spell 23774, poison resist
-180, and 420 direct damage. These records return a neutral rate multiplier of
1; proc frequency remains a separate combat assumption. DoTs, conditional
damage, recourses, and conflicting damage packets resolve as unavailable.

The item pages provide the weapon context: [Tolvak, the Dirk of Madness](https://www.raidloot.com/raid/rof4)
shows Force of Corruption VI, and [the Plane of War list](https://www.raidloot.com/raid/powar)
shows later Strike of Flames ranks. The spell records are the identity and
damage authority: [Force VI](https://www.raidloot.com/spells?name=23815),
[Strike VI](https://www.raidloot.com/spells?name=23735),
[Strike of Venom V](https://www.raidloot.com/spells?name=23774),
[Ferocity](https://www.raidloot.com/spells?name=Ferocity), and
[Cleave](https://www.raidloot.com/spells?name=Cleave).

The live Rain of Fear Tier 3 item [Thox Tatrua, Ulak of the Quick Death](https://www.raidloot.com/raid/rof3)
shows Strike of Venom V as a direct 420-damage proc. A single-line saved
RaidLoot effect carrying the old parser's `VI → I` rank artifact is accepted
only for an exact catalog name/raw line and, when present, its canonical old
normalized key; other explicit rank conflicts remain unavailable.

These are catalog facts, not a claim that every proc lands or that item proc
rates are equivalent. The model must supply trigger rate, hit/resist policy,
and hand treatment explicitly.

## Beastlord spell rotation and focus

The exact level-100 Beastlord direct-damage rotation records are exposed by
`spellRotation(1..3)`: Poantaar's Bite ranks I–III (spells 36379–36381) and
Kromrif Lance ranks I–III (spells 36401–36403). Each record preserves the
RaidLoot level, mana, 0.5-second cast, 30-second recast, base damage, and
Poison/Cold resist from the [Beastlord spell list](https://www.raidloot.com/spells/beastlord).
Invalid rotation ranks return an empty array.

`resolveFocus` accepts exact focus identities and returns the direct-damage
component. The supported Cold Damage L100 records are 33139, 33140, 33141,
33142, 37939, and 37940; their direct-damage ranges are 8–15, 9–15, 8–22,
9–22, 10–15, and 10–22 percent. These Cold records are `critScaled: true`
because their DD component is SPA 302, before DD crit. The SPA 124 35–100
range on Cold Damage 35–100 (33141) is the DoT-side range; it is not returned
as the direct-damage range.

Poison Damage L100 records 33145, 33143, 33146, 33144, 37942, and 37941 are
supported with their exact SPA 124 ranges: 35–100, 35–70, 40–100, 40–70,
45–100, and 45–70 percent. These records have no separate SPA 302 packet and
their SPA 124 component applies after DD crit (`critScaled: false`); the catalog
preserves that exact direct spell-damage focus packet rather than borrowing the
Cold SPA 302 interpretation. Changed limits, wrong identities, and family-only
normalized keys remain unavailable.

The focus and spell records were checked against RaidLoot's current public
spell pages on September 10, 2026. They describe current source data, not
retail combat coefficients; emulator references remain implementation context
only.
