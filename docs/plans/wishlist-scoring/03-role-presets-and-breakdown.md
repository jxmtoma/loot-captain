# 03 — Role presets and score breakdown

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Design needed; implementation follows focused product review

## Objective

Offer transparent, versioned ranking preferences per character without presenting them as
EverQuest mechanics or claiming caps that are not modeled.

## Dependencies

Plans 01 and 02.

## Required v1 design

The design deliverable is this decision table. It intentionally leaves weights undefined;
they are product preferences, not verified game formulas, and require focused review before
implementation.

| Preset | Suggested classes | Weights |
| --- | --- | --- |
| Tank survivability | Warrior, Paladin, Shadowknight | To be defined in design |
| Melee DPS | Berserker, Beastlord, Monk, Ranger, Rogue | To be defined in design |
| Caster DPS | Enchanter, Magician, Necromancer, Wizard | To be defined in design |
| Healer | Cleric, Druid, Shaman | To be defined in design |
| General / raw | Bard and all unlisted classes | No weights |

Class mapping only suggests a default. The user chooses the preset. No role determines a
mechanical conversion, and no caps or over-cap behavior are claimed until a model exists. The
completed design must include exact versioned weights and worked tradeoff examples, including
the case where weapon damage rises while delay also rises; damage alone is not a safe
recommendation.

## Scope

- Store each preset as a versioned key resolved through plan 02.
- Show each `delta × weight` contribution, including negative values, and the total only
  when plan 01 says every weighted term is known.
- Keep legacy `netpos` available as `Legacy — no recommendation`; `General / raw` displays
  deltas and effects without weights or a summed score.
- Use neutral multi-character results when formula keys or versions differ.

## Non-goals

No custom formula editor, cap simulator, heroic-stat conversion, DPS forecast, or claim that
these weights represent class performance.

## Likely files

`content/shared/diff.js`, `content/shared/ui.js`, `popup/popup.js`, `popup/popup.html`,
`options/options.js`, `options/options.html`, `options/options.css`, and `tests/regression.js`.

## Acceptance tests and done

- Every accepted preset resolves by key/version and class suggestions are overridable.
- Design review defines exact versioned weights and worked tradeoff examples before code work.
- Breakdown rows equal the displayed delta multiplied by its weight, including losses.
- Unknown weighted terms make the total unavailable while known rows remain visible.
- Raw mode has no aggregate score; legacy `netpos` is visibly labeled and not suggested.
- `node tests/regression.js` covers all presets, migration, mixed formulas, and wishlist owners.

Done means product review has accepted or replaced the provisional table, UI labels it as a
preference, and no mechanics or cap language appears in shipped copy.
