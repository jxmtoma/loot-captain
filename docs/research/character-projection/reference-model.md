# Level-100 Beastlord reference estimates — v2

Implemented 2026-09-09 as `bst100-reference` v2. The user explicitly chose consistent gear
estimates without mandatory calibration. This supersedes the original research gate for
this reference mode only. These are estimated changes, not verified live-server totals or
a guarantee that every upgrade has the same effect in game. Calibrated Accuracy remains optional.

## Reference configuration

The same formula and conditions apply before and after a selected worn-item replacement.
The implementation uses the SoD-style pool branch in the pinned
[EQEmu pool/cap reference](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client_mods.cpp).
Choosing that branch is a model assumption (the emulator rule defaults to disabled).
The [published client data](https://github.com/GiverofMemory/NostalgiaEQ-Client/blob/71b420046d0ceca1c11d3d40f875112673178a2a/BaseData.txt)
provides level-100 class-15 factors of 8.5 for HP and 9.09 for mana/endurance. Class 15 is
Beastlord. Field order was checked against the pinned EQEmu BaseData repository/exporter.
This client data is a reference configuration, not evidence of Oakwynd's current formula.

Ordinary attributes include their heroic counterparts; heroics also raise their caps.
The reference cap before heroics is 455 plus Planar Power's grant. Saved current sheet caps
override this derived cap, preventing a second AA addition. Missing AA inputs use labeled
Rain of Fear maxima: Planar Power 55 (+275), Natural Durability 10 (18%), Enhanced Aggression
36 (+360 worn ATK cap). Saved ranks, including zero, override defaults. Unknown ranks use
defaults; unsupported ranks make dependent outputs unavailable. Assumptions do not become
saved ownership records. Definitions come from the [full Beastlord AA catalog](https://www.raidloot.com/aa?class=Beastlord&exp=).

## Calculations

All expressions below describe reference contributions; compare their before/after values.
Rounding is approximate, not an exact replication of the game engine.

- AC: before-softcap reference change in `floor(total item AC × 4/3)` plus
  the change in `floor(AGI/20)` when AGI exceeds 70. HAGI changes effective AGI/cap.
  Level-100 Beastlord class AC is already capped and unchanged race/defense terms cancel.
  This uses the pinned [ACSum reference](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/attack.cpp).
  Softcap returns, shield exceptions and avoidance are excluded. Always show change-only;
  a generic sheet AC reading is not a compatible baseline for this quantity.
- HP: transform STA above 255 to `255 + floor((STA−255)/2)`, multiply by 8.5.
  Add direct item HP and 10 per HSTA. Apply Natural Durability to the combined change.
  Its ranks 0–10 use percentages 0, 2, 5, 10, 12, 13, 14, 15, 16, 17, 18.
- Mana: Beastlord uses WIS/HWIS. Above 200, effective WIS is `WIS−floor((WIS−200)/2)`;
  above 100, add `floor((3×effective−300)/2)` to effective WIS. Multiply by 9.09,
  then add direct item mana and 10 per HWIS. INT/HINT does not contribute.
- Displayed ATK: 1.342 times the capped worn-ATK change, plus 0.9 times the effective STR
  change. Worn cap is 250 plus Enhanced Aggression's grant (10 per rank). HSTR affects STR
  and its cap; no extra HSTR-to-ATK term is added. This rating is not DPS.
- Endurance: average STR/STA/DEX/AGI. Transform averages above 201 to
  `352.5 + 1.25×(average−201)`, otherwise above 100 to `100 + 2.5×(average−100)`.
  Floor the transformed average and multiply by 9.09. Add direct item endurance and
  2.5 per HSTR/HSTA/HDEX/HAGI.

Heroic contributions follow the stock multipliers in the pinned
[bonus reference](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/bonuses.cpp).
ATK follows the pinned [displayed-rating reference](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client.cpp).
Unchanged class/race/skill and flat AA terms cancel in differences. Other percentage HP
modifiers and cap grants are omitted; v1 does not interpret arbitrary AA effect text.

## Missing data and limits

Without a usable snapshot, ordinary attributes are assumed capped. Positive ordinary stats
then give no benefit; losses can produce ranges because hidden over-cap headroom is unknown.
Ranges describe that ambiguity, not statistical confidence. Heroic changes adjust both value
and cap. A bound, unbuffed, gear-confirmed snapshot can supply values/caps and anchor pool
totals. Stale or unconfirmed snapshots fall back to reference baselines. Unknown heroic
inclusion is disclosed as assumed included; explicitly excluded heroics are added once.

Omitted RaidLoot/legacy fields count as zero only in reference estimates. Explicit unreadable
fields and partial OpenDKP omissions remain unknown. Both replacement items must have
resolved stats. Other classes/levels and empty-slot replacements are unsupported.

Augments, worn effects, buffs, power sources and weapon skills are held unchanged; transfer
and stacking behavior is not simulated. Post-softcap mitigation, avoidance, damage and DPS are
outside this model. Estimates do not change ranking scores or exact item-delta semantics.

## Verification

`tests/reference-stats.js` covers pool/ATK contributions, zero/default/unsupported AA ranks,
stat caps and loss ranges, WIS versus INT, stale/current snapshots, missing imports, scope,
no mutation and runtime message validation. Synthetic software checks are not measured
samples and must never be added to `measuredSamples` in the evidence register.

Version 2 adds AC. Summary, results and calculation details use AC → HP → MANA → END → ATK.
