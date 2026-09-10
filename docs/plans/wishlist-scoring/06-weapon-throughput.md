# 06 — Weapon throughput feasibility

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Research gate; no full DPS implementation

## Objective

Test whether a narrow weapon throughput estimate can be made useful and reproducible while
preserving the existing `Damage / Delay` ratio delta.

## Dependencies

None for ratio research. Plan 04 is required if structured procs are included in the estimate.

## Scope

- Write a sourced assumptions table covering units, hand/layout, damage and delay, caps,
  damage bonus, haste, hit rate, mitigation, and proc frequency/effect handling.
- Validate each assumption against representative item and combat-log samples, recording
  era, class, weapon layout, and uncertainty.
- Define labels and unavailable conditions for a throughput estimate; keep ratio delta as the
  narrow baseline.
- Decide whether the evidence supports a separate implementation plan and smallest useful
  output.

## Non-goals

No full character DPS, spell rotation, encounter simulator, universal proc strength ranking,
or single percentage claim. Do not infer missing hit rate, mitigation, caps, or proc behavior.

## Likely files

Research evidence under `docs/` first. A later implementation would likely touch
`content/shared/diff.js`, `content/shared/ui.js`, `content/shared/parser.js`, and
`tests/regression.js`; do not edit those concurrently with another implementation plan.

## Acceptance tests

- Ratio delta remains unchanged for existing fixtures.
- Every throughput input has units, source, applicability, and uncertainty.
- One representative sample can be recomputed from the recorded assumptions.
- Missing assumptions yield unavailable, not a guessed estimate.
- Review explicitly accepts or rejects the feasibility gate before UI/model work begins; the
  gate may finish as a documented rejected or insufficient-data result without samples.

## Definition of done

For a passing gate, assumptions and validation samples are committed and reviewed. A rejected
or insufficient-data gate records why samples or implementation are not justified. In either
case, ratio behavior is regression-tested and any implementation is split into a new scoped
plan after the gate.
