# Wishlist and character-aware scoring roadmap

Status: local wishlist, numeric stat coverage, and equip-in-profile implemented; remaining
sections are roadmap, 2026-09-07.

## Product decision

Build one local, per-character loot workflow:

1. Choose how the character values gear.
2. Add items from RaidLoot or OpenDKP to that character's wishlist.
3. Highlight wanted items in RaidLoot and live OpenDKP auctions.
4. Compare an item with the character's current equipment or a selected wishlist baseline.
5. Manage wishlist entries from the character editor.

The first release should improve decisions without claiming to simulate the EverQuest combat engine. Full character totals and DPS forecasts come later, only where their assumptions can be shown and tested.

## What Loot Captain already supports

- Item-level AC, HP, mana, endurance, attack, base attributes, heroic attributes, resists, haste, damage, delay, and several item modifiers.
- HP, mana, and endurance regeneration from RaidLoot `/tick` text.
- Class eligibility, paired slots, one-hand/two-hand layouts, and per-slot comparison targets.
- Versioned per-character score formulas, with the legacy global setting as a fallback.
- Weapon `Damage / Delay` ratio and ratio delta. This is a useful proxy, not a DPS forecast.
- A local per-character Loot Captain wishlist with RaidLoot and live OpenDKP highlighting. This is separate from RaidLoot's own wishlist.
- Cached canonical numeric stats and structured effects for wishlist comparisons; scores are never cached.

Important gaps:

- OpenDKP does not provide every stat or effect consistently.
- Some focus, proc, worn, click, and other named effects remain unresolved or informational rather than scoreable.
- Wishlist entries preserve canonical numeric stats and structured effects when available; missing source data remains unresolved.
- Profiles can contain worn augments, but do not contain complete base character totals, AAs,
  buffs, caps, or combat assumptions.
- Role presets and character-mechanics projections remain future work; current formulas are ranking preferences.

The original implementation notes below predate multi-character comparison. They are retained
as history; current selection uses multiple checked profiles (`compareProfileIds`) and has no
single active-character assumption. The follow-up work is defined in the linked plans below.

## 1. Local wishlist (implemented)

Historical note: this section was written when one active character controlled highlighting.
Current behavior supports a checked comparison set and a character picker for wishlist actions;
cross-character comparison is implemented. The acceptance wording below is retained as the
original implementation record.

### Scope

The wishlist belongs to a local character profile. It does not modify RaidLoot's account wishlist, submit bids, sync with a guild, or send wishlist data anywhere.

Each entry stores source identity plus cached canonical item data needed for comparison, never a frozen score:

```js
profile.wishlist = [{
  raidlootId: "12345",
  opendkpHost: "",
  opendkpId: "",
  name: "Example Item",
  slot: "Head",
  isAugment: false,
  augmentTypes: [],
  stats: { HP: 100 },
  effects: [],
  addedAt: 1787443200000
}];
```

Scores must be recalculated from the current profile and its current formula. This prevents stale wishlist rankings after gear or scoring changes. When an item is resolved from another source, merge its discovered identity and richer canonical data into the existing entry.

Identity matching order:

1. RaidLoot item ID.
2. OpenDKP hostname plus item ID.
3. Normalized item name plus canonical slot.

When the same item is later resolved from another source, merge the discovered IDs into the existing entry. OpenDKP and RaidLoot IDs must not be assumed to share a namespace.

### User experience

- Add or remove a candidate with an accessible star button on RaidLoot and OpenDKP item details, tables, and tooltips.
- Allow identity-only wishlist additions when stats cannot be resolved yet.
- Highlight wanted items in RaidLoot and live OpenDKP auction rows with a gold treatment and a clear `Wanted` marker.
- Compare a candidate directly with a compatible wishlist baseline alongside the existing equipped-item comparison; select a baseline when multiple targets are available.
- Historical wording: “Highlight only for the active character.” Current behavior highlights
  against the selected comparison set; guild-wide synchronization remains deferred.
- Show wishlist count and a simple remove/manage list in the character editor.
- Do not reorder OpenDKP auction tables; highlighting must not interfere with the site's bidding UI.

### Acceptance criteria

1. An item added on RaidLoot is highlighted when the same item appears on OpenDKP, and vice versa when identity can be resolved.
2. Adding the same item twice does not create duplicates.
3. Switching the active character immediately switches wishlist highlights.
4. Missing stats do not prevent add/remove or highlighting.
5. Wishlist data remains local and is removed with its character profile.
6. RaidLoot's native wishlist continues to work independently.
7. A candidate can be compared with a compatible wishlist baseline without changing existing equipped-item comparisons.
8. An unresolved wishlist item remains marked and reports unavailable stats instead of being discarded.

### Editor presentation

The wishlist is a tab in the inventory strip rather than a section of its own, tinted gold
so it never reads as worn gear. It offers two styles, remembered in `wishlistStyle`: a
game-style slot grid, which makes an empty slot read as "nothing wanted here yet" at a
glance, and a plain list. The grid is built separately from the worn-equipment grid, which
is tied to item indices, augment parenting and selection that wishlist entries do not have.

The style switch belongs to the wishlist tab alone, and it carries its own `display` rule.
That rule outranks the browser's `[hidden] { display: none }`, so the `[hidden]` case has to
be restated in CSS -- setting the property alone leaves the switch on screen for every tab.

## 2. Mark obtained / equip in local profile (implemented)

An actionable comparison row should offer `Equip in <slot>`. This updates Loot Captain's local profile; it does not change the character in EverQuest.

Rules:

- Re-read the latest stored profile before mutation so a stale page cannot overwrite newer edits.
- Sanitize the page-derived item into the existing profile item shape.
- Show the exact old and new item names before replacing an occupied slot.
- For ear, wrist, and finger items, replace the comparison row's selected target only.
- For one-hand weapons, expose separate primary and secondary actions.
- Never silently replace both weapon slots.
- Append into a genuinely empty slot.
- After a successful equip, remove the matching wishlist entry and rerun page annotations.
- Reject unresolved or invalid replacements rather than saving partial item data.

Acceptance criteria:

1. The selected worn item is replaced and every open annotation refreshes from storage.
2. Paired-slot and weapon replacements affect exactly one intended slot.
3. A replacement confirmation names both items and the slot.
4. A failed save leaves the original profile and wishlist unchanged.

### How it was built

An `Equip` button sits in each comparison row's panel header and expands in place into a
`Replace <old> with <new>?` confirmation, so no browser dialog is used. The whole mutation
runs in the service worker under `EQUIP_ITEM`, inside the same queue as the wishlist
mutations, and re-reads storage before writing.

The worn item is addressed by its **index in `profile.items`**, not by slot. An
`/output inventory` import stores the same slot string for both halves of a paired slot,
and two identical earrings is a normal setup, so neither slot nor name can identify one
half on its own. The index travels with an identity assertion (`id`, `name`, `slot` of the
item the page saw at that index); a mismatch rejects the equip and writes nothing, which is
what keeps a stale page from overwriting the wrong item.

An item the character already owns shows a disabled `Equipped` chip instead of a button.
That is not only cosmetic: the row's comparison target can be the other half of a paired
slot, so offering to equip an owned item there would add a second copy rather than replace
anything.

Comparing an equipped item against itself only ever produces a table of zeroes, so the
panel says `Already equipped in <slot>` instead of drawing one.

Equipping happens on a RaidLoot or OpenDKP tab but lands in storage the character editor is
showing, so the editor's `storage.onChanged` handler refreshes worn items, not just the
wishlist; otherwise an open editor keeps displaying the old gear indefinitely. A hand edit
in progress wins, so it is never discarded by an incoming change. In the grid every slot
keeps its label -- several items otherwise truncate to the same prefix with no way to tell
which slot is which -- and the slot the last equip touched is marked.

Undo lives in the character editor, not on the item page. On a page it would be permanent
furniture with no natural end, and it would silently retarget whenever something else was
equipped. The worker stores one level of undo per character in `profile.lastEquip`,
describing only what that equip touched -- the replaced item, the index, and the wishlist
entry it consumed -- so a later profile edit is not rolled back with it. An undo whose
index no longer holds the equipped item is refused rather than applied to whatever now
sits there.

Two rules are load-bearing and easy to lose in a refactor:

- The **stored** slot wins over the candidate's. A one-hand candidate carries
  `Primary, Secondary`, and writing that back would make the item match both weapon rows.
- A replaced augment inherits the `parentId` and `augSlot` of the augment it replaces, so a
  page cannot relocate it; replacing a parent item re-points the augments that referenced it.

## 3. Follow-up plan index

Sections 3–7 are split into bounded plans so implementation and research can proceed
independently. The order below is the safe execution order; plans marked research are gates,
not permission to ship a speculative model.

| Plan | Status | Depends on | Outcome |
| --- | --- | --- | --- |
| [01 Missing-data semantics](plans/wishlist-scoring/01-missing-data.md) | Implemented | — | Known zero, unknown, provenance, and conservative score availability |
| [02 Per-character formulas](plans/wishlist-scoring/02-per-character-formulas.md) | Implemented | 01 | Versioned profile formulas and multi-character comparison rules |
| [03 Role presets and breakdown](plans/wishlist-scoring/03-role-presets-and-breakdown.md) | Design needed | 01, 02 | Weight design, class suggestions, transparent contributions |
| [04 Informational effects](plans/wishlist-scoring/04-informational-effects.md) | Implemented | 01 | Worn/click/unknown effect preservation and comparison |
| [05 Projection evidence](plans/wishlist-scoring/05-projection-evidence.md) | Research complete; calibration pending | — | Beastlord evidence review; HP/mana/ATK still unvalidated |
| [05A Character inputs and calibration](plans/wishlist-scoring/05a-character-inputs.md) | Implemented | 05 input contract | Local snapshots, AA checklist, reversible-swap records and export |
| [05B Versioned rules and AA selection](plans/wishlist-scoring/05b-validated-rules.md) | Reference estimates implemented | 05A optional; reference assumptions | HP/mana/ATK/endurance model, AA defaults; optional calibrated Accuracy |
| [05C Character projection panel](plans/wishlist-scoring/05c-projection-panel.md) | Reference estimates implemented | 05B | Compact estimates without calibration; optional calibrated Accuracy |
| [06 Weapon throughput feasibility](plans/wishlist-scoring/06-weapon-throughput.md) | Research gate | 04 if procs are included | Sourced assumptions and a feasibility decision |

Plans 01→02→03 are the scoring track. Plan 04 can run after 01 and before 03 if effect
rows are needed in the same UI. Plans 05 and 06 may run independently, but their research
results must be reviewed before implementation. Avoid simultaneous edits to shared files;
each implementation plan names likely conflicts and should land separately.

### Deferred scope

Full character simulation, automatic AA/buff/tribute/combat-log collection, a custom formula
builder, guild or cloud synchronization, bid submission, universal best-in-slot ranking, and
any projection or DPS number without its evidence gate remain deferred.

## Current checkpoint and next steps

See [checkpoint and next steps](plans/wishlist-scoring/checkpoint-and-next-steps.md) for shipped
scope, model limits, plan 03 (role presets/breakdown), and the subsequent DPS estimate work.
