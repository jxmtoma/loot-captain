#!/usr/bin/env python3
"""Generate the checked-in catalog of statless armor templates.

The source guide is intentionally represented as small, reviewed definitions:
the guide describes the families and slots, while the EQ item IDs are stable
source metadata. Runtime never needs to contact the guide or EQResource.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "background" / "armor-token-catalog.js"
CATALOG_VERSION = "rof-tob-2"
SOURCES = {
    "rof": {
        "expansion": "Rain of Fear",
        "urls": ("https://everquest.allakhazam.com/wiki/eq:Rain_of_Fear_Armor_Guide",),
        "version": "Rain of Fear guide, accessed 2026-09-01",
    },
    "tbm": {
        "expansion": "The Broken Mirror",
        "urls": (
            "https://www.raspersrealm.com/Everquest/TBM/miscGroupGear.html",
            "https://www.raidloot.com/group/tbmarmor",
            "https://tbm.eqresource.com/itemsearch.php?searchid=517789",
            "https://tbm.eqresource.com/itemsearch.php?searchid=517790",
        ),
        "version": "TBM visible group armor guides, accessed 2026-09-01",
    },
    "eok": {
        "expansion": "Empires of Kunark",
        "urls": (
            "https://www.raspersrealm.com/Everquest/EoK/gearVisibleArmor.html",
            "https://www.raidloot.com/group/eokarmor",
            "https://eok.eqresource.com/itemsearch.php?searchid=517791",
            "https://eok.eqresource.com/itemsearch.php?searchid=517792",
        ),
        "version": "EoK visible group armor guides, accessed 2026-09-01",
    },
    "cotf": {
        "expansion": "Call of the Forsaken",
        "urls": ("https://cotf.eqresource.com/gearoverview.php",),
        "version": "CoTF gear overview, accessed 2026-09-02",
    },
    "tds": {
        "expansion": "The Darkened Sea",
        "urls": ("https://tds.eqresource.com/gearoverview.php",),
        "version": "TDS gear overview, accessed 2026-09-02",
    },
    "ros": {
        "expansion": "Ring of Scale",
        "urls": (
            "https://ros.eqresource.com/creatingarmor.php",
            "https://ros.eqresource.com/creatingraidarmor.php",
        ),
        "version": "RoS armor creation tables, accessed 2026-09-02",
    },
    "tbl": {
        "expansion": "The Burning Lands",
        "urls": ("https://tbl.eqresource.com/creatingarmor.php",),
        "version": "TBL armor creation table, accessed 2026-09-02",
    },
    "tov": {
        "expansion": "Torment of Velious",
        "urls": ("https://tov.eqresource.com/creatingarmor.php",),
        "version": "ToV armor creation table, accessed 2026-09-02",
    },
    "cov": {
        "expansion": "Claws of Veeshan",
        "urls": ("https://cov.eqresource.com/creatingarmor.php",),
        "version": "CoV armor creation table, accessed 2026-09-02",
    },
    "tol": {
        "expansion": "Terror of Luclin",
        "urls": (
            "https://tol.eqresource.com/creatingarmor.php",
            "https://everquest.fanra.info/wiki/Terror_of_Luclin",
            "https://tol.eqresource.com/itemsearch.php?searchid=422798",
        ),
        "version": "ToL armor creation table, accessed 2026-09-02",
    },
    "nos": {
        "expansion": "Night of Shadows",
        "urls": (
            "https://nos.eqresource.com/creatingarmor.php",
            "https://everquest.fanra.info/wiki/Night_of_Shadows",
            "https://nos.eqresource.com/itemsearch.php?searchid=517797",
            "https://nos.eqresource.com/itemsearch.php?searchid=431205",
            "https://nos.eqresource.com/itemsearch.php?searchid=517798",
        ),
        "version": "NoS armor creation table, accessed 2026-09-02",
    },
    "ls": {
        "expansion": "Laurion's Song",
        "urls": ("https://ls.eqresource.com/creatingarmor.php",),
        "version": "LS armor creation table, accessed 2026-09-02",
    },
    "tob": {
        "expansion": "The Outer Brood",
        "urls": ("https://tob.eqresource.com/creatingarmor.php",),
        "version": "ToB armor creation table, accessed 2026-09-02",
    },
}

# Allakhazam's guide lists these seven visible slots in this order. The item
# IDs are the stable EQ IDs recorded by the guide/database sources.
SLOTS = (
    ("Bracer", "wrist"),
    ("Gloves", "hands"),
    ("Boots", "feet"),
    ("Helm", "head"),
    ("Armguards", "arms"),
    ("Leggings", "legs"),
    ("Tunic", "chest"),
)
VISIBLE_SLOTS = {slot for _, slot in SLOTS}
MODERN_SLOTS = (
    ("Wrist", "wrist"),
    ("Hands", "hands"),
    ("Feet", "feet"),
    ("Head", "head"),
    ("Arms", "arms"),
    ("Legs", "legs"),
    ("Chest", "chest"),
)
CUSTOM_PIECES = {
    "crypt_hunter": (("Wristguard", "wrist"), ("Gloves", "hands"), ("Boots", "feet"),
                     ("Cap", "head"), ("Sleeves", "arms"), ("Leggings", "legs"), ("Chestpiece", "chest")),
    "deathseeker": (("Wristguard", "wrist"), ("Gloves", "hands"), ("Boots", "feet"),
                    ("Helmet", "head"), ("Armwraps", "arms"), ("Leggings", "legs"), ("Tunic", "chest")),
    "ros": (("Bracer", "wrist"), ("Gloves", "hands"), ("Shoes", "feet"), ("Cap", "head"),
            ("Sleeve", "arms"), ("Pants", "legs"), ("Tunic", "chest")),
    "lining": (("Wrist", "wrist"), ("Hand", "hands"), ("Feet", "feet"), ("Head", "head"),
               ("Arm", "arms"), ("Leg", "legs"), ("Chest", "chest")),
}

FAMILIES = (
    {"source": "rof", "track": "group", "tier": 1, "first_id": 72204, "prefix": "Fear Touched", "set_query": "Group Tier 1 (Boreal)"},
    {"source": "rof", "track": "group", "tier": 2, "first_id": 72211, "prefix": "Fear Stained", "set_query": "Group Tier 2 (Distorted)"},
    {"source": "rof", "track": "group", "tier": 3, "first_id": 72218, "prefix": "Fear Washed", "set_query": "Group Tier 3 (Twilight)"},
    {"source": "rof", "track": "group", "tier": 4, "first_id": 81191, "prefix": "Fear Infused", "set_query": "Group Tier 4 (Frightweave)"},
    {"source": "rof", "track": "raid", "tier": 1, "first_id": 72225, "prefix": "Dread Touched", "set_query": "Raid Tier 1 (Gelid)"},
    {"source": "rof", "track": "raid", "tier": 2, "first_id": 72232, "prefix": "Dread", "set_query": "Raid Tier 2 (Apocryphal)"},
    {"source": "rof", "track": "raid", "tier": 3, "first_id": 72239, "prefix": "Dread Washed", "set_query": "Raid Tier 3 (Silvershade)"},
    {"source": "rof", "track": "raid", "tier": 4, "first_id": 81198, "prefix": "Dread Infused", "set_query": "Raid Tier 4 (Dreadweave)"},
    {"source": "cotf", "track": "group", "tier": 1, "first_id": 85285,
     "name_template": "{piece} of Latent Ether", "set_query": "Group Tier 1 (Latent Etheric)"},
    {"source": "cotf", "track": "group", "tier": 2, "first_id": 85292,
     "name_template": "{piece} of Manifested Ether", "set_query": "Group Tier 2 (Manifested Etheric)"},
    {"source": "cotf", "track": "raid", "tier": 1, "first_id": 85299,
     "name_template": "{piece} of Suppressed Ether", "set_query": "Raid Tier 1 (Suppressed Etheric)"},
    {"source": "cotf", "track": "raid", "tier": 2, "first_id": 85306,
     "name_template": "{piece} of Flowing Ether", "set_query": "Raid Tier 2 (Flowing Etheric)"},
    {"source": "tds", "track": "group", "tier": 1, "first_id": 94246,
     "name_template": "Castaway {piece}", "set_query": "Group Tier 1 (Castaway)"},
    {"source": "tds", "track": "group", "tier": 2, "first_id": 94253,
     "name_template": "Tideworn {piece}", "set_query": "Group Tier 2 (Tideworn)"},
    {"source": "tds", "track": "group", "tier": 3, "first_id": 94260,
     "name_template": "Highwater {piece}", "set_query": "Group Tier 3 (Highwater)"},
    {"source": "tds", "track": "raid", "tier": 1, "first_id": 94274,
     "name_template": "Darkwater {piece}", "set_query": "Raid Tier 1 (Darkwater)"},
    {"source": "tbm", "track": "group", "tier": 3, "first_id": 147657,
     "name_template": "Raw Crypt-Hunter's {piece}", "pieces": CUSTOM_PIECES["crypt_hunter"],
     "set_query": "Group Tier 3 (Crypt-Hunter)"},
    {"source": "tbm", "track": "raid", "tier": 1, "first_id": 147664,
     "name_template": "Raw Deathseeker's {piece}", "pieces": CUSTOM_PIECES["deathseeker"],
     "set_query": "Raid Tier 1 (Deathseeker)"},
    {"source": "eok", "track": "group", "tier": 1, "first_id": 148851,
     "name_template": "Amorphous Cohort's {piece}",
     "pieces": (("Wristguard", "wrist"), ("Gauntlets", "hands"), ("Boots", "feet"),
                ("Helm", "head"), ("Sleeves", "arms"), ("Leggings", "legs"), ("Breastplate", "chest")),
     "set_query": "Group Tier 1 (Cohort's)"},
    {"source": "eok", "track": "group", "tier": 2, "first_id": 148858,
     "name_template": "Amorphous Selrach's {piece}",
     "pieces": (("Wristguard", "wrist"), ("Gauntlets", "hands"), ("Boots", "feet"),
                ("Helm", "head"), ("Sleeves", "arms"), ("Leggings", "legs"), ("Breastplate", "chest")),
     "set_query": "Group Tier 2 (Selrach's)"},
    {"source": "eok", "track": "raid", "tier": 1, "first_id": 148865,
     "name_template": "Amorphous Velazul's {piece}",
     "pieces": (("Wristguard", "wrist"), ("Gauntlets", "hands"), ("Boots", "feet"),
                ("Helm", "head"), ("Sleeves", "arms"), ("Leggings", "legs"), ("Breastplate", "chest")),
     "set_query": "Raid Tier 1 (Velazul's)"},
    {"source": "ros", "track": "group", "tier": 1, "first_id": 151851,
     "name_template": "Scale Touched {piece} Facet", "pieces": CUSTOM_PIECES["ros"],
     "set_query": "Group Tier 1 (Scale Touched)"},
    {"source": "ros", "track": "group", "tier": 2, "first_id": 151858,
     "name_template": "Scaled {piece} Facet", "pieces": CUSTOM_PIECES["ros"],
     "set_query": "Group Tier 2 (Scaled)"},
    {"source": "ros", "track": "raid", "tier": 1, "first_id": 151865,
     "name_template": "Scaleborn {piece} Facet", "pieces": CUSTOM_PIECES["ros"],
     "set_query": "Raid Tier 1 (Scaleborn)"},
    {"source": "tbl", "track": "group", "tier": 1, "first_id": 161401,
     "name_template": "Weeping Undefeated Heaven Binding {piece} Muhbis", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Weeping Undefeated Heaven)"},
    {"source": "tbl", "track": "group", "tier": 2, "first_id": 161408,
     "name_template": "Battleworn Stalwart Moon Binding {piece} Muhbis", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Battleworn Stalwart Moon)"},
    {"source": "tbl", "track": "raid", "tier": 1, "first_id": 161415,
     "name_template": "Veiled Victorious Horizon Binding {piece} Muhbis", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Veiled Victorious Horizon)"},
    {"source": "tov", "track": "group", "tier": 1, "first_id": 164401,
     "name_template": "Faded Snowbound {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Snowbound)"},
    {"source": "tov", "track": "group", "tier": 2, "first_id": 164408,
     "name_template": "Faded Icebound {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Icebound)"},
    {"source": "tov", "track": "raid", "tier": 1, "first_id": 164415,
     "name_template": "Faded Ice Woven {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Ice Woven)"},
    {"source": "tol", "track": "group", "tier": 3, "first_id": 166236,
     "name_template": "Faded Bloodied Luclinite {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 3 (Luclinite Ensanguined)",
     "alternativeSets": (("raid", 2, "Raid Tier 2 (Luclinite Coagulated)"),)},
    {"source": "cov", "track": "group", "tier": 1, "first_id": 164901,
     "name_template": "Faded Snowsquall {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Snowsquall)"},
    {"source": "cov", "track": "group", "tier": 2, "first_id": 164908,
     "name_template": "Faded Blizzard {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Blizzard)"},
    {"source": "cov", "track": "raid", "tier": 1, "first_id": 164922,
     "name_template": "Faded Hoarfrost {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Hoarfrost)"},
    {"source": "tol", "track": "group", "tier": 1, "first_id": 168001,
     "name_template": "Faded Waxing Crescent {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Waxing Crescent)"},
    {"source": "tol", "track": "group", "tier": 2, "first_id": 168008,
     "name_template": "Faded Waning Crescent {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Waning Crescent)"},
    {"source": "tol", "track": "raid", "tier": 1, "first_id": 168022,
     "name_template": "Faded Waning Gibbous {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Waning Gibbous)"},
    {"source": "nos", "track": "group", "tier": 1, "first_id": 168101,
     "name_template": "Faded Ascending Spirit {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Ascending Spirit)"},
    {"source": "nos", "track": "group", "tier": 2, "first_id": 168108,
     "name_template": "Faded Celestial Zenith {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Celestial Zenith)"},
    {"source": "nos", "track": "raid", "tier": 1, "first_id": 168115,
     "name_template": "Faded Spectral Luminosity {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Spectral Luminosity)"},
    {"source": "nos", "track": "group", "tier": 3, "first_id": 159749,
     "name_template": "Spiritually Faded Luclinite {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 3 (Phantasmal Luclinite)",
     "alternativeSets": (("raid", 2, "Raid Tier 2 (Spectral Luclinite)"),)},
    {"source": "nos", "track": "group", "tier": 3, "first_id": 159844,
     "name_template": "Otherworldly {piece} Armor Lining", "pieces": CUSTOM_PIECES["lining"],
     "set_query": "Group Tier 3 (Phantasmal Luclinite)"},
    {"source": "nos", "track": "raid", "tier": 2, "first_id": 159851,
     "name_template": "Apparitional {piece} Armor Lining", "pieces": CUSTOM_PIECES["lining"],
     "set_query": "Raid Tier 2 (Spectral Luclinite)"},
    {"source": "ls", "track": "group", "tier": 1, "first_id": 171771,
     "name_template": "Obscured Gallant Resonance {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Gallant Resonance)"},
    {"source": "ls", "track": "group", "tier": 2, "first_id": 171778,
     "name_template": "Obscured Steadfast Resolve {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Steadfast Resolve)"},
    {"source": "ls", "track": "raid", "tier": 1, "first_id": 171785,
     "name_template": "Obscured Heroic Reflections {piece} Armor", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Heroic Reflections)"},
    {"source": "tob", "track": "group", "tier": 1, "first_id": 174001,
     "name_template": "Obscured {piece} Armor of the Enthralled", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 1 (Enthralled)"},
    {"source": "tob", "track": "group", "tier": 2, "first_id": 174008,
     "name_template": "Obscured {piece} Armor of the Shackled", "pieces": MODERN_SLOTS,
     "set_query": "Group Tier 2 (Shackled)"},
    {"source": "tob", "track": "raid", "tier": 1, "first_id": 174022,
     "name_template": "Obscured {piece} Armor of the Bound", "pieces": MODERN_SLOTS,
     "set_query": "Raid Tier 1 (Bound)"},
    {"source": "tob", "track": "group", "tier": 3, "first_id": 170418,
     "name_template": "{piece} Armor Lining of Uprising", "pieces": CUSTOM_PIECES["lining"],
     "set_query": "Group Tier 3 (Uprising)"},
    {"source": "tob", "track": "raid", "tier": 2, "first_id": 170425,
     "name_template": "{piece} Armor Lining of Rebellion", "pieces": CUSTOM_PIECES["lining"],
     "set_query": "Raid Tier 2 (Rebellion)"},
)


def normalized_name(name: str) -> str:
    """Return the key used by runtime's safe name fallback."""

    return re.sub(r"[^a-z0-9]+", " ", name.casefold()).strip()


def build_items() -> dict[str, dict[str, object]]:
    items: dict[str, dict[str, object]] = {}
    names: dict[str, str] = {}
    for family in FAMILIES:
        source_key = family.get("source")
        if source_key not in SOURCES:
            raise ValueError(f"unknown source definition: {source_key!r}")
        source = SOURCES[family["source"]]
        entries = family.get("entries")
        if entries is None:
            pieces = family.get("pieces", SLOTS)
            template = family.get("name_template", "{prefix} {piece}")
            prefix = family.get("prefix", "")
            entries = tuple(
                (family["first_id"] + offset,
                 template.format(prefix=prefix, piece=suffix, modern=suffix), slot)
                for offset, (suffix, slot) in enumerate(pieces)
            )
        if len(entries) != len(SLOTS) or [entry[2] for entry in entries] != [slot for _, slot in SLOTS]:
            raise ValueError(f"family does not cover every visible slot: {family}")
        alternatives = family.get("alternativeSets")
        if alternatives is not None:
            if not isinstance(alternatives, (tuple, list)):
                raise ValueError(f"invalid alternative sets: {family}")
            alternatives = [
                {"track": track, "tier": tier, "setQuery": set_query}
                for track, tier, set_query in alternatives
            ]
            if any(track not in {"group", "raid"} or not isinstance(tier, int) or tier < 1 or
                   not isinstance(set_query, str) or not set_query.strip()
                   for track, tier, set_query in ((item["track"], item["tier"], item["setQuery"]) for item in alternatives)):
                raise ValueError(f"invalid alternative sets: {family}")
        for item_id, name, slot in entries:
            if not isinstance(item_id, int) or not 0 < item_id < 10**12:
                raise ValueError(f"invalid item ID: {item_id}")
            if not isinstance(name, str) or not name.strip() or slot not in VISIBLE_SLOTS:
                raise ValueError(f"invalid armor record: {item_id}, {name!r}, {slot!r}")
            key = str(item_id)
            normalized = normalized_name(name)
            if key in items:
                raise ValueError(f"duplicate item ID: {item_id}")
            if normalized in names:
                raise ValueError(
                    f"ambiguous normalized name {name!r}; also used by {names[normalized]!r}"
                )
            names[normalized] = name
            record = {
                "id": item_id,
                "name": name,
                "expansion": source["expansion"],
                "track": family["track"],
                "tier": family["tier"],
                "setQuery": family["set_query"],
                "slot": slot,
            }
            if alternatives is not None:
                record["alternativeSets"] = alternatives
            items[key] = record

    expected_count = sum(len(family.get("entries") or SLOTS) for family in FAMILIES)
    if len(items) != expected_count:
        raise ValueError("catalog does not contain every family and visible slot")
    return dict(sorted(items.items(), key=lambda pair: int(pair[0])))


def render() -> str:
    catalog = {"catalogVersion": CATALOG_VERSION, "items": build_items()}
    payload = json.dumps(catalog, ensure_ascii=False, indent=2)
    source_header = "\n".join(
        f"// Source ({key}): {'; '.join(source['urls'])} ({source['version']})"
        for key, source in SOURCES.items()
    )
    return (
        "// Generated by tools/generate_armor_token_catalog.py; do not edit.\n"
        + source_header
        + "\n"
        "globalThis.LOOT_CAPTAIN_ARMOR_TOKEN_CATALOG = "
        + payload
        + ";\n"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the committed catalog is current without writing it",
    )
    args = parser.parse_args(argv)
    expected = render()
    if args.check:
        try:
            actual = OUTPUT.read_text(encoding="utf-8")
        except FileNotFoundError:
            print(f"missing generated catalog: {OUTPUT}", file=sys.stderr)
            return 1
        if actual != expected:
            print(f"generated catalog is stale: {OUTPUT}", file=sys.stderr)
            return 1
        return 0

    OUTPUT.write_text(expected, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
