# 03 — Role presets and score breakdown

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Implemented in v1; fixed weights are selectable through the existing
per-character formula control.

## Objective

Offer transparent, versioned ranking preferences per character without presenting them as
EverQuest mechanics or claiming caps that are not modeled.

## Dependencies

Plans 01 and 02.

## Required v1 design

The v1 design uses explicit, versioned preference weights. These are ranking preferences,
not verified EverQuest conversions, caps, or class-performance claims.

| Preset | Suggested classes | Weights |
| --- | --- | --- |
| Tank survivability (`role-tank` v1) | Warrior, Paladin, Shadowknight | HP × 1 + AC × 10 + HSta × 20 |
| Melee stat preference (`role-melee` v1) | Berserker, Beastlord, Monk, Ranger, Rogue | HP × 1 + ATK × 5 + HDex × 20 |
| Caster stat preference (`role-caster` v1) | Enchanter, Magician, Necromancer, Wizard | MANA × 1 + Spell Dmg × 10 |
| Healer (`role-healer` v1) | Cleric, Druid, Shaman | MANA × 1 + Heal Amount × 10 |
| General / raw (`role-raw` v1) | Bard and all unlisted classes | No weights |

General / raw is `role-raw` v1 and intentionally has no aggregate score. A class mapping only
offers a suggestion; it never changes a saved character preference. Any character can choose
any preset, including raw.

Comparison controls say **Compare**. Green/red/yellow mean higher/lower/equal known
stat preference scores; gray means unavailable, mixed or no recommendation. Yellow
is never a generic neutral fallback. Tooltips name the preference basis, not DPS.
Scores and formula identities
appear inside **Preference score (not DPS)**, not as an upgrade verdict. The initial
comparison shows a compact overview; full stats, effects and experimental estimates
are disclosed on demand. The formulas and stored keys remain unchanged.

Worked tradeoffs:

- A tank candidate with +20 HP, +2 AC and -1 HSta scores `20 + 2×10 - 1×20 = 20`.
- A Beastlord candidate with +30 ATK, +1 HDex and -10 HP scores `30×5 + 1×20 - 10 = 160`.
- A caster candidate with +15 Spell Dmg and -100 MANA scores `15×10 - 100 = 50`.
- A weapon changing from 100 Damage / 20 Delay to 120 Damage / 30 Delay has +20 raw Damage but
  its Damage/Delay ratio falls from 5 to 4. The ratio remains a separate informational signal;
  the presets do not weight Damage or Delay, so they cannot claim a DPS recommendation from
  that tradeoff.

Class mapping only suggests a default. The user chooses the preset. No role determines a
mechanical conversion, and no caps or over-cap behavior are claimed until a model exists. The
completed design must include exact versioned weights and worked tradeoff examples, including
the case where weapon damage rises while delay also rises; damage alone is not a safe
recommendation.

## Scope

- Store each preset as a versioned key resolved through plan 02.
- Show each `delta × weight` contribution, including negative values, and the total only
  when plan 01 says every weighted term is known.
- Keep legacy `netpos` available as `Legacy — no recommendation` with neutral recommendation
  presentation; `General / raw` displays deltas and effects without weights or a summed score.
- Use neutral multi-character results when formula keys or versions differ.

## Non-goals

No custom formula editor, cap simulator, heroic-stat conversion, DPS forecast, or claim that
these weights represent class performance.

## Likely files

`content/shared/diff.js`, `content/shared/ui.js`, `popup/popup.js`, `popup/popup.html`,
`options/options.js`, `options/options.html`, `options/options.css`, and `tests/regression.js`.

## Acceptance tests and done

- Every accepted preset resolves by key/version and class suggestions are overridable.
- Exact versioned weights and worked tradeoff examples are defined above and shipped in code.
- Breakdown rows equal the displayed delta multiplied by its weight, including losses.
- Unknown weighted terms make the total unavailable while known rows remain visible.
- Raw mode has no aggregate score; legacy `netpos` is visibly labeled and not suggested.
- `node tests/regression.js` covers all presets, migration, mixed formulas, and wishlist owners.

Done means product review has accepted or replaced the provisional table, UI labels it as a
preference, and no mechanics or cap language appears in shipped copy.
