# 06E — Berserker, Monk and Rogue melee validation

## Objective

Validate the bounded level-100 Berserker, Monk and Rogue base-melee reference
models in the unpacked Loot Captain extension. Confirm that each class gets its
own shared scenario and compact estimate while preserving unknown-data behavior.
This is software and UI validation, not a live combat-meter claim.

## Current model under test

Each class uses the existing explicit weapon/effect/proc arithmetic with a distinct
scenario identity:

| Class | Scenario | Included | Explicitly excluded |
| --- | --- | --- | --- |
| Berserker | `berserker-base-melee` | Base weapon melee and supported weapon procs | Discs, Frenzy, special attacks, AAs, pets and DoTs |
| Monk | `monk-base-melee` | Base weapon melee and supported weapon procs | Hand-to-hand/kicks, special attacks, AAs, pets and DoTs |
| Rogue | `rogue-base-melee` | Base weapon melee and supported weapon procs | Backstab, poisons, special attacks, AAs, pets and DoTs |

The model uses one scenario for current and candidate gear, keeps saved scenario
revisions explicit, and leaves unknown stats/effects unavailable. Source pages are
used for class applicability: [Berserker](https://www.raidloot.com/spells/berserker),
[Monk](https://www.raidloot.com/spells/monk), and
[Rogue](https://www.raidloot.com/spells/rogue). The numeric melee relationships
remain the pinned emulator/reference arithmetic in [model v2](../../research/player-damage/model-v2.md).

## Validation gates

### 1. Software

Run:

```text
node tests/damage-catalog.js
node tests/player-damage.js
node tests/dps.js
node tests/dps-ui.js
node tests/regression.js
python3 docs/research/player-damage/check_reference_vectors.py
python3 docs/research/character-projection/check_evidence.py
git diff --check
./tools/package-extension.sh
```

Required assertions: class-specific default models, unchanged zero delta, supported
stat/proc delta, partial output when effects are unknown, saved revision behavior,
unsupported class/model mismatch, no spell/pet/DoT double counting, and preserved
Beastlord/caster outputs.

### 2. Chrome smoke test

1. Load the unpacked extension directly from this project directory.
2. Open a RaidLoot class/raid page in the existing Chrome profile.
3. Confirm supported rows render compact Stats plus one DPS metric, with independent
   green/red/yellow metric color and no neutral-background change.
4. Open the comparison panel and confirm the class-specific base-melee assumptions,
   shared current/candidate scenario, and excluded class mechanics are visible.
5. Reload the page and confirm the estimate remains present.
6. Do not equip gear, save scenarios, alter profiles, or treat displayed values as
   combat measurements.

### 3. Full validation

Add class special attacks only after controlled logs for the intended server/era
provide ability IDs, damage, timing, target/weapon restrictions and observed use.
Run separate samples for each class with fixed level, gear, buffs, AAs, target,
weapon layout, duration and combat log capture. A source page or emulator rule alone
does not pass this gate for retail-calibrated DPS.

## Executed check

On 2026-09-10, the repository checks and package build passed. Chrome reloaded the
existing live RaidLoot project-extension page and visibly retained Ereebus's compact
Stats plus one DPS metric. Linna's row remained estimate-free; her saved class/level
was not inspected, so this is not evidence for or against a supported Linna model.
The browser policy blocked navigating to Chrome's extension-management page, so the
extension itself could not be manually reloaded from `chrome://extensions` in this
run. Consequently the Chrome result verifies the existing project-extension path,
not a fresh service-worker load of these uncommitted edits. To complete the live
class smoke test, manually reload the unpacked `/Users/tomaju/workspace/loot-captain`
extension, then open one supported level-100 Berserker, Monk and Rogue profile and
repeat steps 2–5 without saving gear or scenarios.

The manual reload was subsequently performed. A fresh RaidLoot reload now shows
Linna's compact `Stats +602 · DPS EST. -0.40 (PARTIAL)` row and a tooltip that
includes the class-specific Spell stats DPS scope and exclusions. This confirms the
updated project extension is active in Chrome. The current open page does not expose
a supported Berserker, Monk or Rogue profile, so those three class-specific live
rows remain unverified; the repository tests are the authoritative checks for them.

On 2026-09-12, Chrome confirmed the user-added `Pikity — Berserker · Lv 100` profile
with 35 imported items and 35 items with stats; Compare was selected. Manage Characters
showed one known primary weapon, Milratus, the Heart's Fang (DMG 282, Delay 32), and
an explicitly empty secondary slot. The live project-extension row showed compact
`Stats +1,443 · DPS UNAVAILABLE` with the reason `Required melee stats or active
weapons are unavailable.` The shared v3 editor exposed `Layout: Select…`, so the
first check was unresolved layout coverage, not a zero-DPS result. The exact RaidLoot
record lists Milratus as `2HP`, 282 damage / 32 delay, and explicitly includes `BER`,
so the weapon is Berserker-wearable ([source](https://www.raidloot.com/raid/rof4)).
The same source identifies its proc as `Strike of Venom VIII`; RaidLoot's spell listing
gives that proc as 750 Poison damage with -200 resist ([source](https://www.raidloot.com/aa/ranger)).
After selecting and saving the source-backed `two-hand` layout, Chrome showed revision
1 and the live row `Stats +878 · DPS est. 146 → 145.90 (Δ -0.10) (partial)`. Its
tooltip identifies the Berserker base-melee scope: it includes Melee stats DPS and
excludes Spell DPS, spell focus modifiers, pet damage, DoTs, Discs, Frenzy and class
special attacks. The first save attempt exposed a v3 UI omission of required spell
defaults for melee-only scenarios; that save path was fixed and covered by the UI
regression test. Expanded Damage contributions separately showed Melee DPS unavailable
for unresolved imported worn effects and Weapon proc DPS unavailable because the
effect lists are incomplete, including the unmodeled `Strike of Venom VIII`; these are
genuinely unresolved inputs, not known-irrelevant effects. Type 3 Kromrif/Poantaar
spell focuses are a separate Beastlord spell-model concern and must not be reused as
weapon-proc damage. The next proc increment needs the exact catalog entry plus a
validated proc-rate assumption. No gear was changed; this real Pikity scenario was
saved explicitly.
The unpacked extension was verified from `~/workspace/loot-captain` after an
extension and RaidLoot reload. The saved scenario persisted after a final RaidLoot
reload; no gear data was changed.
