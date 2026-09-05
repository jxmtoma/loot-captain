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
- Fill in missing item stats from public RaidLoot pages.
- Resolve statless armor tokens through 630 offline, source-reviewed mappings covering PoP, GoD, OoW, PoR, TSS, UF, HoT and VoA plus RoF through ToB.

Profiles and settings stay in browser-local storage. Loot Captain has no account, analytics, tracking, advertising, or remote code.

Support ongoing development: https://github.com/sponsors/jxmtoma

### What's new in 0.2.0

- Added 357 statless armor-token mappings covering RoF plus CoTF through ToB.
- Added class-specific RaidLoot caching and native variants, plus ordinary lookup caching.
- Added OpenDKP live-auction tab badges and wanted-item highlights, with name-slot parsing fixes.

The armor catalog uses offline, source-reviewed definitions; it does not use a live crawler or request new permissions. Incomplete or unavailable RaidLoot sets remain unresolved.

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

## Release submission checklist for 0.2.0

- Run `node tests/regression.js`.
- Run `python3 tools/generate_armor_token_catalog.py --check`.
- Run `./tools/package-extension.sh` and confirm `dist/loot-captain-v0.2.0.zip`.
- Load unpacked for a smoke test, profile switch, and variant check before manually uploading to the Chrome Web Store / Edge.
- Verify the hosted privacy policy before submission.
