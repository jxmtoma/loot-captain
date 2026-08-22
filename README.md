# Loot Captain

Loot Captain is a Manifest V3 Chrome/Edge extension for comparing EverQuest gear against local character profiles. It adds upgrade, downgrade, and stat-diff badges to RaidLoot and OpenDKP pages.

## Features

- Store multiple character profiles locally.
- Import worn gear from a RaidLoot profile or an EverQuest `/output inventory` file.
- Compare item stats with slot-aware scoring, including paired ears, wrists, and fingers.
- Enrich missing item stats from public RaidLoot item pages.
- Annotate OpenDKP item pages, tables, and tooltips.

## Data and privacy

Profiles, settings, and item caches are stored in `chrome.storage.local`. The extension has no account, analytics, tracking, advertising, or remote code. It requests public RaidLoot pages only when importing profiles or looking up item stats; it does not send browser cookies or authenticated credentials. OpenDKP page data is used to annotate the current page, and an item name may be sent to RaidLoot for an exact-name lookup.

See [the privacy policy](docs/privacy-policy.md).

## Permissions

| Permission or match | Why it is needed |
| --- | --- |
| `storage` | Store local profiles, settings, and cached public item data. |
| `offscreen` | Parse fetched RaidLoot HTML with `DOMParser` from the MV3 service worker. |
| RaidLoot host permission | Fetch public RaidLoot profile and item pages for imports and stat enrichment. |
| OpenDKP content-script matches | Read the current OpenDKP item UI/API responses and add comparison badges; no OpenDKP host permission is requested. |

## Development

Load the repository as an unpacked extension from `chrome://extensions` or `edge://extensions`, then open the options page to create a profile.

Run the dependency-free regression check with:

```sh
node tests/regression.js
```

The Chrome Web Store ZIP should contain only `background/`, `content/`, `icons/`, `options/`, `popup/`, and `manifest.json`. Upload the screenshots and promotional tiles from `store-assets/`, plus `docs/store-listing.md` and the privacy policy, separately. The legacy standalone userscript is intentionally not part of the release.
