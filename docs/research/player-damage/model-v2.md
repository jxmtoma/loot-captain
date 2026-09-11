# Player melee and weapon-proc reference model — v2

This increment implements 06D's melee and supported weapon-proc slices for level-100
Beastlords. It is a reference estimate, not a combat meter or retail-engine replica.
Spell damage/focus remains a separate later increment. Pet damage is excluded.

## Compatibility and shared inputs

New unsaved scenarios use v2. Saved v1 scenarios keep their weapon-only semantics;
**Enable gear stats and procs**, followed by an explicit save, upgrades a scenario.
The upgrade retains the existing hand inputs and revision while adding the new fields.
No viewing, calculating or confirming operation writes a scenario or equipment.

The same target and combat configuration apply to both gear sets. A replacement changes
exactly one stored item, preserving its actual slot. The model includes unchanged augment
stats but does not simulate socket compatibility or augment transfers. Weapon layout
changes and augment replacements remain unsupported.

## Melee changes

Gear totals use ATK, STR, DEX, HSTR and HDEX. As in the earlier stat-reference model,
omitted RaidLoot/legacy fields are treated as zero by an explicit estimate assumption;
unreadable values and missing fields in partial OpenDKP data remain unknown.

Ordinary STR/DEX are capped before adding their heroic counterparts. Offense uses a
shared base, a STR term and capped worn ATK. Expected damage-roll changes are calculated
against the same target mitigation. The implementation computes the expectation of the
20 outcomes using 19 tail probabilities instead of sampling or a large nested loop.

Critical chance uses the non-innate Beastlord branch and DEX-dependent thresholds.
The configured critical damage multiplier is an illustrative expected multiplier,
not the emulator's entire critical-hit damage pipeline. Ferocity follows the skill
or granted-double-attack branch selected by the scenario. Cleave and Ferocity use
the strongest supported worn effect, never a sum of duplicate ranks.

The numerical relationships come from pinned
[attack.cpp](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/attack.cpp),
[bonuses.cpp](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/bonuses.cpp),
[random.h](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/common/random.h)
and [ruletypes.h](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/common/ruletypes.h).
They establish this chosen reference model, not the user's server behavior.

### Avoiding double counting

The existing hand scenario describes the current melee baseline. Gear-derived changes
adjust it by candidate/current ratios:

```text
rollRatio = expectedRoll(afterOffense, targetMitigation) / expectedRoll(beforeOffense, targetMitigation)
critRatio = expectedCritFactor(after) / expectedCritFactor(before)
attackRatio = (1 + doubleAttackChance(after)) / (1 + doubleAttackChance(before))
candidateDPS = baseAttackRate × attackRatio ×
  (candidateDamage × baseDamageCoefficient × baseMitigation × rollRatio × critRatio
   + baseDamageBonus + supportedFlatBonusChange)
```

The current baseline therefore stays intact. Existing expected attack counts and damage
coefficients are not multiplied by the complete current bonuses a second time. Flat
Cleave changes use the reference flat-per-landed-strike convention. They are not scaled
again by the offense/critical ratios.

## Supported weapon procs

The [exact catalog](catalog.md) initially covers Force of Corruption VI, Strike of
Flames VI and Strike of Venom V. Proc damage is
`baseDamage × handPPM × expectedLandingMultiplier / 60`.
The rates are explicit realized-rate assumptions, not a derived DEX/Combat Effects
proc engine. Haste and melee hit chance are not applied again. The landing multiplier
represents the chosen resist/critical outcome assumptions. Unrecognized, conflicting,
conditional or duplicate proc records remain unresolved.

## Complete and partial results

- **Melee stats DPS:** the known stat-driven contribution across the equipped weapons;
  it holds current worn modifiers fixed and is explicitly labeled partial.
- **Melee DPS:** includes supported worn-effect changes only when the relevant lists
  are complete and contain no unresolved worn effects.
- **Weapon proc DPS:** requires complete active-weapon proc lists and supported identities.
- **Melee + procs DPS:** available only when both complete components are available.

The UI never substitutes one hand's result for an unavailable loadout result. Its compact
label uses the most complete available contribution and identifies partial results.
Stats and damage retain independent text colors on a neutral background.

## Comparison-specific confirmation

Imported effect lists can be incomplete. Details show both loadouts' item names, slots,
effects and completeness before offering confirmation. Worn-effect and weapon-proc
confirmations are independent, unchecked initially, and never saved in a shared scenario.

The service binds confirmation to the current equipment fingerprint, effect-completeness
flags, sanitized candidate and scenario. A change to any of those invalidates an old
confirmation. Present unresolved effects cannot be made supported by checking a box.

## Verification

Regression checks cover numerical reference vectors, exhaustive small damage-roll grids,
caps, ordinary versus heroic changes, strongest-effect coverage, proc identity/rate handling,
partial results, saved-v1 compatibility, upgrades and stale confirmations. Synthetic
fixtures remain outside real character storage. No controlled combat sample is claimed.

Live UI checks used Ereebus's existing equipment. Lone Walker's Cloak → Shivercloak
showed Stats +205 and a partial melee-stat change of about -0.13 DPS. Fearbrand → Tolvak
showed a partial melee-stat change of -11.03 DPS. After reviewing the listed base-weapon
procs, comparison-local proc confirmation produced 24 → 22.33 proc DPS (-1.67) at the
reference rates, independently of the unresolved worn-effect component. That confirmation
was cleared after the check. No equipment or shared scenario was saved during verification.
