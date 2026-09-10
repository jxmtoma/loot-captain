# 01 — Missing-data semantics

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Implemented — 2026-09-07

## Objective

Distinguish an explicitly known zero from an unavailable value throughout item parsing,
normalization, storage, cache, wishlist entries, and comparison. Preserve useful raw data
and provenance while making score availability conservative.

## Dependencies

None. This is the foundation for plans 02–04.

## Scope

- Define the smallest representation for known numeric values, explicit zero, unknown, and
  source/provenance metadata; reuse existing stat objects where possible.
- Treat a genuinely empty worn slot as a known zero baseline, while an unresolved worn item
  or failed parse remains unknown. An omitted source field is zero only when that source and
  field are covered by a tested completeness guarantee; otherwise it is unknown.
- Carry raw and normalized values through RaidLoot and OpenDKP parsers, service-worker cache,
  profile storage, and wishlist merge/enrichment.
- Keep per-stat deltas visible when both operands are known; label a per-stat result `Exact`
  only when both operands are known. Track `numericScoreAvailable` separately from delta and
  effect comparability so downstream views cannot select a false winner.
- Suppress an aggregate weighted score when any weighted term is unknown. A legitimate known
  negative delta remains visible and negative. Legacy `netpos` also requires a defined,
  complete stat domain; otherwise it is unavailable.
- Treat old records without completeness metadata conservatively: preserve them, but do not
  infer that omitted stats were zero.

## Non-goals

No new scoring weights, character mechanics, effect scoring, projection, or source fetches.
Do not hide identity-only wishlist entries or discard known deltas just because the score is
unavailable.

## Likely files

`content/shared/parser.js`, `background/raidloot-parser.js`, `content/shared/diff.js`,
`content/shared/state.js`, `background/service-worker.js`, `content/raidloot.js`,
`content/opendkp.js`, `content/shared/ui.js`, `options/options.js`, and
`tests/regression.js`.

## Acceptance tests

- Missing candidate or worn HP is not converted to zero; an explicit parsed `0` is.
- An empty worn slot is a known zero baseline; an unresolved worn item and failed parse are
  unavailable.
- An omitted field is zero only under a tested source completeness guarantee.
- A known HP loss remains a negative delta.
- A formula requiring an unavailable term returns no aggregate score with a reason.
- Effect/delta comparability never makes an unavailable numeric score eligible as a winner.
- Legacy `netpos` is unavailable when its stat domain is incomplete.
- Legacy cached/profile/wishlist records remain readable and score conservatively.
- Raw source text and provenance survive parser → cache/storage → comparison.
- Identity-only wishlist add, merge, highlight, and remove still work.

## Definition of done

The representation and completeness rule are shared by every parser and comparison path;
`node tests/regression.js` passes; the changed behavior is documented in code comments or
test assertions; no unrelated UI or schema cleanup is included.

## Implementation notes

Stats retain `{ raw, num, source }` through parsing, profile/editor saves, wishlist mutations,
and enrichment. `num: null` is unknown; explicit numeric zero is known. Existing numeric-only
records remain readable. Neither source currently has a tested omitted-field completeness
guarantee, so every omitted stat remains unknown; no new fetches or forced cache refreshes
were added.

Only empty worn slots supply a zero baseline. Weighted scores are unavailable if any required
term is unknown, and legacy `netpos` requires its complete fixed stat domain. Known deltas and
informational effects remain accessible without a numeric winner. The comparison UI explains
missing score terms and distinguishes exact deltas from unavailable ones.

Validation: `node tests/regression.js` includes the focused comparison and storage checks,
including editor-save round trips, explicit zeros, malformed values, unknown worn gear,
partial multi-character results, wishlist preservation, and failed equip validation.
