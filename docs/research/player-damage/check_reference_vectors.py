"""Pinned synthetic checks for simple player-damage reference relationships.

This is explanatory math only; it is not a combat measurement or a retail
gameplay model.  Reference: https://github.com/EQEmu/EQEmu/blob/4aceae18b94ffaafc08e2b17bc41cd72c77f795d/zone/attack.cpp
(CheckDoubleAttack, TryCriticalHit) and bonuses.cpp highest-bonus stacking.
"""

import math


def _finite(value):
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("value must be finite")
    return float(value)


def _clamp(value, low=0.0, high=1.0):
    value = _finite(value)
    return max(low, min(high, value))


def double_attack(skill, level, give_pct, bonus_pct):
    """Synthetic DA relationship, with percentage bonuses applied together."""
    skill = _finite(skill)
    level = _finite(level)
    give_pct = _finite(give_pct)
    bonus_pct = _finite(bonus_pct)
    bonus = (give_pct + bonus_pct) / 100
    if skill == 0 and give_pct == 0:
        return 0.0
    raw = ((skill + level) / 500) * (1 + bonus) if skill > 0 else bonus
    return _clamp(raw)


def strongest_worn_bonus(bonuses):
    """Return the strongest positive worn bonus; unknown values are invalid."""
    values = [_finite(value) for value in bonuses]
    return max((value for value in values if value > 0), default=0.0)


def crit_chance(base_chance, other_bonus_pct, cleave_pct):
    """Synthetic already-eligible crit relationship; no retail DEX claim."""
    base_chance = _finite(base_chance)
    other_bonus_pct = _finite(other_bonus_pct)
    cleave_pct = _finite(cleave_pct)
    return _clamp(base_chance * (1 + (other_bonus_pct + cleave_pct) / 100))


def crit_multiplier(chance):
    """Illustrative 2x-crit assumption, not the EQEmu critical-damage formula."""
    return 1 + _finite(chance)


def main():
    def close(actual, expected):
        assert math.isclose(actual, expected, rel_tol=0, abs_tol=1e-12), (actual, expected)

    assert double_attack(150, 100, 0, 9) == 0.545
    assert double_attack(150, 100, 0, 12) == 0.56
    assert double_attack(0, 100, 30, 9) == 0.39
    assert double_attack(0, 100, 30, 12) == 0.42
    assert double_attack(0, 100, 0, 18) == 0

    crit_120 = crit_chance(0.05, 0, 120)
    crit_160 = crit_chance(0.05, 0, 160)
    close(crit_120, 0.11)
    close(crit_160, 0.13)
    close(crit_multiplier(crit_120), 1.11)
    close(crit_multiplier(crit_160), 1.13)

    strongest = strongest_worn_bonus([120, 240, 160])
    assert strongest == 240
    assert crit_chance(0.05, 0, strongest) == crit_chance(0.05, 0, 240)

    for invalid in (None, float("nan"), float("inf"), -float("inf")):
        try:
            strongest_worn_bonus([120, invalid])
        except ValueError:
            pass
        else:
            raise AssertionError("unknown or non-finite bonus must be rejected")

    print("Synthetic reference checks passed; this is not a combat measurement.")


if __name__ == "__main__":
    main()
