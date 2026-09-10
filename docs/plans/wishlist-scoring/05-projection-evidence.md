# 05 — Projection evidence

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Research complete — 2026-09-08; production projection gate not passed

## Objective

Determine whether a defensible range projection for gear changes can be supported by current,
cited evidence and measured samples. This is an independent research deliverable.

## Dependencies

None. It must use class, level, and server/era rules; role presets are not a substitute.

## Scope

- Remove the old uncited coefficient, cap, and “all AAs available” claims from the roadmap.
- Define an evidence record with source URL/date, game version or era, class, level, input
  snapshot, before/after values, uncertainty, and reviewer notes.
- Track measured samples in a committed, reviewable repo file before deriving bounds.
- Define the snapshot contract: current gear and augments, equipped and unbuffed, with tribute,
  power source, buffs, and AAs frozen or recorded; include capture time, source completeness,
  and staleness handling.
- Specify hidden cap headroom and negative-delta range math. Apply only the replaced-item
  delta so baseline dependencies are not double-counted. Any missing dependency makes the
  projection unavailable rather than silently widening or inventing a bound.
- Treat observations as evidence for their recorded class/level/era only; they do not
  automatically narrow every class or era, and forum disagreement is not a numeric bound.

## Non-goals

No UI, profile schema, coefficient table, cap fallback, or projection model ships in this
plan. No all-AA assumption, role-based archetype, or uncited community number is acceptable.

## Likely files

Primarily `docs/` evidence files and this roadmap. Later implementation would touch
`content/shared/diff.js`, `content/shared/state.js`, `content/shared/ui.js`, `options/options.js`,
and `tests/regression.js`, only after the gate is accepted.

## Acceptance tests

- Every proposed coefficient or cap rule has provenance and era applicability.
- Positive and negative gear deltas produce mathematically consistent ranges.
- Missing, stale, buffed, or mismatched snapshots return unavailable.
- A successful gate includes at least one measured sample that can be independently
  recomputed from its recorded inputs.
- Review explicitly decides whether evidence is sufficient; the gate may finish as a
  documented insufficient-evidence result with no sample and no implementation.

## Definition of done

The evidence and snapshot contract are committed and reviewed, old unsupported claims are
removed, and a separate follow-up implementation plan is created only if the gate passes.

## Explicit implementation follow-ups

AA integration and estimated EverQuest stat formulas remain intended features. This evidence
plan determines the supported rules and assumptions; it does not remove those features from
scope. Record a supported/unsupported decision for each follow-up, then create bounded
implementation plans for the supported subset:

1. **Character inputs:** class, level, server/era, an unbuffed equipped-stat snapshot, and
   optional user-entered AA ranks. Preserve these fields through imports and editor saves.
2. **AA and cap model:** versioned, cited rules for supported AA ranks and caps. Distinguish
   user-entered ranks from any explicit assumptions; never assume all AAs are purchased.
3. **Estimated EQ stat conversions:** supported base and heroic contributions to HP, mana,
   and ATK, including cap/breakpoint behavior, negative deltas, and bounded uncertainty.
4. **Upgrade projection UI:** apply candidate-minus-worn changes to the recorded baseline,
   show supported estimates with their assumptions, and explain unavailable results.

Manual AA inputs are in this intended scope. Automatic AA collection and full character DPS
simulation remain deferred. A failed evidence gate must name the missing evidence and which
follow-ups remain blocked, rather than quietly dropping AA or formula integration.

## Research outcome

The [evidence review](../../research/character-projection/README.md) targets Ereebus, a
level-100 Beastlord whose inventory-import profile records Oakwynd. The active expansion,
patch, purchased AA ranks, and unbuffed character-sheet baseline remain unconfirmed.

The review found a developer reference for post-400 heroic Accuracy and concrete AA catalog
records. It did not establish validated HP/mana/ATK coefficients for this target. There are
zero observed gear swaps in the evidence register; developer examples and synthetic tests
are deliberately separate from measurements.

The production gate therefore has an **insufficient-evidence** outcome. AA and estimated
formula integration remain intended work, with the exact prerequisites and 05A–05C sequence
recorded in the review. No character projection code or guessed AA defaults were shipped.

Next evidence: follow the [snapshot and reversible-swap checklist](../../research/character-projection/snapshot-and-capture.md).
The smallest useful first test records maximum HP, STA/cap/HSta, relevant AA ranks, and one
controlled item change, followed by restoring the original item. Add WIS/cap/HWis and maximum
mana for a mana test. Multiple simultaneously changing attributes cannot establish individual
conversion rates from one observation.

Verification: `python3 docs/research/character-projection/check_evidence.py` passes reference
and synthetic arithmetic checks. This is not a claim of in-game validation.

## Input implementation

[05A — Character inputs and calibration](05a-character-inputs.md) is implemented as of
2026-09-08. It collects real observations without introducing conversion formulas. The
numerical gate described above still applies to 05B rules and 05C projection output.
