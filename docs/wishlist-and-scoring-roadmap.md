# Wishlist and character-aware scoring roadmap

Status: local wishlist implemented; remaining sections are roadmap, 2026-08-25.

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

## 2. Mark obtained / equip in local profile

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

## Recommended implementation order

1. Preserve profile metadata and add per-profile wishlist fields. (implemented)
2. Add local wishlist toggles, cross-source identity matching, highlights, editor management, and direct wishlist-baseline comparisons. (implemented)
3. Add safe per-row equip actions.
4. Make numeric stat coverage consistent across RaidLoot, OpenDKP, storage, and display.
5. Add per-character role presets with transparent score breakdowns.
6. Preserve and compare structured focus/proc/worn/click effects without scoring them.
7. Add an optional unbuffed baseline and a small set of sourced derived-stat rules.
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
