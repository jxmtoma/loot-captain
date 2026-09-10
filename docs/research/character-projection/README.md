# Plan 05 findings: level-100 Beastlord projection

**2026-09-09 implementation update:** The user chose consistent reference estimates without
mandatory calibration. [The reference model](reference-model.md) now implements HP, mana,
displayed ATK and endurance for level-100 Beastlords, with labeled AA/cap assumptions.
The original findings below remain an audit of live-game evidence, not a block on reference
mode. Calibrated Accuracy retains its separate observation gate; no new game measurements
are claimed.

## Original research decision (superseded for reference mode)

Research collected 2026-09-07; reviewed 2026-09-08. **Research complete; numerical projection gate not passed.**
The immediate prerequisite is a controlled in-game observation, not another scoring preset.
No extension model, AA defaults, or numerical prediction was added in this phase.

The target is Ereebus, Beastlord, level 100. Loot Captain has two local entries with that
name: the inventory import records Oakwynd; the RaidLoot import has no server. The open
Rain of Fear armor page gives context but cannot establish the current expansion or patch.
No account data or full inventory was copied into this research directory.

## Evidence and decisions

The machine-readable [evidence register](evidence.json) separates publisher statements,
developer reference vectors, catalog records, and emulator behavior. Retrieval hashes pin
locally reviewed pages without reproducing entire source pages. An example published by a
developer is explicitly not counted as an observed Ereebus gear swap.

| Component | Finding | Decision |
| --- | --- | --- |
| Character snapshot and manual AA entry | Gear imports do not provide the required character-sheet baseline or purchased ranks | Input contract specified; no inferred ranks |
| Heroic modifier thresholds | A developer supplies a post-400 Accuracy rule and a worked result | Suitable for a narrowly scoped reference check; current-server tooltip/measurement still needed |
| STA/HSta → HP | No validated target coefficient obtained; HP multiplier scope unresolved | No production estimate yet |
| WIS/HWis → mana | Beastlord uses WIS qualitatively; magnitude remains unverified | No INT-caster coefficients; no production estimate yet |
| STR/HStr → ATK | No validated target conversion, item-ATK cap, and displayed/combat ATK relationship obtained | Keep direct item ATK delta only |
| AA/cap contribution | Some catalog facts obtained, but purchased ranks and patch/era applicability are unknown | Record actual rank plus effect definition; never sum every catalog rank |
| Projection UI | Depends on snapshot and a validated model per output | Block unsupported outputs individually; never relabel the weighted score as HP or DPS |

### What the primary material establishes

The [2016 publisher notice](https://www.everquest.com/news/may-2016-patch-preview) documents
heroic/modifier consolidation and character-window threshold tooltips. Its
[detailed announcement](https://forums.everquest.com/index.php?threads/stat-consolidation-and-you-may-2016-patch-preview.232498/)
also describes retroactive item changes. Content-era gear is therefore not, by itself, a
reliable identifier for the mechanics version. Do not apply an old item-migration conversion
to present-day character totals.

[Meeko's July 2021 developer post, #11](https://forums.everquest.com/index.php?threads/heroic-stats-above-400-mod2s-calculated-incorrectly.266158/#post-4048883)
gives the post-400 step size and the example `hDex 2000 → Accuracy 217`. The reference check
implements only the described Accuracy interval, 400–4000. It deliberately rejects lower
values rather than extending an unverified formula. This was an internal-fix announcement;
it does not prove current Oakwynd behavior or measure a gear replacement.

The [publisher's character guide](https://www.everquest.com/news/imported-eq-enus-51200)
identifies Wisdom as the Beastlord mana attribute. It does not specify a usable level-100
conversion. Other classes and roles must not supply this character's coefficients.

### AA facts that change the design

[RaidLoot's Rain of Fear query](https://www.raidloot.com/aa?name=Planar+Power&class=Beastlord&level=100&exp=Rain+of+Fear)
returns Planar Power 55 with a cumulative 275-point cap grant. Store the selected rank's
effect; do not add the cumulative grant of every previous rank. This is a catalog record,
not evidence that Ereebus bought it or that it is the only source of cap increases.

The [Natural Durability query](https://www.raidloot.com/aa?name=Natural+Durability&class=Beastlord&level=100)
returns rank 10 at 18%, with a base-health description. By contrast, the
[pinned emulator implementation](https://github.com/EQEmu/EQEmu/blob/7ab909ee47e8639b2137a6818bfdff99845c9d39/zone/client_mods.cpp)
applies percentage bonuses after adding item HP and branches on client/rules/data for base
pools and caps. That is evidence of emulator behavior, not proof of live behavior. A pure
item-HP swap is the first useful test of multiplication scope; importing a single global
HP-per-STA constant would bypass this unresolved question.

[Physical Enhancement](https://www.raidloot.com/aa?name=Physical+Enhancement&class=Beastlord&level=100)
currently returns AC/avoidance effects, so do not import an old guide's HP bonus without a
matching definition. [Innate Enlightenment](https://www.raidloot.com/aa?name=Innate+Enlightenment&class=Beastlord&level=100)
returns class masks that exclude BST despite the query selector. Validate class masks,
not just query parameters; this AA is excluded from the Beastlord proposal.

### Static does not always mean irrelevant

This is an algebraic design requirement, not a claimed EQ formula: in `Y = B + m × X`, an
unchanged flat `B` cancels in a delta, but an unchanged multiplier `m` still scales it.
A measured baseline already includes its AA cap grants and fixed bonuses. Adding them again
would double-count. Percentage effects must be modeled at the correct stage or calibrated.

## Contract and next evidence

See [snapshot and capture contract](snapshot-and-capture.md). Observed samples belong in
`evidence.json.measuredSamples`; it is empty because no controlled measurements have been
provided. Do not fill it with emulator outputs, item stat deltas, invented examples, or the
developer's reference vector.

Run `python3 docs/research/character-projection/check_evidence.py` for source-reference checks,
the developer reference calculation, and synthetic signed/cap arithmetic checks. These tests
validate research arithmetic, not live EverQuest mechanics. Existing app regressions are
unaffected by this research-only phase.

The next gate review must resolve: actual expansion/patch, a complete snapshot, relevant
purchased AA ranks/effect descriptions, reversible gear-swap observations, and each output's
supported conversion range. One sample may check a specific rule; it cannot identify several
changing coefficients or validate all levels/classes. Require a separate held-out swap before
using a fitted coefficient for loot decisions.

## Concrete implementation sequence after the relevant gate passes

1. **[05A — Snapshot and calibration input](../../plans/wishlist-scoring/05a-character-inputs.md), implemented:** preserve server metadata,
   capture manual AA ranks and observations, and invalidate the baseline on equipment changes.
   This prerequisite contains no inferred character totals and can be reviewed separately.
2. **05B — Versioned Beastlord rules:** admit only source- and observation-backed output rules;
   bind them to class, level, patch, expansion, AA definitions, and valid stat intervals.
   Heroic modifier thresholds are a narrower first candidate than HP/mana/ATK forecasts.
3. **05C — Equipped-item projection:** apply the selected replacement and any verified augment
   changes to a matching snapshot; display direct deltas separately from derived/estimated
   contributions. Unsupported outputs stay unavailable with a reason. Wishlist-baseline
   comparisons retain item deltas until they have their own coherent hypothetical baseline.

These follow-ups retain AA and estimated EQ formulas as intended features. They are not
blanket implementation approval for an unvalidated model. The HP/mana/ATK model and UI remain
blocked on the evidence listed above; the research outcome itself is complete.

## Implementation update — 2026-09-09

[05B](../../plans/wishlist-scoring/05b-validated-rules.md) and
[05C](../../plans/wishlist-scoring/05c-projection-panel.md) now provide an initial Accuracy-only
rule/approval/panel workflow and a class/era AA checklist. Real per-character approval is
required before numerical output; synthetic tests are not measurements. The HP/mana/ATK
evidence gap and the empty research measurement register remain unchanged.
