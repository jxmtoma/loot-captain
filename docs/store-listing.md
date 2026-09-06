# Chrome Web Store listing package

## Product details

### Single purpose

Compare EverQuest gear against local character profiles and show slot-aware upgrade and stat differences on RaidLoot and OpenDKP pages.

### Detailed description

Compare EverQuest gear before you spend raid time or currency.

Loot Captain helps you:

- Import worn gear from a public RaidLoot profile or an EverQuest `/output inventory` file.
- Manage multiple character profiles and choose your scoring formula.
- See upgrade, downgrade, and per-stat differences on RaidLoot and OpenDKP.
- Compare numeric stats, augments, spell focus effects, weapon procs, and Damage/Delay ratio.
- Handle paired ear, wrist, and finger slots automatically.
- Save a local wishlist and highlight wanted items in RaidLoot and OpenDKP auctions.
- Equip a won item into a local profile straight from its comparison row, with undo in the character editor.
- Fill in missing item stats from public RaidLoot pages.
- Resolve statless armor tokens through 630 offline, source-reviewed mappings covering PoP, GoD, OoW, PoR, TSS, UF, HoT and VoA plus RoF through ToB.

Profiles and settings stay in browser-local storage. Loot Captain has no account, analytics, tracking, advertising, or remote code.

Support ongoing development: https://github.com/sponsors/jxmtoma

### What's new in 0.4.0

- Equip an item into a local character profile from its comparison row on RaidLoot or OpenDKP, with an inline confirmation naming both items. An item the profile already holds shows as equipped instead, and the character editor offers a one-step undo of the most recent equip. This updates Loot Captain's stored profile only; it does not change the character in EverQuest.
- Moved the wishlist into the character editor's inventory tab strip, shown as a game-style slot grid or a plain list.
- Replaced the options page's single active character with a per-row Compare checkbox that shares the popup's selection, added a "Fresh from RaidLoot" button on rows imported from a RaidLoot profile, and dropped deleted characters from the compare selection.
- Extended the statless armor-token catalog back to Planes of Power: 357 to 630 offline mappings adding PoP, GoD, OoW, PoR, TSS, UF, HoT and VoA. PoP and TSS templates are scoped to an armor type rather than every class, so a token a class cannot use is refused instead of resolving to the wrong piece.
- Compare panels, wishlist panels, and pickers now close when clicking elsewhere on the page, while the wishlist character picker stays open while characters are selected.

The armor catalog uses offline, source-reviewed definitions; it does not use a live crawler or request new permissions. Incomplete or unavailable RaidLoot sets remain unresolved. This release adds no permissions and no new hosts.

### Category and language

- Category: `Productivity`
- Language: `English`
- Website: `https://jxmtoma.github.io/loot-captain/`
- Support URL: `https://jxmtoma.github.io/loot-captain/support.html`

## Permission justifications

- `storage`: store user-created profiles, score settings, and fetched public item stats locally.
- `offscreen`: parse fetched RaidLoot HTML with `DOMParser` from the MV3 service worker.
- `https://www.raidloot.com/*`: fetch public profile and item pages for imports and stat enrichment.
- RaidLoot content-script matches: annotate item pages and lists on `raidloot.com` and `www.raidloot.com`.
- OpenDKP content-script matches: read the current page's item UI/API responses and add comparison badges. No OpenDKP host permission is requested.
- Remote code: `No, I am not using remote code.`

## Privacy practices fields

Use these values in the Developer Dashboard and keep them consistent with [the privacy policy](privacy-policy.md):

- Single purpose: the description above.
- Data collected: no developer-side collection, sale, advertising, analytics, or tracking. The extension handles character/profile names, user-entered/imported gear profiles, per-character wishlist item identities and cached stats/effects, selected-character settings, and public RaidLoot results in browser-local storage. Current-page item names and stats are read locally; item names may be sent automatically to RaidLoot when an import, profile open, wishlist enrichment, or comparison needs missing stats. On a class-specific statless armor-token cache miss, the selected character class and public armor-set query may also be sent to RaidLoot; the result is cached locally.
- Personally identifiable information: `Yes` — character/profile names are handled locally in extension storage and are not sent to the developer.
- Health or financial information: `No`.
- Authentication information: `No`.
- Personal communications: `No`.
- Location: `No`.
- Web browsing activity: `No`.
- Website content: `Yes` — current-page item names, stats, and effects are read locally, and worn-item names, candidate-item names, wishlist controls/highlights, badges, and comparisons are rendered into the visited-page DOM. Item names may be sent to RaidLoot for a missing-stat lookup; no page history is collected.
- Limited Use: Loot Captain complies with the Chrome Web Store User Data Policy and uses data only to provide local EverQuest gear comparison on the current page. It is not sold, used for advertising, credit, insurance, lending, price discrimination, or unrelated personalization.
- Certification: certify that the extension complies with the Chrome Web Store User Data Policy and Limited Use requirements.
- Privacy policy URL: `https://jxmtoma.github.io/loot-captain/privacy-policy.html` (enable the repository's GitHub Pages workflow before submission).

## Graphic assets

The repository includes current, correctly sized PNGs in `store-assets/`:

| File | Size | Dashboard use |
| --- | ---: | --- |
| `screenshot-options-1280x800.png` | 1280 × 800 | Character/profile management screenshot |
| `screenshot-character-select-1280x800.png` | 1280 × 800 | Character selection and import screenshot |
| `screenshot-comparison-1280x800.png` | 1280 × 800 | RaidLoot comparison screenshot |
| `screenshot-opendkp-1280x800.png` | 1280 × 800 | OpenDKP comparison screenshot |
| `promo-small-440x280.png` | 440 × 280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400 × 560 | Marquee promo tile |

The store icon is `icons/icon128.png`. A YouTube promotional video link remains a manual listing step because no video is included in this repository.

## Release submission checklist for 0.4.0

- Run `node tests/regression.js`.
- Run `python3 tools/generate_armor_token_catalog.py --check`.
- Run `swift tools/generate_store_visuals.swift` from the repository root when the UI changed, and re-upload the refreshed screenshots.
- Run `./tools/package-extension.sh` and confirm `dist/loot-captain-v0.4.0.zip`. The script keeps only the newest two archives, so the previous release stays available to roll back to.
- Load unpacked for a smoke test, profile switch, and variant check before manually uploading to the Chrome Web Store / Edge.
- Verify the hosted privacy policy before submission.
