# 02 — Per-character formulas

Roadmap: [Wishlist and scoring roadmap](../../wishlist-and-scoring-roadmap.md)

Status: Implemented — 2026-09-07

## Objective

Move formula choice from one global value to each profile while keeping old profiles useful
and making multi-character comparisons honest.

## Dependencies

Plan 01. Use the existing formula registry in `content/shared/diff.js`; add a new registry
only if the current shared loading path cannot support it.

## Scope

- Store a versioned formula key on each profile. Validate both key and version, and visibly
  report an unknown future version instead of silently reinterpreting it. Resolve with this
  precedence: valid profile formula → valid global fallback → existing default.
- Make popup editing target an explicit profile, independent of the comparison set used by
  the page. A wishlist item is scored separately for each owner profile.
- Queue profile-field mutations with the latest stored value and retain stale-editor
  protection, so a late editor save cannot overwrite a newer formula choice.
- A failed save or deleted target writes nothing and preserves gear and wishlist data; storage
  events refresh an open editor. Changing a class does not overwrite an existing formula.
- Show formula key/version with each character result. Do not rank a “best” character across
  unequal formula keys or versions; use neutral multi-character badges in that case.
- Migrate without changing the current global formula's meaning for existing profiles.

## Non-goals

No role weights, custom formula builder, mechanics model, projection, or cross-account sync.
Do not remove the global setting until migration and fallback behavior are proven.

## Likely files

`content/shared/diff.js`, `content/shared/state.js`, `content/shared/ui.js`, `popup/popup.js`,
`popup/popup.html`, `options/options.js`, `background/service-worker.js`,
`content/raidloot.js`, `content/opendkp.js`, `manifest.json`, and `tests/regression.js`.

## Acceptance tests

- A profile formula overrides the global setting; an invalid profile key falls back in order.
- Unknown future versions are reported, not silently treated as an older formula.
- Popup changes the selected profile even when several profiles are checked for comparison.
- Two wishlist owners receive their own formula result.
- A stale editor save cannot revert a newer formula mutation.
- Failed saves and deleted targets leave gear and wishlist unchanged; storage events refresh.
- Changing a profile class preserves its existing formula.
- Mixed formula key/version results never produce a best-character winner; neutral badges show.
- Existing single-formula profiles migrate and render the same score for known-complete inputs.

## Definition of done

One shared resolver serves popup, page comparisons, wishlist scoring, and editor displays;
storage writes are serialized and guarded; regression coverage passes with `node
tests/regression.js`; no role-specific weights are introduced here.

## Implementation notes

The popup has an explicit scoring-character selector independent of the compared characters.
The editor also exposes the character formula; the existing global control remains a fallback.
`profile.scoreFormula = { key, version }` stores an explicit choice. Legacy profiles resolve
lazily using the global fallback and then the existing default, without changing saved gear.
All formula definitions and resolution use the shared registry in `content/shared/diff.js`.

`SET_PROFILE_FORMULA` is restricted to extension pages and runs in the profile mutation queue.
Ordinary profile saves preserve the latest stored formula, so stale editors and imports cannot
revert a popup change. Unsupported keys/versions remain stored and produce a visible fallback
warning. Mixed formulas suppress the cross-character winner; every owner still gets an
individual equipped/wishlist result and formula identity.

Validation: `node tests/regression.js` includes `tests/profile-scoring-effects.js`, which
checks the resolver, mutations, stale/failed/deleted saves, popup handlers, effect round trips,
completeness, and informational UI. Browser extension behavior was not tested live.
