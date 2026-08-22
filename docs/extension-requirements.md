# Loot Captain browser extension

## Description

Loot Captain is a Chrome and Microsoft Edge extension for comparing EverQuest gear. It keeps character profiles locally, compares items shown on RaidLoot, and adds the same upgrade/downgrade stat diff to item previews on OpenDKP guild sites.

Profiles do not require a RaidLoot account. A profile can be created manually or imported from a RaidLoot profile (the default path) or an EverQuest `/output inventory` file. When an existing profile item has a RaidLoot item ID or name but no saved stats, the extension loads and caches the item stats when the profile opens or comparison starts.

## Requirements

- Target Chrome and Edge using Manifest V3.
- Store profiles, selected character, and score formula in extension-local storage.
- Support multiple local character profiles without requiring RaidLoot login.
- Import worn equipment from EverQuest `/output inventory` files.
- Import worn equipment and stats directly from a RaidLoot profile URL or ID.
- Compare RaidLoot item previews and item pages against the selected profile.
- Show slot-aware stat differences, including paired ear, wrist, and finger slots.
- Show OpenDKP item differences in item detail pages, tables, and hover popups.
- Normalize common EverQuest stat and slot names before comparison, including heroic stats and regen values.
- Cache RaidLoot item lookups to avoid repeated requests.
- Keep the profile data local; RaidLoot is used only as the public source for item stats.
- Use an original dark-fantasy RPG visual language: slate/stone surfaces, bronze-gold accents, and restrained teal highlights.

## Required permissions and integrations

- `storage` for local profiles and cached item data.
- `offscreen` for DOMParser-based RaidLoot HTML parsing from the MV3 service worker.
- RaidLoot host access for profile/item reads.
- OpenDKP content-script matches for page annotations; no OpenDKP host permission is requested.
- A page-world request bridge for OpenDKP sites that load item data through their app API.

## Acceptance criteria

1. Importing an inventory without fetching stats still produces a real comparison after the extension loads the imported item IDs from RaidLoot.
2. RaidLoot shows the selected profile item and a correct per-stat/score diff, not a comparison against an empty item.
3. OpenDKP item detail pages and hover previews show a diff badge when the item name, slot, and stats can be read.
4. An empty profile slot is reported only when the selected profile truly has no item in that slot.
5. A profile item with a name but no RaidLoot ID can still be auto-enriched by exact-name lookup.
6. Opening an existing profile shows fetched numeric stats in its item editor and caches them locally.

## Current limitations

- OpenDKP does not provide a universal item-stat API contract, so popup parsing relies on the rendered tooltip text and a RaidLoot name lookup when needed.
- Items with no usable ID/name or no matching RaidLoot item cannot be auto-enriched; their stats must be entered in the profile editor. Import diagnostics in the options page show the failed lookup reason.
- The first comparison for uncached imported items may take a few seconds while RaidLoot item pages are fetched.
