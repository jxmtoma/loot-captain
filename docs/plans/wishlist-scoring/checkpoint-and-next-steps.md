# Scoring and estimates checkpoint

## Shipped scope

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
  partial fallback when complete focus evidence is unavailable.

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
Pet damage, DoTs, unsupported spell effects and augment transfers remain outside the
v3 estimate. Spell DPS uses the explicit hybrid Beastlord rotation, emulator-derived
flat Spell Dmg, and independently resolved focus. Proc DPS requires explicit
rate/damage assumptions and complete or user-confirmed weapon-proc lists; it is not
inferred from effect text. Other classes/levels remain unsupported. Reference estimates do not alter
ranking scores. No synthetic test records belong in real character storage or evidence samples.

## Completed: 03, role presets and score breakdown

[03](03-role-presets-and-breakdown.md) completes preference selection and transparency on
top of the existing local wishlist. Its worked tradeoffs define subjective weights, not
class mechanics. Existing selections/fallbacks remain intact; suggestions do not auto-apply.

## Next bounded increment

Next in [06D](06d-player-damage-contributions.md): broaden exact supported focus coverage
for the real Beastlord profile, beginning with Type 3 FC Kromrif Lance and Poantaar's
Bite. Known irrelevant focus classifications should remain irrelevant; unknown focus
data should remain unresolved rather than silently treated as zero. Melee and supported
weapon procs use v2; saved v1/v2 scenarios retain their prior behavior until explicitly
upgraded. Pet damage and DoTs remain excluded. Expand the rotation only after source
cadence, mana and duration inputs are available; Maelstrom repeat probabilities remain
unknown. Consider other classes only after class-specific scenarios exist. Combat
calibration remains optional.

Call this a DPS estimate, not a meter. A meter would require a separate combat-log ingestion
feature. Keep calibration optional for reference estimates, label defaults, and avoid
inventing precision or making unknown inputs zero. Keep Damage/Delay unchanged and do not
blend DPS into ranking until the model and preference policy have been reviewed.

## Verification at checkpoint

`node tests/regression.js` covers missing data, storage round trips, per-character formulas,
effects, snapshots/AA persistence, calibration gates, reference calculations, role preset
breakdowns and neutral recommendations, plus DPS arithmetic, input validation, independent
component availability, equipped-weapon aggregation, stale weapon identities and UI
stale-response handling.
`python3 docs/research/character-projection/check_evidence.py` checks the research register.
Both commands pass after 03, 06A, 06B, 06C and 06D. The new UI checks use a synthetic
DOM harness; no live-game DPS measurement is claimed; live extension checks are recorded below.
The v3 spell model is implemented in the shared reference path; software checks
and a live project-extension verification pass are complete. These remain reference
calculations, not combat measurements.

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

## Copy-ready next session prompt

Read this checkpoint, [the roadmap](../../wishlist-and-scoring-roadmap.md), and
[06D](06d-player-damage-contributions.md). Treat the v3 Beastlord spell model and live
project-extension verification as complete. Continue one bounded increment: broaden
exact supported focus coverage for the real Beastlord profile, starting with Type 3 FC
Kromrif Lance and Poantaar's Bite. Preserve the distinction between known irrelevant and
unknown focus classification. Keep pets and DoTs excluded, and do not expand the rotation
or add other classes until cadence/mana/duration evidence or class-specific scenarios
exist. Run the focused checks and full regression, then update this checkpoint with only
verified results; do not save synthetic scenarios or change the compact presentation.
