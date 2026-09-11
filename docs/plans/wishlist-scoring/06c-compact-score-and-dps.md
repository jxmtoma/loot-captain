# 06C — Two useful numbers and one shared DPS scenario

Status: implemented and verified with regression checks and the live RaidLoot UI.

## Product decision

Keep the compact comparison, but restore magnitude. Two green items should be
distinguishable without expanding their full stat tables.

For a melee preference, show **Stats ±N · Melee DPS est. ±N**. The first number is
the existing weighted stat-score change; the second is the modeled melee damage
change under one shared character scenario. Text color represents each metric's own
direction on a neutral button background. Do not blend the two numbers into a new score.

When the damage model does not cover an item or character, show an unavailable
damage value with an explanation, never a fabricated zero. Unsupported contributions
say **DPS not modeled**; failed or incomplete supported calculations say **DPS unavailable**.
Caster spell damage,
armor effects, augments and pet contributions are not implemented by this increment.

## Shared scenario

The user selected an editable reference scenario per character. Store it separately
from profiles and score formulas under `dpsScenariosByProfile`, keyed by character ID.
Use a versioned record and optimistic revision checks. Viewing estimates never saves
a scenario or modifies gear, snapshots, AAs or measurements.

The initial illustrative defaults reuse the arithmetic example in 06B:

| Input | Primary | Secondary |
| --- | ---: | ---: |
| Effective haste, shared | 100% | 100% |
| Hit chance | 0.8 | 0.8 |
| Mean base-damage coefficient | 2 | 2 |
| Mitigation fraction remaining | 0.5 | 0.5 |
| Flat damage bonus per landed strike | 10 | 0 |
| Expected attacks per round | 1 | 0.5 |

These are deliberately labeled **illustrative reference defaults**, not measured
Beastlord values or automatically derived EverQuest mechanics. They provide a consistent
scenario to edit, not a verified target/AA/buff model. The earlier explicit-input
calculator remains available for comparison-specific experimentation.

Default to dual wield only when the profile actually has an unambiguous known weapon
in each hand. Otherwise require a layout choice; primary-only eligibility is not proof
of two-handed weapon type. Saved layout changes must still pass equipment validation.

Apply each hand's inputs identically to current and proposed gear. The scenario applies
to every supported comparison for that character. Different characters have independent
records; stale saves cannot overwrite newer edits. Deleting a character removes its
scenario. Saving a scenario refreshes comparisons through the normal storage listener.

## What the second number includes

Use the existing **Weapon melee DPS** output from 06B. This is white melee damage
from the equipped weapons under the stated inputs. It excludes procs, spell focus,
pets, augments and automatic ATK/heroic/effect conversions. The compact label must
say **Melee DPS est.**, not total character DPS. Spell damage remains unavailable
until the separate spell rotation/focus model exists.

Never persist a blanket `procListsConfirmed` flag in the shared scenario: confirmation
for one item does not establish the completeness of a different item's proc list.
Proc inputs and completeness checks remain specific to the manual calculator.

## Validation

- Stats magnitude stays visible even when damage is unavailable.
- Known DPS values come from the shared reference model, not from relabeling ratio.
- Defaults do not create records; explicit saves are validated and revision-checked.
- A scenario edit affects both gear sets consistently and refreshes every comparison.
- Character and item contexts are kept separate; stale equipment requests are rejected.
- Unsupported items/classes, unknown data and invalid scenarios stay unavailable.
- Existing colors, collapsed detail sections, scoring and manual DPS behavior remain.

Live verification: Ereebus's Fearbrand → Tolvak comparison displayed `Stats +35` and
`Melee DPS est. -10.95`, with current/candidate reference values 162.67 → 151.72.
The default assumptions editor was inspected without saving test values. These are
scenario calculations, not combat observations. The check also exposed a stored `DMG`
alias missing from the DPS stat lookup; the model now accepts that imported alias while
preserving explicit canonical `Damage` precedence and unknown-value handling.
