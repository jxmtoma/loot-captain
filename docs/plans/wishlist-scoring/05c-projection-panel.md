# 05C — Character projection panel

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Reference estimates implemented — 2026-09-09; optional calibrated Accuracy retained.

## User-visible behavior

After reloading the extension and page, expand an equipped-item comparison on RaidLoot or
OpenDKP. Its collapsed estimate summary shows AC, HP, MANA, END and ATK changes
for level-100 Beastlords. No calibration or snapshot is required. Expand it for the five
results and an optional model selector; calculation assumptions and sources stay collapsed.

Both items use the same [reference model](../../research/character-projection/reference-model.md).
Caps can produce ranges. Valid snapshots optionally anchor totals; otherwise show changes
only. Missing or unsupported inputs produce unavailable results. Ranking scores, weapon
ratios, raw item deltas and informational effects remain separate.

Select **Calibrated Accuracy only** to use the earlier observation-based workflow.
For that optional rule:

1. In 05A, capture numeric Heroic DEX and the Accuracy modifier from the in-game Stats tab.
2. Record an A→B→A observation covering a breakpoint and approve it under 05B after review.
3. Compare an item whose known Heroic DEX delta keeps the character inside that observation's
   interval. The current Accuracy reading must still agree with the rule.
4. For this particular comparison, confirm that wearability, augment transfers, other effects,
   power-source bonuses and the remaining conditions are unchanged. The result is conditional
   on that confirmation; the extension has not independently simulated those systems.

The panel can then show current Accuracy, projected Accuracy, the point change, the Heroic DEX
change, the approved interval and a source link. It labels the result **Derived (conditional)**.
It does not claim a full combat simulation or equate Accuracy points to a DPS percentage.

## Data and consistency

`GET_CHARACTER_PROJECTION` is read-only and accepts only trusted extension/RaidLoot/OpenDKP
contexts. The worker re-reads the saved profile and checks the exact worn item index plus
identity, slot/type compatibility, known class/level restrictions, and snapshot binding.
Calculation runs against stored data, not a potentially stale page copy of the character.

Only explicitly selected worn replacements are supported. Empty slots and wishlist baselines
do not have a character projection. Paired slots retain the selected target; projections do
not mutate gear, place bids, change wishlist entries, or influence item sorting/score weights.
Late responses cannot replace a newer request or update a detached comparison panel.

In calibrated mode, missing Heroic DEX on either item remains unknown, not zero. Unsupported outputs remain
unavailable even when other outputs can be derived. Rule scope and snapshot/AA invalidation
are enforced again at calculation time.

## Verification and remaining work

`node tests/regression.js` includes projection tests. An isolated Chrome check exercised the
actual editor, saved observation, approval action, content comparison panel, confirmation gate,
and resulting +1 Accuracy change using synthetic inputs. The displayed source was checked
against the developer reference; no synthetic input was saved to Ereebus's real profile.

Reference mode is tested without snapshots or calibration, including AA defaults and cap
ranges. Calibrated mode retains its existing confirmation and approval requirements.
Post-softcap AC mitigation, other heroic modifiers, DPS, other classes/levels and complete effect/augment simulation
remain future work. No change to wishlist scoring or automatic ranking is included.

## AC update

Reference v2 adds before-softcap AC (item AC and AGI/HAGI), with results ordered
AC → HP → MANA → END → ATK. Softcap mitigation/shield exceptions remain outside the model;
AC is never anchored to a generic sheet total. See the reference model for details.

The shared comparison entry replaces the duplicate “other effects” button. The estimate
appears above the raw stat table. Worn/click effects, focus and procs are accessible in
the same panel; their effects are not numerically included in the estimate.
