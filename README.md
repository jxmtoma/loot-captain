# Loot Captain

Loot Captain is a Manifest V3 Chrome/Edge extension for comparing EverQuest gear against local character profiles. It adds upgrade, downgrade, and stat-diff badges to RaidLoot and OpenDKP pages.

## Features

- Store multiple character profiles locally.
- Import worn gear from a RaidLoot profile or an EverQuest `/output inventory` file.
- Compare item stats with slot-aware scoring, including paired ears, wrists, and fingers.
- Keep a per-character local wishlist, with direct comparison against equipped gear or a selected wishlist item.
- Highlight wanted items in RaidLoot and live OpenDKP auctions, and manage the list in the character editor.
- Enrich missing item stats from public RaidLoot item pages.
- Annotate OpenDKP item pages, tables, and tooltips.

## Data and privacy

Profiles, settings, fetched public item stats, and per-character wishlist entries are stored in `chrome.storage.local`. Wishlist entries cache canonical numeric stats and effects for comparison, never scores; scores are recalculated from the active formula. The extension has no account, analytics, tracking, advertising, or remote code. It requests public RaidLoot pages only when importing profiles or looking up item stats; it does not send browser cookies or authenticated credentials. OpenDKP page data is used to annotate the current page, and an item name may be sent to RaidLoot when missing stats are needed.

See [the privacy policy](docs/privacy-policy.md) or visit the public [extension details](https://jxmtoma.github.io/loot-captain/), [privacy](https://jxmtoma.github.io/loot-captain/privacy-policy.html), and [support](https://jxmtoma.github.io/loot-captain/support.html) pages.

The GitHub Pages site is in `docs/`. Enable **Settings → Pages → GitHub Actions** in the repository to publish it.

## Permissions

| Permission or match | Why it is needed |
| --- | --- |
| `storage` | Store local profiles, settings, and fetched public item stats. |
| `offscreen` | Parse fetched RaidLoot HTML with `DOMParser` from the MV3 service worker. |
| RaidLoot host permission | Fetch public RaidLoot profile and item pages for imports and stat enrichment. |
| RaidLoot image CDN host permission | Load public item icons in the profile editor. |
| OpenDKP content-script matches | Read the current OpenDKP item UI/API responses and add comparison badges; no OpenDKP host permission is requested. |

## Development

Load the repository as an unpacked extension from `chrome://extensions` or `edge://extensions`, then open the options page to create a profile.

Run the dependency-free regression check with:

```sh
node tests/regression.js
```

The Chrome Web Store ZIP should contain only `background/`, `content/`, `icons/`, `options/`, `popup/`, and `manifest.json`. Upload the screenshots and promotional tiles from `store-assets/`, plus `docs/store-listing.md` and the privacy policy, separately. The legacy standalone userscript is intentionally not part of the release.
