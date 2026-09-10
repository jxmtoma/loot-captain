# 05A — Character snapshots, AA ranks, and calibration observations

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Implemented — 2026-09-08

## Objective and boundary

Collect the real character inputs needed by 05B and 05C, starting with Ereebus's Beastlord
workflow. This is local data entry, not a character simulator. No AA defaults, heroic
conversion coefficients, HP/mana projections, or changes to ranking scores are introduced.
Data entry itself does not require the numerical-model evidence gate to pass.

## User workflow

Reload the unpacked Loot Captain extension after updating its files, then reload Manage
Characters. Open a saved character and expand the compact **AA & character stats** summary above Inventory.
New characters must be saved before entering these records.

1. Check the character's class, level and Server; save character edits first.
2. Under **AA ranks**, load the class/level/expansion checklist and select actual ranks, or
   confirm listed maximums and adjust exceptions. Leave an unknown
   rank blank; enter `0` only when known to be unpurchased. Optional definition fields capture
   ability ID, version/source, class mask, required level, expansion, and raw effect description.
   Save the AA ranks before taking a snapshot.
3. Under **Character snapshot**, enter maximum pools, displayed ATK, base attributes/caps and
   heroic values directly from the game. Record expansion, patch, observer, time, conditions,
   and the sheet's heroic display convention. Reconfirm unbuffed and worn-gear conditions for
   each new capture. Partial inputs can be saved and remain explicitly incomplete.
4. Under **Record an in-game gear swap**, record before, after, and restored values for a
   single stated replacement. HP/STA readings are shown initially; add mana/WIS or other
   readings as needed. Keep full item/effect/augment changes and capture references in the notes.
5. **Export saved inputs** downloads the selected character's records as local JSON. Nothing
   is uploaded. Review the export before using any observation as research evidence.

## Saved-data contract

`profile.characterData` contains `version`, `revision`, `aaRanks`, `snapshot`, and `observations`.
Snapshot and observation readings retain `{ raw, num }`; blank values normalize to `num: null`.
Pool keys are `HP`, `MANA`, `END`, `ATK`; attribute keys are `STR` etc., with `STRCap` and `HSTR`
for caps and heroics. The uppercase heroic keys belong to this input schema, not item parsing.

A snapshot includes its profile ID, class, level, server, expansion, patch, observer, timestamp,
original local time/time zone, conditions, modifier notes, references, the saved AA records,
and a SHA-256 equipment/context binding. No interpretation of the game's stat formulas is
performed. Unknown display conventions remain unknown instead of subtracting heroics twice.

Each observation keeps a copy of its baseline snapshot so later recaptures cannot change its
meaning. Restored readings that differ from the original produce `inconsistent`. Missing
stages or confirmations produce `incomplete`; otherwise the record is `pending` review.
No record is automatically marked validated, and local Equip/Undo actions never count as
in-game measurements. Exported app records are not automatically inserted into the research
register's `measuredSamples`; that requires review and format mapping.

## Safety and invalidation

- `SAVE_CHARACTER_DATA` accepts extension-page callers only and uses the existing profile
  mutation queue. Both the saved revision and equipment/context binding must match.
- Ordinary profile saves preserve the latest stored character data, preventing stale editor
  tabs and imports from overwriting snapshots or observations.
- Equipment, augment topology, stats/effects, class, level and server changes invalidate a
  snapshot. Changed saved AA ranks/definitions also invalidate it. Invalidation remains after
  Undo restores the original equipment; a new capture is explicit.
- Wishlist, formula, character-name, icon and stat-provenance-only changes do not invalidate
  physical inputs. Unknown-to-known item-stat enrichment does change the binding.
- Incoming storage updates refresh the status without discarding form drafts. A conflict
  explains that saved inputs must be reloaded. Reload explicitly replaces the drafts.
- Saving character metadata or gear is separate from saving observations. Unsaved gear/context
  changes block input saves until the character is saved and inputs are reloaded.
- Invalid numbers, duplicate AA records, stale/deleted targets and failed writes leave saved
  data unchanged. Draft values remain available after failure.
- Data stays local and is removed with its profile. Input limits are 128 AA records, 50
  observations, and a bounded mutation payload; export/remove controls support history upkeep.

## Implementation and verification

- `content/shared/character-data.js`: normalization, bindings, recording and status.
- `background/service-worker.js`: guarded writes and persistent invalidation.
- `options/character-data.js`, options HTML/CSS: entry, review and local export.
- `options/options.js`: server preservation and editor integration.
- `tests/character-data.js`: validation, concurrency, failures, AA changes, stale profile
  writes, Equip/Undo invalidation, history preservation, and server changes.

`node tests/regression.js` includes the character-data checks. An isolated headless Chrome
check with synthetic profiles also exercised rendering, AA and snapshot saves, failed-save
draft preservation, the unsaved-gear guard, observation recording, and narrow-screen layout.
It did not alter the user's Chrome profile or certify any in-game reading.

## Handoff

05B uses reviewed observations to establish versioned Beastlord rules with explicit validity
ranges. 05C additionally provides reference estimates without requiring a snapshot. See the
[research findings and implementation sequence](../../research/character-projection/README.md).
Reference HP/mana/ATK/endurance estimates are documented in [05B](05b-validated-rules.md).

## Follow-up implemented

[05B](05b-validated-rules.md) adds the AA checklist and scoped Accuracy approval flow;
[05C](05c-projection-panel.md) adds the conditional projection panel. Accuracy is an additive
reading in the v1 input schema; older snapshots without it remain readable and simply cannot
validate that rule until recaptured. Reference pool/ATK estimates now work without these optional inputs.

## Compact editor update — 2026-09-09

The normal character page shows a single collapsed AA/stats summary. AA records are
search-only, with at most eight results in a 320px scroll area. Snapshot, calibration,
history and rule-review forms stay collapsed by default. Reloading saved inputs preserves
an open manager for the same character; switching characters starts collapsed.

New catalog entries use max rank as a labeled assumption (`assumed: true`). Existing values
are not silently replaced. Confirming the current selections removes the assumption markers
without changing exceptions; unconfirmed assumptions remain in exports and cannot be used
as evidence of owned AA ranks for projection validation. This is additive to the v1 schema.
