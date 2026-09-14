# Healer direct-heal reference v1

Ordinary WIS item penalties are valid, including the -4 WIS on Model XLII
Spatial Temporal Oculus (RaidLoot item 79790). They are summed before the
ordinary cap; the resulting ordinary WIS is bounded below by zero. Such
penalties no longer appear as missing data. Unreadable values remain unknown.

Gear healing focus remains excluded and never gates these estimates. Effect-only
RaidLoot items with imported RaidLoot stat fields contribute zero for omitted
stats. Explicit unreadable values and entirely empty imports remain unknown.
**Items blocking this estimate** now names the affected items, slots and stats,
distinguishing unreadable values from incomplete imports.

Supports level-100 Cleric/CLR, Druid/DRU and Shaman/SHM. The compact row shows
**Healing est.** as the change in effective encounter HPS. Open **Healing and
mana assumptions** for separate casting HPS, healing/mana, mana pool, mana
regeneration, long-run HPS and encounter casting uptime. All are partial
estimates; preference scores and item ordering remain separate.

## Bounded spell references

Each class repeats one selected rank (1–3) under the same scenario for both
loadouts. This is a repeatable gear comparison, not an optimal rotation.

| Class | Spell and IDs | Base heals I / II / III | Mana I / II / III | Cast / recast / recovery |
| --- | --- | --- | --- | --- |
| Cleric | [Graceful Remedy](https://www.raidloot.com/spells?name=34103), 34103–34105 | 7611 / 7992 / 8392 | 990 / 1030 / 1071 | 0.5 / 4.75 / 1.5 seconds |
| Druid | [Sterivida](https://www.raidloot.com/spells?name=34887), 34887–34889 | 9964 / 10462 / 10985 | 1045 / 1087 / 1130 | 3.75 / 1.5 / 1.5 seconds |
| Shaman | [Blezon's Mending](https://www.raidloot.com/spells?name=35412), 35412–35414 | 9991 / 10491 / 11016 | 1584 / 1647 / 1713 | 3.75 / 1.5 / 1.5 seconds |

These spells are learned at levels 96, 97 and 98 respectively. Graceful Remedy's
at/below-20%-health heals are 9514 / 9990 / 10490; the editable low-health cast
fraction weights those separately from its ordinary heal. The other classes
ignore that fraction. Facts were reviewed from RaidLoot on 2026-09-12.

## Healing arithmetic

The [pinned healing reference](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/effects.cpp)
places item Heal Amount before critical healing and uses `GetExtraSpellAmt`.
The implementation reuses `playerDamage.spellExtra`, including its native
cast/recast timing and half-base-heal cap. Native timings determine the item
bonus even when the editable repetition cycle changes. Expected healing is
`(base heal × (1 + shared bonus/100) + scaled Heal Amount) × (1 + crit chance)`.
Effective healing multiplies this by `1 − overheal fraction`.

The shared bonus defaults to 5% for Cleric, following the pinned
`ClericInnateHealFocus` reference, and zero for Druid/Shaman. Gear focus changes
are not interpreted. Crit chance and overhealing default to zero. These are
explicit assumptions, not inferred AA ownership or actual spell usage.
The minimum cycle is cast time after shared haste plus the greater of recast
or recovery; defaults are 5.25 seconds. Cast haste is capped at 100% in this
bounded scenario. It does not infer haste gear effects.

## Mana and sustain

Mana uses the existing SoD-style [pool reference](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client_mods.cpp).
The [pinned client data](https://github.com/GiverofMemory/NostalgiaEQ-Client/blob/71b420046d0ceca1c11d3d40f875112673178a2a/BaseData.txt)
gives all three level-100 classes base mana 2168.461 and WIS factor 9.15.
Effective WIS is capped ordinary WIS plus HWIS; above 200, the ordinary mana
transform halves the excess, then applies the existing above-100 transform.
Gear mana and 10 mana per HWIS are added before the shared pool multiplier.
INT does not contribute. Base WIS defaults to 100, ordinary cap to 730 and
the pool multiplier to 1.

Regeneration is shared non-gear mana/second plus capped worn ManaRegen divided
by six. Defaults of 100 mana/second and a 30/tick worn cap are illustrative
editable inputs. HWIS affects the pool only here. Mana recovery abilities,
Clairvoyance, conservation procs and gear preservation focuses are excluded;
the shared cost-reduction input can represent a chosen average saving.

- Casting HPS: effective heal divided by cycle seconds, before mana limitation.
- Healing/mana: effective heal divided by effective spell mana cost.
- Long-run HPS: casting HPS times `min(1, regeneration / mana spending rate)`.
- Encounter HPS: casting HPS times `min(1, (starting mana / duration +
  regeneration) / mana spending rate)`.

Defaults use a full starting pool and a 180-second encounter. This is a
continuous resource budget, not an exact cast timeline or a guarantee that
mana is available at each cast. Extra pool mana can improve encounter HPS
without changing casting or long-run HPS. All healing rows account for the
chosen overhealing fraction, not measured healing demand.

## Storage, missing data and limits

Defaults are not saved automatically. Saves go to `healerScenariosByProfile`
with independent per-character revision checks and a class-specific spell-model
identity. Tank and DPS scenarios remain separate. Profile deletion cleans up
only that profile's scenario. Stale equipment and stale saves are rejected.

Missing mana leaves known casting throughput visible; missing Heal Amount
leaves known mana rows visible. Omitted RaidLoot/legacy stats count as zero in
the reference only; unresolved items, explicit unknowns and partial OpenDKP
omissions remain unknown. The compact row falls back to a labeled Casting HPS
or Mana pool estimate if encounter HPS is unavailable. Augments remain equipped;
transfers and direct augment replacements are excluded.

Gear focus changes, HoTs, group heals, triggered heals, cooldown rotations,
Cannibalization, target scheduling and healing-demand prediction are excluded.

## Verification

`node tests/regression.js` includes all three classes/ranks, resource-limited
versus unconstrained throughput, overhealing, critical healing, low-health
Cleric heals, regeneration caps, unknown inputs, unchanged gear, no mutation,
and invalid scenarios. Runtime tests save/reload two synthetic profiles for
each class and verify isolation, stale-save rejection, class mismatch checks
and deletion cleanup. Editor tests cover all three classes without loading
worker calculation modules into the content-script environment.

Serve the repo with `python3 -m http.server 8765 --bind 127.0.0.1`. Open
`tests/browser/tank.html?healer=Cleric` (or `Druid` / `Shaman`) on that server.
The isolated browser fixture checks real rendering, metric colors, 360/720px
overflow, saving and compact refresh using memory only. All three healer
variants and the tank variant passed. No real profiles were imported or
changed; live imported-character validation remains pending.
