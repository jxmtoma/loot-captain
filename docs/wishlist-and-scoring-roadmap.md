# Wishlist and character-aware scoring roadmap

Status: local wishlist, numeric stat coverage, and equip-in-profile implemented; remaining
sections are roadmap, 2026-09-05.

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
- Fixed score formulas selected globally for the extension.
- Weapon `Damage / Delay` ratio and ratio delta. This is a useful proxy, not a DPS forecast.
- A local per-character Loot Captain wishlist with RaidLoot and live OpenDKP highlighting. This is separate from RaidLoot's own wishlist.
- Cached canonical numeric stats and structured effects for wishlist comparisons; scores are never cached.

Important gaps:

- OpenDKP does not provide every stat or effect consistently.
- Some focus, proc, worn, click, and other named effects remain unresolved or informational rather than scoreable.
- Wishlist entries preserve canonical numeric stats and structured effects when available; missing source data remains unresolved.
- Profiles do not contain base character totals, AAs, buffs, caps, augments, or combat assumptions.
- The selected score formula is global, even though profiles can represent different classes and roles.

## 1. Local wishlist (implemented)

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
- Highlight only for the active character. Cross-character and guild-wide wishlists are deferred.
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

## 3. Per-character and role-specific scoring

### Per-character selection

Move formula selection from one global setting to each profile, with the current global formula as a migration fallback. The popup should edit the active character's formula.

### Role presets

Class alone is not enough: hybrids and some classes can serve more than one role. Suggest a default from class, but let the user choose.

Initial presets:

- Tank survivability
- Melee DPS
- Caster DPS
- Healer
- General / raw comparison

Each preset is an explicit, versioned set of weights. The comparison panel must show which stats contributed to the score. Presets are ranking preferences, not claims about exact game mechanics.

Do not ship a custom formula builder initially. Add it when the presets demonstrably cannot cover real users.

### Existing-stat cleanup

Before adding more weights, make current coverage consistent:

- Add ATK, HP regen, mana regen, and endurance regen to ordered display and OpenDKP normalization.
- Preserve direct item pools separately from heroic stats.
- Treat caps and over-cap values explicitly; do not reward a stat that cannot affect the selected character.
- Keep raw and normalized values so source parsing can be diagnosed.
- Replace the current unitless `Net positive` behavior before making it a recommended preset; one HP, one AC, and one heroic point are not equivalent units.

## 4. More stats and item effects

Numeric stats can use the existing delta engine once both sources normalize them consistently. Named effects need a different representation.

### Numeric

- ATK
- Endurance
- HP, mana, and endurance regeneration
- Accuracy, avoidance, combat effects, shielding, spell shielding, and related modifiers when a trustworthy source exposes them
- Heal Amount, Spell Damage, Clairvoyance, Purity, Luck, and Haste

### Structured effects

- Focus effects
- Procs
- Worn effects
- Click effects
- Instrument, pet, healing, spell-damage, mana-preservation, and duration modifiers

Store structured effects as `{ type, name, rank, raw }`. Compare effect names and ranks informationally first. Do not convert an effect to score or DPS until its stacking, caps, level range, and class applicability are modeled.

This matters because focus effects can change spell power, mana cost, cast time, duration, pets, and healing in different ways; a single generic `Focus = N` weight would be misleading. The [official EverQuest focus overview](https://www-cdn.everquest.com/guides/eq-2026-frostreaver-ruleset-faq#early-item-focus-effects) illustrates these distinct behaviors.

## 5. Effective character stats, not fictional precision

“Full stats” should be split into three confidence levels.

### Level A — exact item delta

Show raw candidate-minus-worn values and named effect changes. This is the current foundation and can be made complete without knowing the character's AAs or buffs.

### Level B — derived gear projection

Show derived changes such as heroic-stat contributions only when we have:

- Character class, level, server/era, and relevant current totals.
- A versioned, cited rule for the conversion.
- Cap and breakpoint handling.
- A label distinguishing direct item stats from derived values.

Heroic stats do more than add simple item points. EverQuest folded accuracy, avoidance, combat effects, shielding, spell shielding, and other modifiers into heroic stats, with caps and post-cap behavior. See the [official stat-consolidation explanation](https://www.everquest.com/news/may-2016-patch-preview) and the [developer formula discussion for post-400 modifiers](https://forums.daybreakgames.com/eq/index.php?threads/heroic-stats-above-400-mod2s-calculated-incorrectly.266158/#post-4048886).

The practical input is an optional unbuffed character-stat snapshot. Static AA and base contributions then remain in the baseline while an item replacement changes only gear and documented derived effects.

### Level C — full character simulation

Defer. Exact displayed and combat-effective totals would require more than worn item pages: AAs, augments, power source, tribute, buffs, caps, stacking rules, server era, and possibly values not available through RaidLoot or OpenDKP.

Until those inputs exist, the UI must say `gear projection`, not `real full stats`.

## 6. DPS difference

Use progressive labels:

1. **Weapon ratio delta** — already implemented and trustworthy as a narrow comparison.
2. **Weapon throughput estimate** — may add known damage bonus, haste, and structured weapon procs, with assumptions shown.
3. **Character DPS forecast** — deferred until a validated model or combat-log calibration exists.

A credible character forecast would need at least class, level, weapon skill, attack, haste, accuracy, crit and multi-attack rates, dual-wield behavior, AAs, buffs, procs, abilities or spell rotation, encounter duration, and target mitigation. Caster DPS additionally requires focus-effect applicability and a rotation.

The UI should attach a confidence label to every number:

- `Exact` for raw item deltas.
- `Derived` for cited deterministic conversions.
- `Estimate` for assumption-based throughput.

Do not display a single “+X% DPS” number until it survives comparison with representative combat logs.

## 7. Estimated upgrade projection

Designed 2026-09-05, not yet built. This is the intended differentiator: every other
EverQuest gear tool stops at item stat deltas.

### The bet

Show a projected character-level impact — HP, mana, ATK — as an explicit **range**, not a
point value. Exactness is not the goal; changing a loot decision is. A range is honest
about what is knowable and still actionable, where a single fabricated number is neither.

### Why a range, and why the numbers are uncertain

No stat-to-HP/mana/ATK conversion has been published by Daybreak, and community values
disagree:

- Estimates for heroic stamina span roughly 12 to 29 HP per point, and disagree on whether
  the conversion steps every 5 points.
- Allakhazam's stats wiki describes the relationships qualitatively only, with no numbers.
- Forum threads concede the "accepted" mana formulas are not correct.
- The nearest concrete implementation is the EQEmu server source, a reverse-engineered
  emulator targeting older eras rather than live EverQuest.

That spread is not an obstacle — it *is* the range. `+180 to +435 HP` carries the `Estimate`
label from section 5, never `Exact` or `Derived`, and the bounds tighten as real
before/after values are measured in game. The feature improves with use instead of being
frozen at whatever the forums guessed.

### Data: two generated, source-cited tables

Follow the `tools/generate_armor_token_catalog.py` precedent — exact source-reviewed data,
not a live crawler, with a `--check` mode wired into `node tests/regression.js`. No new
permissions or hosts.

1. `STAT_COEFFICIENTS` — per class archetype, `{ stat: { low, high } }` for the HP / mana /
   ATK contribution per point, each entry carrying its citation. Base and heroic stats need
   separate coefficients. Measured in-game data points are recorded alongside the cited ones
   and narrow the bounds.
2. `AA_STAT_CAPS` — cap-granting AAs with the level at which each becomes available.

### Cap derivation

Base cap is 255 through level 60, then +5 per level (L70 = 305, L100 = 455). Add the AA
grants available at that level: Planar Power +5/rank across all seven, Innate Enlightenment
+10/rank INT/WIS, Planar Stats +5/rank, Fundament +1, DoN progression +10, CoTF achievements
+5/rank.

**Simplifying assumption: the character has bought every AA available at their level,
regardless of expansion.** This yields the upper bound of the cap, which pairs naturally
with a range-based projection. Refinement paths in order of value: per-expansion gating,
then user-entered ranks, then an optional AA count.

This is the only tractable route, because RaidLoot cannot supply a character's actual AAs.
RaidLoot profiles are inventory-only, built from an `/output inventory` dump of worn items,
and RaidLoot's separate AA database is a generic catalog filtered by class and level — it
describes what a character *could* buy, never what they *did*.

### Input

`profile.baseStats = { STR: { value, cap }, ... }` for the seven base stats — optional
totals read off the in-game character sheet, which shows value and cap together. When
absent, the projection falls back to the derived cap. `baseStats` must be added to the
`editingProfile` whitelist and to `saveProfile` in the options page, which rebuilds profiles
from a fixed field list and would otherwise drop it.

The input hint must say **unbuffed**: EverQuest shows buffed stats by default, and a buffed
value entered as the total over-reports how close a stat is to its cap.

### Open questions

- Which class archetypes map to which coefficient sets? The role presets in section 3 are
  the natural split, which argues for building them first or alongside.
- Does an at-cap stat contribute zero to both bounds, or only to the upper bound? The game
  displays the capped value, so over-cap headroom is invisible — a character at 455/455 may
  have 5 points of hidden headroom or 200.
- Where do measured in-game data points live so they stay reviewable?

## Recommended implementation order

1. Preserve profile metadata and add per-profile wishlist fields. (implemented)
2. Add local wishlist toggles, cross-source identity matching, highlights, editor management, and direct wishlist-baseline comparisons. (implemented)
3. Add safe per-row equip actions. (implemented)
4. Make numeric stat coverage consistent across RaidLoot, OpenDKP, storage, and display. (implemented)
5. Add per-character role presets with transparent score breakdowns.
6. Preserve and compare structured focus/proc/worn/click effects without scoring them.
7. Build the estimated upgrade projection in section 7: sourced coefficient and AA cap
   tables, an optional unbuffed stat snapshot, and range-labeled projections.
8. Extend the existing weapon ratio into an explicitly labeled throughput estimate.
9. Consider full DPS forecasting only after log-based validation.

## Explicitly deferred

- Automatic or remote bid submission.
- Guild-wide wishlist synchronization.
- Accounts or cloud sync.
- A custom scoring-formula editor.
- Automatic AA, buff, tribute, or combat-log collection.
- A universal “best in slot” verdict.

These should be added only when a real workflow requires them and the necessary data source is available.
