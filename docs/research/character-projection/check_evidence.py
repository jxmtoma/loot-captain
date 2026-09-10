"""Research checks only: no extension model, and no claim of live-game validation."""
import json
import math
from pathlib import Path


def accuracy_reference(heroic_dexterity):
    """Post-400 developer reference; reject every unreviewed input range."""
    if type(heroic_dexterity) is not int or not 400 <= heroic_dexterity <= 4000:
        return None
    return 151 + (heroic_dexterity - 400) * 149 // 3600


def scaled_interval(delta, low, high):
    if not all(math.isfinite(x) for x in (delta, low, high)) or low > high:
        return None
    return tuple(sorted((delta * low, delta * high)))


def capped_interval(value, old_cap, new_cap, delta):
    """Synthetic clamp(x, 0, cap), not an EQ stat formula or floor assumption."""
    if not all(math.isfinite(x) for x in (value, old_cap, new_cap, delta)):
        return None
    if not 0 <= value <= old_cap or new_cap < 0:
        return None
    lower = min(new_cap, max(0, value + delta)) - value
    return (lower, lower if value < old_cap else new_cap - value)


def snapshot_reason(snapshot, expected):
    """Executable examples of the proposed binding rules, not app validation."""
    if not snapshot:
        return "missing snapshot"
    for field in ("class", "level", "server", "expansion", "patch", "equipmentDigest"):
        if snapshot.get(field) is None or expected.get(field) is None:
            return "missing " + field
        if snapshot[field] != expected[field]:
            return "stale or mismatched " + field
    if snapshot.get("unbuffed") is not True or snapshot.get("conditionsUnchanged") is not True:
        return "unconfirmed conditions"
    return None


def main():
    evidence = json.loads(Path(__file__).with_name("evidence.json").read_text())
    source_ids = {source["id"] for source in evidence["sources"]}
    assert len(source_ids) == len(evidence["sources"])
    assert all(source["url"].startswith("https://") for source in evidence["sources"])
    for vector in evidence["referenceVectors"]:
        assert vector["sourceId"] in source_ids
        assert vector["kind"] == "developer_example_not_measurement"
        assert accuracy_reference(vector["input"]["HDex"]) == vector["output"]["Accuracy"]
    assert accuracy_reference(399) is None and accuracy_reference(4001) is None
    assert accuracy_reference(400) == 151 and accuracy_reference(4000) == 300
    assert accuracy_reference(424) == 151 and accuracy_reference(425) == 152
    assert accuracy_reference(424) - accuracy_reference(425) == -1
    assert scaled_interval(3, 10, 20) == (30, 60)
    assert scaled_interval(-3, 10, 20) == (-60, -30)
    assert scaled_interval(0, 10, 20) == (0, 0)
    assert scaled_interval(1, 20, 10) is None
    assert capped_interval(90, 100, 100, 20) == (10, 10)
    assert capped_interval(100, 100, 100, 20) == (0, 0)
    assert capped_interval(100, 100, 100, -20) == (-20, 0)
    assert capped_interval(100, 100, 110, 0) == (0, 10)
    assert capped_interval(110, 100, 100, 0) is None
    binding = {"class": "Beastlord", "level": 100, "server": "synthetic",
               "expansion": "synthetic", "patch": "synthetic", "equipmentDigest": "synthetic"}
    good = binding | {"unbuffed": True, "conditionsUnchanged": True}
    assert snapshot_reason(None, binding) == "missing snapshot"
    assert snapshot_reason(good, binding) is None
    assert snapshot_reason(good | {"patch": None}, binding) == "missing patch"
    assert snapshot_reason(good | {"equipmentDigest": "changed"}, binding).startswith("stale")
    assert snapshot_reason(good | {"unbuffed": False}, binding) == "unconfirmed conditions"
    for sample in evidence["measuredSamples"]:
        assert sample["kind"] == "in_game_observation"
        assert sample.get("observedAt") and sample.get("sourceReferences")
        assert sample.get("before") and sample.get("after") and sample.get("restored")
    print("Evidence references and synthetic arithmetic checks passed.")
    print(f"Observed gear swaps: {len(evidence['measuredSamples'])}; production gate: {evidence['decision']['productionProjection']}.")


if __name__ == "__main__":
    main()
