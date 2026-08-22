# Chrome Web Store listing package

## Product details

### Single purpose

Compare EverQuest gear against local character profiles and show slot-aware upgrade and stat differences on RaidLoot and OpenDKP pages.

### Detailed description

Loot Captain is a local-first gear comparison tool for EverQuest players. Create or import character profiles, choose a scoring formula, and see whether an item is an upgrade before spending time or raid currency on it.

Profiles can be imported from a public RaidLoot profile or from an EverQuest `/output inventory` file. Missing item stats are looked up from public RaidLoot pages and saved in the local profile. On RaidLoot and OpenDKP pages, Loot Captain adds compact upgrade/downgrade badges and expandable per-stat comparisons, including paired ear, wrist, and finger slots.

Your profiles and settings stay in browser-local extension storage. Loot Captain has no account, analytics, tracking, advertising, or remote code.

### Category and language

- Category: `Productivity`
- Language: `English`

## Permission justifications

- `storage`: store user-created profiles, score settings, and fetched public item stats locally.
- `offscreen`: parse fetched RaidLoot HTML with `DOMParser` from the MV3 service worker.
- `https://www.raidloot.com/*` and `https://raidloot.com/*`: fetch public profile and item pages for imports and stat enrichment.
- OpenDKP content-script matches: read the current page's item UI/API responses and add comparison badges. No OpenDKP host permission is requested.
- Remote code: `No, I am not using remote code.`

## Privacy practices fields

Use these values in the Developer Dashboard and keep them consistent with [the privacy policy](privacy-policy.md):

- Single purpose: the description above.
- Data collected: no developer-side collection, sale, advertising, analytics, or tracking. The extension handles character/profile names, user-entered/imported gear profiles, selected-character settings, and public RaidLoot results in browser-local storage. Current-page item names and stats are read locally; item names may be sent automatically to RaidLoot when an import, profile open, or comparison needs missing stats.
- Personally identifiable information: `Yes` — character/profile names are handled locally in extension storage and are not sent to the developer.
- Health or financial information: `No`.
- Authentication information: `No`.
- Personal communications: `No`.
- Location: `No`.
- Web browsing activity: `No`.
- Website content: `Yes` — current-page item names and stats are read locally, and worn-item names, candidate-item names, badges, and stat differences are rendered into the visited-page DOM. Item names may be sent to RaidLoot for a missing-stat lookup; no page history is collected.
- Limited Use: Loot Captain complies with the Chrome Web Store User Data Policy and uses data only to provide local EverQuest gear comparison on the current page. It is not sold, used for advertising, credit, insurance, lending, price discrimination, or unrelated personalization.
- Certification: certify that the extension complies with the Chrome Web Store User Data Policy and Limited Use requirements.
- Privacy policy URL: `https://jxmtoma.github.io/loot-captain/privacy-policy.html` (enable the repository's GitHub Pages workflow before submission).

## Graphic assets

The repository includes upload-ready PNGs in `store-assets/`:

| File | Size | Dashboard use |
| --- | ---: | --- |
| `screenshot-options-1280x800.png` | 1280 × 800 | Character/profile management screenshot |
| `screenshot-comparison-1280x800.png` | 1280 × 800 | RaidLoot comparison screenshot |
| `promo-small-440x280.png` | 440 × 280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400 × 560 | Marquee promo tile |

The store icon is `icons/icon128.png`. A YouTube promotional video link remains a manual listing step because no video is included in this repository.
