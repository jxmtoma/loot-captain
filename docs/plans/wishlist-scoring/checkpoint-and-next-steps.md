# Scoring and estimates checkpoint

## Shipped scope

- 01: preserve unknown stats and provenance through imports, storage and comparisons;
  incomplete weighted inputs do not produce numeric scores.
- 02: versioned per-character formulas with a legacy fallback; mixed formulas stay neutral.
- 04: retain worn/click/unknown effects and distinguish unresolved effects from additions/removals.
- 05A: optional snapshots, searchable AA checklist with assumed maxima and saved exceptions,
  and local observation/approval records protected against stale writes.
- 05B/C: level-100 Beastlord reference v2, ordered AC → HP → MANA → END → ATK.
  Calibration is optional; the earlier calibrated Accuracy mode remains separate.
  The consolidated comparison entry leads with estimates and keeps details collapsed.

## Limits to preserve

Reference outputs are consistent gear-change estimates, not measured game totals. AC is
before soft caps; mitigation returns, shield exceptions and avoidance are excluded.
Three named AA bonuses are modeled; the full catalog is not a universal effect interpreter.
Worn/click effects, focus/proc DPS, pet damage, spell rotations and augment transfers are
not simulated. Other classes/levels remain unsupported. Reference estimates do not alter
ranking scores. No synthetic test records belong in real character storage or evidence samples.

## Next: 03, role presets and score breakdown

03 is not wishlist implementation. Follow [03](03-role-presets-and-breakdown.md): first define
versioned preference weights with worked tradeoffs, then show each weighted contribution.
Keep mechanical estimates separate from preference scores. Unknown weighted inputs must
continue to suppress totals; users must be able to override class suggestions.

## Then: DPS estimates

Continue [06](06-weapon-throughput.md), beginning with level-100 Beastlord melee. Document
weapon hand/layout, haste, damage bonus, hit rate and mitigation assumptions and compare
both gear sets under identical conditions. Next add supported procs with explicit frequency
and damage assumptions. Treat spell focus/rotation and pet damage as separate later slices.

Call this a DPS estimate, not a meter. A meter would require a separate combat-log ingestion
feature. Keep calibration optional for reference estimates, label defaults, and avoid
inventing precision or making unknown inputs zero. Keep Damage/Delay unchanged and do not
blend DPS into ranking until the model and preference policy have been reviewed.

## Verification at checkpoint

`node tests/regression.js` covers missing data, storage round trips, per-character formulas,
effects, snapshots/AA persistence, calibration gates, and reference calculations.
`python3 docs/research/character-projection/check_evidence.py` checks the research register.
Isolated Chrome checks used synthetic profiles to verify the compact editor, real-source
AA catalog, no-snapshot estimates, stat order, estimate-before-table layout and optional
Accuracy calibration. These are software checks, not live-game measurements.
