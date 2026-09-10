# Beastlord snapshot and calibration contract

Input contract implemented by [05A](../../plans/wishlist-scoring/05a-character-inputs.md).
Its app record format is documented there; no live projection model is implemented.
Back to [Plan 05 findings](README.md).

## Snapshot

Bind a snapshot to the local profile ID, class, level, server, active expansion, patch/build
identifier, and capture time. Store the original entered values alongside normalized values.
The first target is a level-100 Beastlord on Oakwynd; expansion and patch remain unconfirmed.
Do not silently merge Ereebus's two profile records or infer a server from an unrelated profile.

Record these fields; unknown is `null`, never zero:

| Group | Required meaning |
| --- | --- |
| Pools | Maximum HP, maximum mana, and maximum endurance; never current remaining pools |
| Attack | Displayed ATK, labeled as displayed; do not equate it with damage or combat-effective ATK |
| Base attributes | Sheet STR/STA/AGI/DEX/INT/WIS/CHA values and displayed caps, exactly as shown |
| Heroic attributes | Separately recorded HStr/HSta/HAgi/HDex/HInt/HWis/HCha |
| Attribute convention | Record whether sheet base values include heroics; keep unknown until established from the UI/rule |
| Modifier window | Relevant current modifier and next-point tooltip, including the associated heroic threshold |
| AA ranks | Actual rank or explicit zero; ability name/ID, definition version, class mask, level and expansion applicability |
| Conditions | Unbuffed, same equipment/augment layout, tribute and trophies disabled or exactly recorded, power source state, food/drink, stance and persistent effects recorded/frozen |
| Equipment binding | Digest of item identity, slot/index, numeric stats, effects, and augment parent/socket bindings |
| Provenance | Who observed it, capture timestamp, and references to the original records/screenshots if provided |

Require only the fields needed for a requested output, but return a specific unavailable
reason for each missing dependency. A complete gear inventory does not replace the character
sheet. The first HP test needs maximum HP, STA/cap/HSta and unchanged-condition confirmation;
a mana test additionally needs WIS/cap/HWis. Full seven-stat entry is useful later, not a
reason to discard a valid narrowly controlled test.

A displayed cap includes the effects already active at capture time. Do not add AA grants to
that cap again. Do not subtract heroics from sheet values or add them twice before confirming
the selected rule's attribute convention. Do not turn an AA rank into a bonus using a generic
`rank × number`: some descriptions are cumulative, and historical definitions may differ.

## Validity and invalidation

A projection is unavailable if class, level, server/patch/expansion, relevant AA definitions,
equipment digest, or recorded conditions differ from the snapshot. An edited or externally
equipped item invalidates it; Undo does not automatically certify a new in-game observation.
Loot Captain's local Equip action is not an in-game measurement.

A timestamp alone cannot prove freshness. Preserve it for review, require the equipment and
condition binding, and ask for re-confirmation after a relevant change. Saving unrelated
wishlist entries or changing ranking weights does not invalidate physical character inputs.
Failed or stale snapshot saves must not overwrite newer profile data.

The first projection supports the explicitly selected worn replacement only. A wishlist
baseline is not the character's actual worn state. A parent replacement is supported only
when augment transfer/removal and power-source effects are known; otherwise do not claim
that the raw parent-item delta is the complete gear change.

## First capture: one reversible A → B → A observation

1. Confirm Ereebus's level, server, current expansion, patch/build and relevant AA ranks.
2. Stand out of combat, remove temporary buffs, and hold the recorded conditions constant.
   Use maximum pools. Wait for the stat display to settle after each change.
3. Record state A: the worn item/augment arrangement and maximum HP, STA, STA cap, HSta.
   For a mana test, also record maximum mana, WIS, WIS cap, HWis. Record ATK/HStr only when
   testing that output. Capture a relevant modifier tooltip if testing a heroic breakpoint.
4. Change exactly one item or augment. Record its full raw stat/effect delta, the exact slot,
   and state B using the same fields. Prefer a pure direct-HP change first; avoid worn-effect,
   power-source, augment-layout, or cap changes for that test.
5. Restore A and repeat the readings. If they do not return to A, record the discrepancy and
   reject the sample as a clean calibration until the changed condition is identified.

Do not buy AAs solely for this test. A test with several changing attributes can validate an
already specified combined model, but cannot identify each conversion coefficient on its own.
A fitted coefficient needs independent swaps and a held-out check, not a fit to its own input.

### Record template

Keep actual observations in `evidence.json.measuredSamples`. This is a blank description,
not a sample to insert as measured data:

```json
{
  "kind": "in_game_observation",
  "observedAt": null,
  "observer": null,
  "class": "Beastlord",
  "level": 100,
  "server": "Oakwynd",
  "expansion": null,
  "patch": null,
  "unbuffed": null,
  "conditionsUnchanged": null,
  "aaRanks": null,
  "slot": null,
  "oldItem": null,
  "newItem": null,
  "itemDeltas": null,
  "before": null,
  "after": null,
  "restored": null,
  "sourceReferences": [],
  "reviewStatus": "pending"
}
```

## Arithmetic contract

Evaluate the replacement and the original state through the same rule, then subtract:
`change = rule(after) − rule(before)`. This handles breakpoints; multiplying an item delta
by an average coefficient does not.

For a justified coefficient interval `[lo, hi]` and delta `d`, sort `d×lo` and `d×hi` before
reporting the range. Negative changes reverse the endpoints. Correlated assumptions must
use coherent scenarios; independently combining arbitrary coefficient bounds can invent
impossible characters.

For a generic upper-cap operator, a value below its cap reveals the uncapped baseline; a
value exactly at its cap only establishes a lower bound. At a fixed cap, a positive delta
cannot raise the capped value, while a negative delta can have anywhere from its full loss
to no effect because hidden headroom is unknown. This is mathematical interval reasoning,
not an assertion about EQ's minimum-stat floor or heroic-cap mechanics. If the new cap or
conversion is unknown, stop that output instead of supplying an invented maximum-AA cap.

Separate direct item changes, rule-derived contributions, calibrated estimates, and totals.
Never label a range as a statistical confidence interval without a sampling/error model.
