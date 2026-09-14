# Scoring and estimates checkpoint

## Shipped scope

- Live post-Faycite check: Nananya's Shadowborne Cloak → Chillcloak comparison
  shows survival 30.25 → 30.33 seconds, HP +152.40 and mitigation AC +5 under
  defaults. Tomah's casting HPS shows 1968 → 1968.57, with only WIS on Model
  XLII Spatial Temporal Oculus still blocking mana-dependent rows. Its real
  -4 WIS penalty was incorrectly rejected. Signed ordinary WIS now passes
  arithmetic/diagnostic regression checks; live confirmation requires reloading
  this latest build. No real equipment or assumptions were changed.
- Faycite augments are now excluded at the shared reference-estimate entry
  point for tank, healer, caster, hybrid and melee models. Their numeric stats,
  effects and missing-data flags cannot affect the estimates. Imported records
  and ordinary augments remain intact. Tests cover every supported role/class.
  Tomah's rejected WIS value on Model XLII Spatial Temporal Oculus is a separate
  issue; this exclusion does not resolve it.
- Tank simplification: tank preset and independent item score use HP + 4 × AC;
  the shared-enemy survival estimate remains separate. Healer focus stays
  excluded; effect-only RaidLoot stat packets no longer block healer totals.
  Both panels expose blocking items, slots and stats. Regression coverage
  includes legitimate zero omissions, empty imports, and visible diagnostics.
  Nananya/Tomah must be rechecked after reloading the updated extension; their
  exact live blockers have not yet been observed with this diagnostic build.
- Healer v1: level-100 Cleric, Druid and Shaman direct-heal references with
  Heal Amount, WIS/HWIS, mana and capped mana regeneration. Casting throughput,
  healing/mana, long-run and finite-encounter HPS remain separate. Shared
  per-character scenarios have revision and class checks; gear focus changes,
  HoTs and group/triggered heals remain excluded. See [model and tests](../../research/healer/model-v1.md).
  Two synthetic characters per class pass storage-isolation tests; all three
  real-browser fixtures pass. Real imported-character validation is pending.
- Tank survivability v1: level-100 Warrior, Paladin and Shadowknight physical
  HP/mitigation-AC/incoming-damage/survival estimates with independent partial
  outputs, shared editable revision-checked scenarios and compact comparison
  presentation. See [model and verification](../../research/tank/model-v1.md).
  Threat, spell damage, self-healing, avoidance changes and defensive cooldowns
  remain unmodeled. Pure, integration, UI and isolated real-browser checks pass;
  no real character was modified.
- 01: preserve unknown stats and provenance through imports, storage and comparisons;
  incomplete weighted inputs do not produce numeric scores.
- 02: versioned per-character formulas with a legacy fallback; mixed formulas stay neutral.
- 03: versioned role preference presets, overridable class suggestions and weighted
  contribution breakdowns. General/raw has no score; legacy has no recommendation.
- 04: retain worn/click/unknown effects and distinguish unresolved effects from additions/removals.
- 05A: optional snapshots, searchable AA checklist with assumed maxima and saved exceptions,
  and local observation/approval records protected against stale writes.
- 05B/C: level-100 Beastlord reference v2, ordered AC → HP → MANA → END → ATK.
  Calibration is optional; the earlier calibrated Accuracy mode remains separate.
  Reference estimates are available inside the collapsed advanced comparison section.
- 06A: level-100 Beastlord selected-hand melee/proc DPS scenario calculator with explicit
  shared assumptions, independent availability and no score integration.
- 06B: optional equipped-weapon subtotal with separate explicit hand assumptions,
  shared haste, per-hand proc rates and stale weapon-slot checks. Same-layout only.
- 06C: compact stat-score magnitude plus an available melee-DPS estimate, using one
  shared editable reference scenario per character. Defaults are illustrative; saves
  are explicit and revision-checked. Procs/focus/pets remain outside the inline estimate.
- 06D (1/2): v2 adds ATK/STR/DEX/HSTR/HDEX changes, strongest supported Cleave/Ferocity,
  and exact supported weapon procs at explicit per-hand rates. Partial melee stats,
  complete melee, procs and their subtotal remain separate; confirmation is bound to
  the current comparison and is never saved as a blanket assumption. v3 adds a
  hybrid Beastlord spell contribution and an explicitly unfocused Spell stats DPS
  partial fallback when complete focus evidence is unavailable. Exact Type 3 FC Kromrif
  Lance and Type 3 FC Poantaar's Bite coverage is now source-backed, rank-scoped and
  fail-closed for unknown or conflicting data; duplicate copies use the strongest value.
- 06D caster increments: level-100 Wizard/WIZ, Magician/MAG, Enchanter/ENC and
  Necromancer/NEC now have bounded class-specific spell-only references using exact
  rank catalogs and explicit shared editable scenarios. Necromancer is limited to
  one five-tick Pyre of Marnek application per 30-second cycle. These are reference
  arithmetic, not optimal rotations or a combat meter.
- 06D melee increments: level-100 Berserker/BER, Monk/MNK and Rogue/ROG now have
  separate base-melee reference scenarios using the shared weapon/effect/proc path.
  Their class special attacks remain explicitly excluded.

## Limits to preserve

Comparison presentation now leads with compact stat-score/damage numbers and an item
overview. Full stats, effects, preference arithmetic and experimental estimates remain
available on demand. Preference scores do not appear as DPS/upgrade verdicts, and
RaidLoot's native item description is not covered with extra stat deltas.
Comparison backgrounds are neutral. Green/red/yellow text encodes higher/lower/equal
values for each metric independently; gray encodes unknown, not modeled, mixed or
non-recommendation states. Yellow is reserved for equality. Unsupported effects remain
unresolved; nonweapon ATK, attributes, Spell Dmg and supported focuses can change DPS.

Reference outputs are consistent gear-change estimates, not measured game totals. AC is
before soft caps; mitigation returns, shield exceptions and avoidance are excluded.
Three named AA bonuses are modeled; the full catalog is not a universal effect interpreter.
Pet damage, unsupported spell effects and augment transfers remain outside the
v3 estimate. Beastlord Spell DPS uses its explicit hybrid rotation; each caster uses
its own bounded class-specific reference and independently resolved focus. Direct
casters use emulator-derived flat Spell Dmg timing. Necromancer's bounded DoT omits
DoT Spell Dmg scaling, other DoTs and clipping/overlap. Wizard Weave/children,
innate crits, twincast, burns, Magician pets/conditional damage and Enchanter
support mechanics remain excluded. Berserker discs/Frenzy, Monk hand-to-hand/kicks,
and Rogue backstab/poisons remain excluded from their bounded base-melee references.
Proc DPS requires explicit
rate/damage assumptions and complete or user-confirmed weapon-proc lists; it is not
inferred from effect text. Berserker discs/Frenzy, Monk hand-to-hand/kicks and Rogue
backstab/poisons remain excluded from their bounded base-melee references. Other
classes/levels remain unsupported. Reference estimates do not alter
ranking scores. No synthetic test records belong in real character storage or evidence samples.

## Completed: 03, role presets and score breakdown

[03](03-role-presets-and-breakdown.md) completes preference selection and transparency on
top of the existing local wishlist. Its worked tradeoffs define subjective weights, not
class mechanics. Existing selections/fallbacks remain intact; suggestions do not auto-apply.

## Next bounded increment

Optional [class attacks](../../research/player-damage/class-attacks.md) now add
Frenzy, Flying Kick or Backstab to level-100 melee scenarios. Enable explicitly
in DPS assumptions and save; existing scenarios retain their previous results.
These use pinned base-damage formulas and editable effective hit/cadence/landed
damage assumptions. Discs, poisons, other attacks and automatic AA/ATK scaling
remain excluded. Backstab needs imported Backstab Dmg and primary-piercing
confirmation; Flying Kick needs known boot AC. Live validation remains pending.

Generic direct weapon-proc descriptions now feed the shared estimator without
per-rank catalog additions. One unconditional HP-damage line supplies damage;
effective hand PPM and landing remain scenario assumptions. Catalog fallback
covers name-only imports. Complex effects and conflicting known records remain
unresolved. Regression coverage includes both import normalizers, comma-formatted
damage, uncataloged IDs, missing IDs/resists, same-hand duplicates and independent
dual-wield contributions. No real profile or scenario was changed.

The Strike of Venom VIII gap identified in Pikity's check is now covered by
exact spell 23777 (750 direct damage, Poison -200), including the legacy
saved-import rank artifact. It flows through the existing weapon-proc and
player subtotal paths. Complete or comparison-confirmed weapon effect lists
are still required; unknown imported lists are not silently treated as complete.
Proc frequency remains an editable effective per-hand scenario assumption,
not a newly validated live rate. No real profile or scenario was changed.
Catalog and two-hand Berserker regression fixtures cover identity conflicts,
25 DPS at 2 PPM, replacement delta, landing assumptions and completeness gates.

Next in [06D](06d-player-damage-contributions.md): preserve class-specific caster
and melee boundaries. Add broader rotations or class abilities only when spell or
attack identity, cadence, mana/duration or timing evidence is available. The completed Type 3 records are Kromrif Lance 36812 (+532, group 2512,
ranks 36401/36402/36403) and Poantaar's Bite 36809 (+661, group 2517,
ranks 36379/36380/36381), both before crit. Known non-applicable records remain
irrelevant; unknown or conflicting focus data remains unresolved rather than zero.
Melee and supported weapon procs use v2; saved v1/v2 scenarios retain prior behavior
until explicitly upgraded. The shared editable scenario remains the only scenario for
both gear sets, with explicit upgrades for saved older scenarios. Pet damage and DoTs
remain excluded where not separately modeled, and calibration remains optional.

The reviewed Beastlord rotation remains one Poantaar's Bite and one Kromrif Lance per
explicit 32-second cycle, with a 100 mana/second budget and source-backed 0.5-second
casts and 30-second recasts. No starting mana pool, regeneration, finite encounter
duration or cast timeline is modeled. Maelstrom (36474–36476) has documented 33/33/34
child-repeat probabilities, but its shared 12-second scheduling/global-recast behavior
is not established, so it remains excluded. Expand the rotation only when those inputs
are source-backed.

The caster increments use exact Wizard, Magician, Enchanter and Necromancer spell
records and the shared focus pipeline. Direct-caster Spell Dmg timing uses the pinned
EQEmu reference rule, not retail calibration; Necromancer's five six-second ticks over
30 seconds omit DoT Spell Dmg scaling. No optimal rotation or live combat accuracy is
claimed.

The melee increments use separate Berserker, Monk and Rogue base-melee scenario
identities over shared explicit weapon/effect/proc arithmetic. They do not claim
full class DPS or automatically price special attacks, discs, Frenzy, backstab,
poisons, hand-to-hand or kicks.

The melee increments use separate Berserker, Monk and Rogue base-melee scenario
identities over the shared explicit weapon/effect/proc arithmetic. They do not claim
full class DPS or automatically price special attacks, discs, backstab, poisons or
hand-to-hand/kick mechanics.

Call this a DPS estimate, not a meter. A meter would require a separate combat-log ingestion
feature. Keep calibration optional for reference estimates, label defaults, and avoid
inventing precision or making unknown inputs zero. Keep Damage/Delay unchanged and do not
blend DPS into ranking until the model and preference policy have been reviewed.

## Verification at checkpoint

`node tests/damage-catalog.js`, `node tests/player-damage.js`, and `node tests/regression.js`
pass. The full suite covers missing data, storage round trips, per-character formulas,
effects, snapshots/AA persistence, calibration gates, reference calculations, role preset
breakdowns and neutral recommendations, plus DPS arithmetic, input validation, independent
component availability, equipped-weapon aggregation, stale weapon identities and UI
stale-response handling.
`python3 docs/research/character-projection/check_evidence.py` checks the research register.
`python3 docs/research/player-damage/check_reference_vectors.py` and `git diff --check`
also pass. These checks pass after 03, 06A, 06B, 06C and 06D. The new UI checks use a synthetic
DOM harness; no live-game DPS measurement is claimed; live extension checks are recorded below.
The v3 spell model is implemented in the shared reference path; software checks
and a live project-extension verification pass are complete. These remain reference
calculations, not combat measurements.

The four caster and three melee increments pass the focused catalog/player/DPS/UI checks, the full
regression suite, both research checks, packaging, and diff validation. No live caster
gear or scenario was saved; these remain software-verified reference calculations.

Earlier isolated Chrome checks used synthetic profiles to verify the compact editor, real-source
AA catalog, no-snapshot estimates, stat order, estimate-before-table layout and optional
Accuracy calibration. These are software checks, not live-game measurements.

The simplified comparison was also checked in the user's existing Chrome Tolvak page:
neutral primary/secondary buttons, Fearbrand → Tolvak overview, lower weapon ratio,
no inline stat deltas and collapsed stats/score/effects/experimental controls. No gear
was equipped or profile data changed during this UI check.

06C was checked on the live weapon page: compact Stats +35 / Melee DPS estimate -10.95,
shared defaults visible in the editor, and no scenario automatically saved. Imported
DMG labels are covered by regression tests alongside canonical Damage and unknown values.

06D parts 1/2 now pass the full regression suite, including catalog identities, model
vectors and stale-confirmation integration. Live Chrome checks verified an armor melee
change and independent proc DPS (24 → 22.33 for Fearbrand → Tolvak under reference rates).
Partial labels were checked in both inline and expanded views; temporary confirmation
was cleared and no gear or scenario was saved.

The v3 live project-extension check used Lone Walker’s Cloak → Shivercloak:
Stats +205, partial melee 157.58 → 157.45 (-0.13), unfocused Spell stats
623.94 → 624.75 (+0.81), and partial player 781.52 → 782.20 (+0.68).
The shared v3 editor showed revision 0, rank 1, cycle 32s, landing 1, crit chance 0,
critical multiplier 2, mana 100, and melee-during-cast 0. No scenario or gear was
saved and all confirmations remained unchecked. This verifies the extension path,
not live combat accuracy.

After the Type 3 increment, the live RaidLoot Beastlord page was reloaded through the
existing unpacked project extension instance. Its compact rows still showed independent Stats and one
DPS estimate with the green/red/yellow metric treatment and the explicit pet/DoT
exclusions. No gear or scenario was saved.

On 2026-09-12, Chrome validated the user-added `Pikity — Berserker · Lv 100` profile:
35 imported items, all with stats, Compare selected. Manage Characters showed the
known primary Milratus, the Heart's Fang (282 damage / 32 delay) and an empty
secondary slot. The live compact row was `Stats +1,443 · DPS UNAVAILABLE`; the
shared v3 editor initially showed `Layout: Select…`, so the first result was unresolved
layout/input coverage rather than a zero. The exact RaidLoot record lists Milratus as
`2HP` with 282 damage / 32 delay and includes `BER`, confirming it is Berserker-wearable
([source](https://www.raidloot.com/raid/rof4)). After saving the source-backed
`two-hand` layout, Chrome showed revision 1 and `Stats +878 · DPS est. 146 → 145.90
(Δ -0.10) (partial)`, with Melee stats DPS included and Spell DPS, focus, pet damage,
DoTs, Discs, Frenzy and class special attacks excluded. The first save exposed and
fixed a v3 melee-only UI omission of required spell defaults; the UI regression now
covers it. Expanded Damage contributions showed Melee DPS unavailable for unresolved
imported worn effects and Weapon proc DPS unavailable because the effect lists are
incomplete, including `Strike of Venom VIII`; these are genuinely unresolved inputs,
not known-irrelevant effects. RaidLoot identifies `Strike of Venom VIII` as 750 Poison
damage with -200 resist ([source](https://www.raidloot.com/aa/ranger)), but the current
catalog only covers Strike of Venom V. Type 3 Kromrif/Poantaar focuses remain separate
Beastlord spell-model inputs and cannot substitute for weapon-proc coverage. The next
increment needs the exact proc catalog entry and a validated proc-rate assumption. No
gear changed; the real Pikity scenario was saved explicitly.
The unpacked extension was reloaded from `~/workspace/loot-captain`, then the RaidLoot
page was reloaded; the saved scenario persisted.

## Copy-ready next session prompt

Read this checkpoint, [the roadmap](../../wishlist-and-scoring-roadmap.md), and
[06D](06d-player-damage-contributions.md). Treat the v3 Beastlord model, exact Type 3
focus coverage, four bounded caster references, and three bounded melee references as
complete. Continue only with source-backed rotation expansion or additional class
mechanics; preserve
known-irrelevant versus unknown focus handling, shared editable scenarios, explicit
saved-scenario upgrades, compact presentation and independent metric colors. Keep
pets and unsupported mechanics excluded, and do not expand Maelstrom without the
missing scheduling evidence. Run focused checks and full regression, then update this
checkpoint with verified results only; do not save synthetic scenarios or claim live
combat accuracy.
