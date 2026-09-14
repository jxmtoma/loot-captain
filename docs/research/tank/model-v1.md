# Tank physical-survivability reference v1

The tank preference preset now uses `HP + 4 × AC`, without a separate heroic
stamina weight. A separate **Tank item score** row uses that same formula on
the compared items and remains available even if unrelated loadout data blocks
survival. The compact row falls back to that item score. Other explicitly
selected preference formulas are retained. Blocked estimates list each item,
slot and required stat under **Items blocking this estimate**.

Supports level-100 Warrior/WAR, Paladin/PAL and Shadowknight/SHD/SK.
The compact comparison shows a survival-time change; the expanded **Tank
survivability and assumptions** panel separates HP, mitigation AC, average
landed hit, incoming physical DPS and survival seconds. Threat is explicitly
unavailable. These outputs do not change preference scores or item ordering.

One editable scenario is applied to both loadouts. Defaults are illustrative,
never automatically saved. **Save tank assumptions** stores a revision-checked
scenario in `tankScenariosByProfile`, separately from DPS scenarios. Changing
gear identities while a comparison is open requires reopening it. Deleting a
profile also removes its tank scenario.

## Model and sources

The existing [EQEmu reference revision](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/attack.cpp)
supplies armor softcaps, overcap returns, armor arithmetic and the damage-roll
distribution. The implementation reuses `playerDamage.expectedRoll` rather than
introducing another combat-roll implementation. The SoD-style HP contribution
follows the project's [pool reference](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client_mods.cpp)
with [pinned client BaseData](https://github.com/GiverofMemory/NostalgiaEQ-Client/blob/71b420046d0ceca1c11d3d40f875112673178a2a/BaseData.txt)
class IDs 1, 3 and 5. These are reference configurations, not verified retail
server formulas.

| Class | Base HP default | Stamina factor | AC softcap | Overcap return |
| --- | ---: | ---: | ---: | ---: |
| Warrior | 3616.525 | 10 | 510 | 0.35 |
| Paladin / Shadowknight | 3467.1436 | 9.6 | 488 | 0.33 |

Effective STA and AGI equal `min(base attribute + ordinary gear, ordinary cap)
+ heroic gear`. The defaults are base attributes 100 and ordinary caps 730;
heroics raise the effective cap. HP is `(base HP + stamina contribution + gear
HP + 10 × HSTA) × HP multiplier`. The stamina contribution uses the class
factor times STA, with STA above 255 transformed to `255 + floor((STA−255)/2)`.
Other flat HP belongs in base HP, and percentage AA/buff effects belong in the
shared multiplier. No AA ownership or snapshot is inferred or changed.

Pre-softcap armor is `floor(gear AC × 4/3) + floor(defense skill/3) + extra armor
+ floor(AGI/20)`; the last term applies only above AGI 70. The cap is
`floor(class softcap × (1 + softcap bonus/100)) + shield AC`. Above-cap armor
uses the class return and is floored. Defense skill defaults to 400; extra
armor and softcap bonus default to zero. This is mitigation AC, not sheet AC.

Shield treatment requires the explicit **Assume a shield equipped in both
secondary slots** input. Missing/ambiguous secondary equipment or a secondary
weapon makes dependent armor outputs unavailable. Only base shield AC extends
the cap; augment AC still contributes to total gear AC but does not extend the
cap. Heroic-STR shield bonuses are excluded. A secondary-to-primary weapon
layout change is not simulated.

The expected roll spans 0.1–2.0; `(roll−0.1)/1.9` interpolates between the
scenario's minimum and maximum enemy hits. The shared physical damage reduction
then applies to the landed hit. Incoming DPS is `mean landed hit × attack
attempts/second × landing chance`. Survival seconds is `HP / incoming DPS`.
It excludes healing and does not predict an individual damage spike or
guaranteed time to death. Enemy defaults are offense 1000, hits 1000–10000,
one attempt/second, landing chance 0.8 and no additional damage reduction.
Landing chance, cadence and damage must be positive to keep survival finite.

## Missing data and scope

Unreadable stats, unresolved items and partial OpenDKP omissions stay unknown.
Omitted RaidLoot/legacy fields count as zero only in this reference model.
HP and armor retain independent availability; the compact metric falls back
to a labeled HP or mitigation-AC change when survival cannot be calculated.
Higher HP/armor/survival and lower incoming damage are green; unavailable is
gray. No combined tank rating or threat score is fabricated.

Augments stay in the loadout; transfers and direct augment comparisons are
excluded. Avoidance is a fixed input, so HDEX-driven avoidance changes are not
modeled. Spell damage/resists, defensive cooldowns, self-healing/lifetaps, damage
shields, threat/taunts and defensive worn-effect interpretation remain outside
v1. The HP/AC formulas are estimates and all survival results are partial.

## Verification

`node tests/regression.js` includes exact synthetic tank arithmetic, class
differences, shield behavior, stat caps, unknown inputs, no mutation, unchanged
gear, scenario validation, runtime save/reload/stale-write checks and editor
behavior without worker calculation modules in the page environment.

For a real-browser check, serve the repository with
`python3 -m http.server 8765 --bind 127.0.0.1` and open
`http://127.0.0.1:8765/tests/browser/tank.html`. It checks actual rendering,
incoming-damage colors, 360/720px container overflow, in-memory saving and
compact-result refresh. It does not access real profile storage. This fixture
passed in the in-app browser; live RaidLoot/OpenDKP profile validation and
combat calibration remain pending.
