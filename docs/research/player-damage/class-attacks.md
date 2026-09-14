# Optional class-attack estimates

Level-100 Berserker, Monk and Rogue v3 scenarios can include one base class
attack. Open **DPS assumptions**, expand **Frenzy estimate**, **Flying Kick
estimate** or **Backstab estimate**, check **Include**, review the shared inputs
and save. Older scenarios omit `classAttack` and retain their previous results.
Unchecking Include and saving removes the contribution. No profile is enabled
automatically.

The calculation is:

`base × landed multiplier × hit chance × expected strikes/use × uptime ÷ seconds/use`

The editable defaults (skill 400, 8 seconds/use, hit chance 0.8, multiplier 1,
uptime 1) are illustrative, not measured. Frenzy starts with three expected
strikes/use; the other two start with one. The effective cooldown already
includes haste/reuse reductions. The landed multiplier represents the chosen
mitigation and critical-damage average. No automatic AA, disc, ATK, worn-effect,
elemental/bane or skill-damage bonus scaling is applied to this contribution.
It remains a partial estimate even when every input is known.

Base-damage formulas follow the existing pinned EQEmu revision
`4aceae18b94ffaafc08e2b17bc41cd72c77f795d`:

- Frenzy: 27 at level 100 with a primary weapon. Weapon Damage does not scale
  this base. Expected strikes/use is a separate editable assumption.
- Flying Kick: `25 + floor(skill/9 + min(boot AC/25, skill/9))`. Only the base
  equipped boots are read; augment AC is excluded. Missing boot AC is unknown;
  an empty feet slot contributes zero boot AC.
- Backstab: `floor(weapon Backstab Dmg × (2 + skill × 0.02))`. An explicitly
  zero Backstab Dmg falls back to weapon Damage; an absent field stays unknown.
  Both primary weapons must be confirmed 1H piercing in the scenario. Two-hand
  layouts are rejected. Position availability belongs in uptime.

Sources: [GetBaseSkillDamage and attack handling](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/special_attacks.cpp)
and [base-damage constants](https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/common/ruletypes.h).
These are emulator reference formulas, not calibrated retail totals.

Each available attack row adds once to Player DPS. Missing attack inputs leave
the other melee/proc contributions visible. Discs, poisons, other kicks and
other class abilities remain excluded. Existing saved-scenario revision and
stale-write checks apply to the new optional inputs.

Synthetic checks cover all three formulas, gear deltas, unchanged gear,
cadence/uptime/strike scaling, missing inputs, input validation, import of
Backstab Dmg, and enabling/disabling through the editor. Live verification and
combat-log calibration remain pending.
