# Loot Captain

Loot Captain is a Manifest V3 Chrome/Edge 109+ extension for comparing EverQuest gear against local character profiles. It adds upgrade, downgrade, and stat-diff badges to RaidLoot and OpenDKP pages.

## Features

- Store multiple character profiles locally.
- Import worn gear from a RaidLoot profile or an EverQuest `/output inventory` file.
- Compare item stats with slot-aware scoring, including paired ears, wrists, and fingers.
- Compare items against the characters you select, with a badge layout option: compact (best character inline + panel chips) or expanded (every character labeled in the row). Focus and proc effects are compared across all selected characters.
- Keep a per-character local wishlist; each selected character gets its own wishlist star on item pages, with comparison against any selected character's wishlist.
- Highlight wanted items in RaidLoot and live OpenDKP auctions, and manage the list in the character editor.
- Enrich missing item stats from public RaidLoot item pages.
- Resolve statless class-specific armor tokens to real RaidLoot armor, with locally cached set results.
- Annotate OpenDKP item pages, tables, and tooltips.

The armor-token catalog covers Rain of Fear (RoF), Call of the Forsaken (CoTF), The Darkened Sea (TDS), The Broken Mirror (TBM), Empires of Kunark (EoK), Ring of Scale (RoS), The Burning Lands (TBL), Torment of Velious (ToV), Claws of Veeshan (CoV), Terror of Luclin (ToL), Night of Shadows (NoS), Laurion's Song (LS), and The Outer Brood (ToB). It maps slot-specific dropped armor templates and selected verified crafted/lining families; generic all-slot ores and unrelated gear are intentionally out of scope. Records are exact source-reviewed data, not a live crawler, and `python3 tools/generate_armor_token_catalog.py --check` verifies the committed catalog. This coverage requires no new permissions or network hosts.

## Data and privacy

Profiles, settings, fetched public item stats, and per-character wishlist entries are stored in `chrome.storage.local`. Wishlist entries cache canonical numeric stats and effects for comparison, never scores; scores are recalculated from the active formula. The extension has no account, analytics, tracking, advertising, or remote code. It requests public RaidLoot pages only when importing profiles or looking up item stats; it does not send browser cookies or authenticated credentials. For a statless armor token, the selected character class and a public armor-set query may be sent to RaidLoot on the first resolution; the resulting set is cached locally. Allakhazam and EQResource are developer-time catalog sources only and are never contacted by the extension. OpenDKP page data is used to annotate the current page, and an item name may be sent to RaidLoot when missing stats are needed.

See [the privacy policy](docs/privacy-policy.md) or visit the public [extension details](https://jxmtoma.github.io/loot-captain/), [privacy](https://jxmtoma.github.io/loot-captain/privacy-policy.html), and [support](https://jxmtoma.github.io/loot-captain/support.html) pages.

The GitHub Pages site is in `docs/`. Enable **Settings → Pages → GitHub Actions** in the repository to publish it.

## Permissions

| Permission or match | Why it is needed |
| --- | --- |
| `storage` | Store local profiles, settings, and fetched public item stats. |
| `offscreen` | Parse fetched RaidLoot HTML with `DOMParser` from the MV3 service worker. |
| `www.raidloot.com` host permission | Fetch public RaidLoot profile and item pages for imports and stat enrichment. |
| RaidLoot content-script matches | Add comparisons on both `raidloot.com` and `www.raidloot.com`; these matches do not grant background fetch access. |
| OpenDKP content-script matches | Read the current OpenDKP item UI/API responses and add comparison badges; no OpenDKP host permission is requested. |

## Development

Load the repository as an unpacked extension from `chrome://extensions` or `edge://extensions`, then open the options page to create a profile.

Run the dependency-free regression check with:

```sh
node tests/regression.js
```

The regression check also runs the armor catalog freshness check.

Create the Chrome Web Store upload ZIP with:

```sh
./tools/package-extension.sh
```

The versioned archive is written to `dist/` and contains only the extension runtime files.

The Chrome Web Store ZIP should contain only `background/`, `content/`, `icons/`, `options/`, `popup/`, and `manifest.json`. Upload the current screenshots and promotional tiles from `store-assets/`, plus `docs/store-listing.md` and the privacy policy, separately. The legacy standalone userscript is intentionally not part of the release.
