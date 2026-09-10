# 04 — Informational effects

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Implemented — 2026-09-07

## Objective

Preserve and compare effect information without turning unsupported effects into score or DPS.
Keep the existing focus and proc behavior intact while covering the remaining effect types.

## Dependencies

Plan 01 for completeness and provenance. Plan 06 may consume proc rows later.

## Scope

- Preserve canonical `{ type, name, rank, raw }` data plus source/provenance for worn, click,
  and currently unknown effects instead of dropping unsupported types.
- Extend comparison rows for worn and click effects, with an explicit informational/unknown
  state where matching or strength is not established.
- Keep existing focus potency, coverage, and proc comparison behavior; make changes additive
  and regression-safe.
- Show effect additions, removals, rank changes, and unresolved raw text without scoring them.

## Non-goals

No generic focus weight, proc strength ranking, stacking/cap model, spell rotation, or DPS
forecast. No claim that same names have the same applicability across classes or eras.

## Likely files

`content/shared/parser.js`, `background/raidloot-parser.js`, `content/shared/diff.js`,
`content/shared/ui.js`, `background/service-worker.js`, `content/raidloot.js`,
`content/opendkp.js`, and `tests/regression.js`.

## Acceptance tests

- Existing focus and proc fixtures produce the same statuses and directions.
- Worn and click effects survive parser, cache, profile, and wishlist round trips.
- An unknown effect is displayed as informational with raw provenance, never as a score term.
- Replacing an effect with a different unresolved effect does not claim stronger/weaker.
- Missing effect data remains distinct from an explicit empty effect list.

## Definition of done

All effect types are retained or explicitly marked unresolved, comparison output is readable
and non-scoring, and `node tests/regression.js` passes without changing numeric score math.

## Implementation notes

Both parsers preserve worn, click, and unknown effects with raw text, rank, and `provenance`.
Unsupported declared subtypes are retained in `kind`. These effects receive informational
rows and neutral badges; they never contribute to numeric scores or strength directions.
Existing focus/proc comparison behavior is retained.

`effectsKnown` distinguishes an explicit complete effect array (including an empty one) from
missing or legacy lists. HTML observations are partial; absent effects are not inferred.
Incomplete comparisons use `unresolved` rather than inventing additions/removals. Partial
wishlist enrichment merges observations, while an explicitly complete incoming list replaces
it, including clearing to an explicitly empty list. The flag and records survive profile,
editor, cache, equip, and wishlist round trips.

Validation: `node tests/regression.js` includes `tests/profile-scoring-effects.js`, which
checks the resolver, mutations, stale/failed/deleted saves, popup handlers, effect round trips,
completeness, and informational UI. Browser extension behavior was not tested live.
