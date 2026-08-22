# Loot Captain Privacy Policy

Effective date: August 22, 2026

Loot Captain is a local-first browser extension for comparing EverQuest gear. This policy explains what the extension stores and what network requests it makes.

## Data handled

The extension stores the following in the browser's extension-local `chrome.storage.local` area:

- Character/profile names, class, level, equipment slots, item IDs, item names, and item stats entered or imported by the user.
- The selected character and score formula.
- Imported profile data and fetched public RaidLoot item stats used in comparisons.

The extension does not transmit or collect email addresses, passwords, payment information, precise location, browsing history, analytics identifiers, or advertising identifiers. Character and item names entered by the user are retained locally as part of the profile and may be sent to RaidLoot only when needed for an item lookup.

When a comparison is displayed, the extension renders the relevant worn-item and candidate-item names, badges, and stat differences into the DOM of the visited RaidLoot or OpenDKP page. This is local page rendering, not a separate collection of browsing history.

## Network use

When the user imports a profile or opens a profile/comparison that needs missing stats, the extension fetches public pages from `raidloot.com` to read profile and item information. An OpenDKP item name may be sent automatically to RaidLoot for an exact-name lookup. Requests do not include authenticated browser credentials or cookies.

On OpenDKP pages, the extension reads the visible item UI and the page's item-data responses to add a local comparison badge. That data is not sent to an OpenDKP server by the extension.

## Sharing and sale

Loot Captain does not sell, rent, or share user data with advertisers, data brokers, or other third parties. It has no analytics or tracking service.

## Limited Use

Loot Captain uses profile, item, and page data only to provide its single purpose: local EverQuest gear comparison on the current page. It does not use the data for advertising, credit, insurance, lending, price discrimination, or unrelated personalization. It does not sell or transfer the data to third parties except for the public RaidLoot lookup needed to provide the comparison described above.

Loot Captain complies with the Chrome Web Store User Data Policy and its Limited Use requirements.

## Retention and deletion

Local data remains in extension storage until the user deletes a profile, clears extension storage, or uninstalls the extension. Fetched public item stats may be refreshed or replaced automatically.

## Security

The extension uses the minimum declared permissions needed for local storage, public RaidLoot fetching, and local HTML parsing. It does not execute remotely hosted code.

## Changes

Changes to this policy will be published with a new extension release and reflected in the effective date above.

## Contact

For privacy questions, use the support contact published with the Chrome Web Store listing.

## Public policy URL

The intended stable HTTPS publication URL is `https://jxmtoma.github.io/loot-captain/privacy-policy.html`; it remains pending until GitHub Pages is enabled for the release repository.
