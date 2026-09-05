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
CATALOG_VERSION = "pop-tob-4"
SOURCES = {
    "pop": {
        "expansion": "Planes of Power",
        "urls": (
            "https://everquest.allakhazam.com/wiki/EQ:The_Planes_of_Power",
            "https://lucy.allakhazam.com/itemlist.html?searchtext=Ornate",
            "https://www.raidloot.com/group/poparmor",
            "https://www.raidloot.com/raid/poparmor",
        ),
        "version": "PoP armor quests, Lucy item IDs and armor set pages, accessed 2026-09-05",
    },
    "god": {
        "expansion": "Gates of Discord",
        "urls": (
            "https://www.eqprogression.com/gates-of-discord-quest-class-armor/",
            "https://www.eqprogression.com/muramite-armor-combine-information-gates-of-discord/",
            "https://www.raidloot.com/raid/godarmor",
        ),
        "version": "GoD Muramite armor drop and combine guides, accessed 2026-09-05",
    },
    "oow": {
        "expansion": "Omens of War",
        "urls": (
            "https://everquest.allakhazam.com/db/quest.html?quest=2988",
            "https://everquest.allakhazam.com/db/quest.html?quest=2993",
            "https://www.eqprogression.com/omens-of-war-tier-2-raid-armor-guide/",
            "https://www.raidloot.com/group/oowarmor",
            "https://www.raidloot.com/raid/oowarmor",
        ),
        "version": "OoW armor turn-in quests and Tier 2 raid armor guide, accessed 2026-09-05",
    },
    "por": {
        "expansion": "Prophecy of Ro",
        "urls": (
            "https://everquest.allakhazam.com/wiki/Everquest_Guide_Prophecy_of_Ro",
            "https://everquest.allakhazam.com/db/quest.html?quest=3375",
            "https://lucy.allakhazam.com/itemlist.html?searchtext=Crafting+Mold%3A+Spirit",
        ),
        "version": "PoR Spirit Mark Armor task and Lucy item IDs, accessed 2026-09-05",
    },
    "tss": {
        "expansion": "The Serpent's Spine",
        "urls": (
            "https://tss.eqresource.com/creatingarmor.php",
            "https://www.raidloot.com/group/tssarmor",
        ),
        "version": "TSS armor creation table and armor set pages, accessed 2026-09-05",
    },
    "uf": {
        "expansion": "Underfoot",
        "urls": (
            "https://everquest.allakhazam.com/wiki/EQ:Underfoot_Armor_Guide",
            "https://lucy.allakhazam.com/itemlist.html?searchtext=Encrusted",
            "https://www.raidloot.com/group/ufarmor",
            "https://www.raidloot.com/raid/ufarmor",
        ),
        "version": "UF armor guide, Lucy item IDs and armor set pages, accessed 2026-09-05",
    },
    "hot": {
        "expansion": "House of Thule",
        "urls": (
            "https://www.raidloot.com/group/hotarmor",
            "https://www.raidloot.com/raid/hotarmor",
            "https://hot.eqresource.com/creatingarmor.php",
        ),
        "version": "HoT armor set and creation guides, accessed 2026-09-05",
    },
    "voa": {
        "expansion": "Veil of Alaris",
        "urls": (
            "https://www.raidloot.com/group/voaarmor",
            "https://www.raidloot.com/raid/voaarmor",
            "https://voa.eqresource.com/gearoverview.php",
        ),
        "version": "VoA armor set and gear overview guides, accessed 2026-09-05",
    },
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
CLASS_CODES = frozenset((
    "WAR", "CLR", "PAL", "RNG", "SHD", "DRU", "MNK", "BRD",
    "ROG", "SHM", "NEC", "WIZ", "MAG", "ENC", "BST", "BER",
))
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
    # UF names its slot templates anatomically, and its item IDs do not run in
    # SLOTS order: within a tier they run hands, wrist, arms, feet, legs, chest, head.
    "clay": (("Phalangeal", "hands"), ("Carpal", "wrist"), ("Brachial", "arms"), ("Tarsal", "feet"),
             ("Crural", "legs"), ("Thoracic", "chest"), ("Cephalic", "head")),
    # HoT names its slot templates after concepts rather than slots.
    "remnant": (("Truth", "wrist"), ("Greed", "hands"), ("Survival", "feet"), ("Knowledge", "head"),
                ("Devotion", "arms"), ("Fear", "legs"), ("Desire", "chest")),
    "voa": (("Wristwraps", "wrist"), ("Handwraps", "hands"), ("Footwraps", "feet"), ("Headdress", "head"),
            ("Armwraps", "arms"), ("Legwraps", "legs"), ("Stole", "chest")),
}

# TSS names each armor type's template after its own piece nouns; within a type
# the IDs run chest, legs, arms, hands, feet, wrist, head.
TSS_PIECES = {
    "plate": (("Chestplate Mold", "chest"), ("Legplate Mold", "legs"), ("Armplate Mold", "arms"),
              ("Plate Glove Mold", "hands"), ("Plate Boot Mold", "feet"), ("Plate Bracer Mold", "wrist"),
              ("Helm Mold", "head")),
    "chain": (("Chestguard Mold", "chest"), ("Leggings Mold", "legs"), ("Armguard Mold", "arms"),
              ("Chain Glove Mold", "hands"), ("Chain Boot Mold", "feet"), ("Chain Bracer Mold", "wrist"),
              ("Chain Skullcap Mold", "head")),
    "leather": (("Chestwrap Pattern", "chest"), ("Legwrap Pattern", "legs"), ("Armwrap Pattern", "arms"),
                ("Leather Glove Pattern", "hands"), ("Leather Boot Pattern", "feet"),
                ("Leather Bracer Pattern", "wrist"), ("Leather Skullcap Pattern", "head")),
    "silk": (("Robe Pattern", "chest"), ("Silk Leggings Pattern", "legs"), ("Silk Armwrap Pattern", "arms"),
             ("Silk Glove Pattern", "hands"), ("Silk Boot Pattern", "feet"), ("Silk Bracer Pattern", "wrist"),
             ("Skullcap Pattern", "head")),
}

ARMOR_TYPE_CLASSES = {
    "plate": ("WAR", "CLR", "PAL", "SHD", "BRD"),
    "chain": ("RNG", "ROG", "SHM", "BER"),
    "leather": ("DRU", "MNK", "BST"),
    "silk": ("NEC", "WIZ", "MAG", "ENC"),
}


def pop_family(track, set_query, armor_type, pieces):
    return {"source": "pop", "track": track, "tier": 1, "set_query": set_query,
            "classes": ARMOR_TYPE_CLASSES[armor_type],
            "entries": tuple((item_id, name, slot) for item_id, name, slot in pieces)}


FAMILIES = (
    pop_family("group", "Group (Ornate)", "plate", (
        (16297, "Ornate Bracer Mold", "wrist"), (16298, "Ornate Boot Mold", "feet"),
        (16299, "Ornate Helm Mold", "head"), (16343, "Ornate Vambrace Mold", "arms"),
        (16344, "Ornate Greaves Mold", "legs"), (16345, "Ornate Gauntlet Mold", "hands"),
        (16346, "Ornate Breastplate Mold", "chest"))),
    pop_family("group", "Group (Ornate)", "chain", (
        (16290, "Ornate Chain Coif Pattern", "head"), (16291, "Ornate Chain Tunic Pattern", "chest"),
        (16292, "Ornate Chain Sleeve Pattern", "arms"), (16293, "Ornate Chain Bracelet Pattern", "wrist"),
        (16294, "Ornate Chain Glove Pattern", "hands"), (16295, "Ornate Chain Pant Pattern", "legs"),
        (16296, "Ornate Chain Boot Pattern", "feet"))),
    pop_family("group", "Group (Ornate)", "leather", (
        (16347, "Ornate Leather Helm Pattern", "head"), (16348, "Ornate Leather Tunic Pattern", "chest"),
        (16349, "Ornate Leather Sleeve Pattern", "arms"), (16350, "Ornate Leather Wristband Pattern", "wrist"),
        (16351, "Ornate Leather Glove Pattern", "hands"), (16352, "Ornate Leather Pant Pattern", "legs"),
        (16353, "Ornate Leather Boot Pattern", "feet"))),
    pop_family("group", "Group (Ornate)", "silk", (
        (16354, "Ornate Silk Turban Pattern", "head"), (16355, "Ornate Silk Robe Pattern", "chest"),
        (16356, "Ornate Silk Sleeve Pattern", "arms"), (16357, "Ornate Silk Bracelet Pattern", "wrist"),
        (16358, "Ornate Silk Glove Pattern", "hands"), (16359, "Ornate Silk Pant Pattern", "legs"),
        (16360, "Ornate Silk Boot Pattern", "feet"))),
    # Plane of Time chest templates are named "Timeless", not "Elemental".
    pop_family("raid", "Raid (Elemental)", "plate", (
        (16369, "Elemental Bracer Mold", "wrist"), (16370, "Elemental Boot Mold", "feet"),
        (16371, "Elemental Helm Mold", "head"), (16372, "Elemental Vambrace Mold", "arms"),
        (16373, "Elemental Greaves Mold", "legs"), (16374, "Elemental Gauntlet Mold", "hands"),
        (16375, "Timeless Breastplate Mold", "chest"))),
    pop_family("raid", "Raid (Elemental)", "chain", (
        (16362, "Elemental Chain Coif Pattern", "head"), (16363, "Timeless Chain Tunic Pattern", "chest"),
        (16364, "Elemental Chain Sleeve Pattern", "arms"), (16365, "Elemental Chain Bracelet Pattern", "wrist"),
        (16366, "Elemental Chain Glove Pattern", "hands"), (16367, "Elemental Chain Pant Pattern", "legs"),
        (16368, "Elemental Chain Boot Pattern", "feet"))),
    pop_family("raid", "Raid (Elemental)", "leather", (
        (16376, "Elemental Leather Helm Pattern", "head"), (16377, "Timeless Leather Tunic Pattern", "chest"),
        (16378, "Elemental Leather Sleeve Pattern", "arms"), (16379, "Elemental Leather Wrist Pattern", "wrist"),
        (16380, "Elemental Leather Glove Pattern", "hands"), (16381, "Elemental Leather Pant Pattern", "legs"),
        (16382, "Elemental Leather Boot Pattern", "feet"))),
    pop_family("raid", "Raid (Elemental)", "silk", (
        (16383, "Elemental Silk Turban Pattern", "head"), (16384, "Timeless Silk Robe Pattern", "chest"),
        (16385, "Elemental Silk Sleeve Pattern", "arms"), (16386, "Elemental Silk Bracelet Pattern", "wrist"),
        (16387, "Elemental Silk Glove Pattern", "hands"), (16388, "Elemental Silk Pant Pattern", "legs"),
        (16389, "Elemental Silk Boot Pattern", "feet"))),
    {"source": "por", "track": "group", "tier": 1, "first_id": 85659,
     "name_template": "Crafting Mold: Spirit {piece}",
     "pieces": (("Helm", "head"), ("Sleeves", "arms"), ("Gloves", "hands"), ("Boots", "feet"),
                ("Bracers", "wrist"), ("Leggings", "legs"), ("Chest", "chest")),
     "set_query": "Spirit Mark Armor"},
    {"source": "god", "track": "raid", "tier": 1, "first_id": 68220,
     "name_template": "Muramite {piece} Armor",
     "pieces": (("Helm", "head"), ("Sleeve", "arms"), ("Bracer", "wrist"), ("Glove", "hands"),
                ("Boot", "feet"), ("Greaves", "legs"), ("Chest", "chest")),
     "set_query": "Raid (Muramite)"},
    # OoW turn-ins are named per item rather than per slot; the same seven are
    # shared by all four armor-type quests, so they are not class scoped.
    {"source": "oow", "track": "group", "tier": 1, "set_query": "Group (Dranik Loyalist)",
     "entries": ((51440, "Duskfall Chronicles", "head"), (51441, "Dragorn Elder Scepter", "chest"),
                 (51442, "Dragorn City Ember", "legs"), (51443, "Kuuan Traitor Stones", "feet"),
                 (51444, "Map of Old Kuua", "arms"), (51445, "Dranik Blood Standard", "wrist"),
                 (51446, "Spire Control Shard", "hands"))},
    {"source": "oow", "track": "raid", "tier": 1, "set_query": "Raid (Anguish)",
     "entries": ((51475, "Patorav's Walking Stick", "head"), (51476, "Jayruk's Vest", "chest"),
                 (51477, "Patorav's Amulet", "legs"), (51478, "Muramite Cruelty Medal", "feet"),
                 (51479, "Lenarsk's Embossed Leather Pouch", "arms"), (51480, "Riftseeker Heart", "wrist"),
                 (51481, "Makyah's Axe", "hands"))},
    *(
        {"source": "tss", "track": "group", "tier": 1, "first_id": first_id,
         "name_template": "Ancient {piece}", "pieces": TSS_PIECES[armor_type],
         "classes": ARMOR_TYPE_CLASSES[armor_type],
         "set_query": "Group (Tenish Unfocused)",
         "alternativeSets": (("group", 1, "Group (Tenish)"),)}
        for armor_type, first_id in (("chain", 32818), ("plate", 32825), ("leather", 32832), ("silk", 32839))
    ),
    {"source": "uf", "track": "group", "tier": 1, "first_id": 47573,
     "name_template": "Stellite Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Group Tier 1 (Stellite)"},
    {"source": "uf", "track": "group", "tier": 2, "first_id": 47580,
     "name_template": "Celestrium Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Group Tier 2 (Celestrium)"},
    {"source": "uf", "track": "group", "tier": 3, "first_id": 47587,
     "name_template": "Vitallium Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Group Tier 3 (Vitallium)"},
    {"source": "uf", "track": "group", "tier": 4, "first_id": 47594,
     "name_template": "Damascite Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Group Tier 4 (Damascite)"},
    {"source": "uf", "track": "raid", "tier": 1, "first_id": 47601,
     "name_template": "Palladium Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Raid Tier 1 (Palladium)"},
    {"source": "uf", "track": "raid", "tier": 2, "first_id": 47608,
     "name_template": "Iridium Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Raid Tier 2 (Iridium)"},
    {"source": "uf", "track": "raid", "tier": 3, "first_id": 47615,
     "name_template": "Rhodium Encrusted {piece} Clay", "pieces": CUSTOM_PIECES["clay"],
     "set_query": "Raid Tier 3 (Rhodium)"},
    {"source": "hot", "track": "group", "tier": 1, "first_id": 56179,
     "name_template": "Abstruse Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Group Tier 1 (Abstruse)"},
    {"source": "hot", "track": "group", "tier": 2, "first_id": 56186,
     "name_template": "Recondite Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Group Tier 2 (Recondite)"},
    {"source": "hot", "track": "group", "tier": 3, "first_id": 56193,
     "name_template": "Ambiguous Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Group Tier 3 (Ambiguous)"},
    {"source": "hot", "track": "group", "tier": 4, "first_id": 56200,
     "name_template": "Lucid Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Group Tier 4 (Lucid)"},
    {"source": "hot", "track": "raid", "tier": 1, "first_id": 56207,
     "name_template": "Enigmatic Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Raid Tier 1 (Enigmatic)"},
    {"source": "hot", "track": "raid", "tier": 2, "first_id": 56214,
     "name_template": "Esoteric Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Raid Tier 2 (Esoteric)"},
    {"source": "hot", "track": "raid", "tier": 3, "first_id": 56221,
     "name_template": "Obscure Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Raid Tier 3 (Obscure)"},
    {"source": "hot", "track": "raid", "tier": 4, "first_id": 56228,
     "name_template": "Perspicuous Remnant of {piece}", "pieces": CUSTOM_PIECES["remnant"],
     "set_query": "Raid Tier 4 (Perspicuous)"},
    {"source": "voa", "track": "group", "tier": 1, "first_id": 64750,
     "name_template": "Rustic {piece} of Argath", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Group Tier 1 (Rustic)"},
    {"source": "voa", "track": "group", "tier": 2, "first_id": 64757,
     "name_template": "Formal {piece} of Lunanyn", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Group Tier 2 (Formal)"},
    {"source": "voa", "track": "group", "tier": 3, "first_id": 64764,
     "name_template": "Embellished {piece} of Kolos", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Group Tier 3 (Embellished)"},
    {"source": "voa", "track": "group", "tier": 4, "first_id": 64771,
     "name_template": "Grandiose {piece} of Alra", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Group Tier 4 (Grandiose)"},
    {"source": "voa", "track": "raid", "tier": 1, "first_id": 64778,
     "name_template": "Modest {piece} of Illdaera", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Raid Tier 1 (Modest)"},
    {"source": "voa", "track": "raid", "tier": 2, "first_id": 64785,
     "name_template": "Elegant {piece} of Oseka", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Raid Tier 2 (Elegant)"},
    {"source": "voa", "track": "raid", "tier": 3, "first_id": 64792,
     "name_template": "Stately {piece} of Ladrys", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Raid Tier 3 (Stately)"},
    {"source": "voa", "track": "raid", "tier": 4, "first_id": 64799,
     "name_template": "Ostentatious {piece} of Ryken", "pieces": CUSTOM_PIECES["voa"],
     "set_query": "Raid Tier 4 (Ostentatious)"},
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
        if sorted(entry[2] for entry in entries) != sorted(slot for _, slot in SLOTS):
            raise ValueError(f"family does not cover every visible slot: {family}")
        classes = list(family.get("classes") or ())
        if any(cls not in CLASS_CODES for cls in classes) or len(set(classes)) != len(classes):
            raise ValueError(f"invalid class scoping: {family}")
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
            if classes:
                record["classes"] = classes
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
