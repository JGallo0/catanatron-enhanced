"""Authoritative Avatar V1/V2 catalog, sanitization, and unlock validation."""

from __future__ import annotations

import re
from typing import Any, Iterable

AVATAR_COLOR_FIELDS: tuple[str, ...] = (
    "skin",
    "hair",
    "eyes",
    "outfitPrimary",
    "outfitSecondary",
    "outfitTrim",
    "mount",
)

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}\Z")
SNAPSHOT_RE = re.compile(r"^data:image/(?:webp|png);base64,[A-Za-z0-9+/=]+\Z")
MAX_SNAPSHOT_CHARS = 65536


def _item(
    slot: str,
    item_id: str,
    tier: str = "free",
    rarity: str = "common",
    required_wins: int = 0,
    sku: str | None = None,
    price_brl_cents: int | None = None,
) -> dict[str, Any]:
    return {
        "slot": slot,
        "id": item_id,
        "tier": tier,
        "rarity": rarity,
        "required_wins": required_wins,
        "sku": sku,
        "price_brl_cents": price_brl_cents,
    }


AVATAR_CATALOG_ITEMS: list[dict[str, Any]] = [
    # bodyType
    _item("bodyType", "athletic"),
    _item("bodyType", "sturdy"),
    _item("bodyType", "slender"),
    # headShape
    _item("headShape", "oval"),
    _item("headShape", "square"),
    _item("headShape", "heart"),
    _item("headShape", "chiseled"),
    # eyeStyle
    _item("eyeStyle", "noble"),
    _item("eyeStyle", "fierce"),
    _item("eyeStyle", "wise"),
    _item("eyeStyle", "cheerful"),
    _item("eyeStyle", "calm"),
    _item("eyeStyle", "sharp"),
    # browStyle
    _item("browStyle", "arched"),
    _item("browStyle", "thick"),
    _item("browStyle", "calm"),
    _item("browStyle", "scarred"),
    # noseStyle
    _item("noseStyle", "straight"),
    _item("noseStyle", "aquiline"),
    _item("noseStyle", "broad"),
    _item("noseStyle", "button"),
    # mouthStyle
    _item("mouthStyle", "confident"),
    _item("mouthStyle", "smile"),
    _item("mouthStyle", "serious"),
    _item("mouthStyle", "smirk"),
    # hair
    _item("hair", "none"),
    _item("hair", "short"),
    _item("hair", "wavy"),
    _item("hair", "bun"),
    _item("hair", "braids"),
    _item("hair", "curly"),
    _item("hair", "long"),
    _item("hair", "navigator"),
    _item("hair", "royal_bun", tier="vip", rarity="rare", sku="vip_hair_royal_bun", price_brl_cents=690),
    # beard
    _item("beard", "none"),
    _item("beard", "goatee"),
    _item("beard", "full"),
    _item("beard", "mustache"),
    _item("beard", "captain_trimmed"),
    _item("beard", "full_viking", tier="vip", rarity="rare", sku="vip_beard_viking", price_brl_cents=690),
    # outfit
    _item("outfit", "settler"),
    _item("outfit", "captain"),
    _item("outfit", "armor"),
    _item("outfit", "merchant"),
    _item("outfit", "imperial_lord", tier="vip", rarity="epic", sku="vip_outfit_imperial_lord", price_brl_cents=1490),
    # legsBoots
    _item("legsBoots", "traveler"),
    _item("legsBoots", "cuffed_boots"),
    _item("legsBoots", "greaves"),
    _item("legsBoots", "royal_greaves", tier="vip", rarity="rare", sku="vip_legs_royal_greaves", price_brl_cents=790),
    # cape
    _item("cape", "none"),
    _item("cape", "traveler"),
    _item("cape", "navy_commander", tier="earnable", rarity="rare", required_wins=2),
    _item("cape", "royal_mantle", tier="vip", rarity="epic", sku="vip_cape_royal_mantle", price_brl_cents=1290),
    # hat
    _item("hat", "none"),
    _item("hat", "captain"),
    _item("hat", "explorer"),
    _item("hat", "bandana"),
    _item("hat", "helm"),
    _item("hat", "crown_gold", tier="earnable", rarity="epic", required_wins=7),
    _item("hat", "admiral_bicorne", tier="vip", rarity="epic", sku="vip_hat_admiral_bicorne", price_brl_cents=990),
    # handProp
    _item("handProp", "none"),
    _item("handProp", "spyglass"),
    _item("handProp", "scroll"),
    _item("handProp", "royal_scepter", tier="earnable", rarity="rare", required_wins=4),
    _item("handProp", "sun_rapier", tier="vip", rarity="epic", sku="vip_prop_sun_rapier", price_brl_cents=1190),
    # backProp
    _item("backProp", "none"),
    _item("backProp", "explorer_pack"),
    _item("backProp", "sheathed_sword"),
    _item("backProp", "imperial_shield", tier="vip", rarity="epic", sku="vip_prop_shield", price_brl_cents=1190),
    # pet
    _item("pet", "none"),
    _item("pet", "owl", tier="earnable", rarity="rare", required_wins=6),
    _item("pet", "parrot", tier="vip", rarity="epic", sku="vip_pet_parrot", price_brl_cents=1490),
    _item("pet", "falcon", tier="vip", rarity="legendary", sku="vip_pet_falcon", price_brl_cents=1990),
    # mount
    _item("mount", "none"),
    _item("mount", "island_horse"),
    _item("mount", "snow_wolf", tier="vip", rarity="epic", sku="vip_mount_snow_wolf", price_brl_cents=1990),
    _item("mount", "royal_stag", tier="vip", rarity="epic", sku="vip_mount_royal_stag", price_brl_cents=1990),
    _item("mount", "imperial_griffin", tier="vip", rarity="legendary", sku="vip_mount_griffin", price_brl_cents=2990),
    # pedestal
    _item("pedestal", "stone_wood"),
    _item("pedestal", "runic_gold", tier="earnable", rarity="rare", required_wins=5),
    _item("pedestal", "obsidian_crown", tier="vip", rarity="epic", sku="vip_pedestal_obsidian", price_brl_cents=990),
    # aura
    _item("aura", "none"),
    _item("aura", "sun_motes", tier="earnable", rarity="epic", required_wins=8),
    _item("aura", "sea_mist", tier="vip", rarity="rare", sku="vip_aura_sea_mist", price_brl_cents=890),
    _item("aura", "imperial_flame", tier="vip", rarity="legendary", sku="vip_aura_imperial_flame", price_brl_cents=1790),
    # background
    _item("background", "ocean"),
    _item("background", "sunset"),
    _item("background", "forest"),
    _item("background", "mountain"),
    _item("background", "gold"),
    _item("background", "crimson"),
    # frame
    _item("frame", "wood"),
    _item("frame", "bronze", tier="earnable", rarity="common", required_wins=1),
    _item("frame", "silver", tier="earnable", rarity="rare", required_wins=3),
    _item("frame", "gold", tier="earnable", rarity="epic", required_wins=5),
    _item("frame", "imperial", tier="earnable", rarity="legendary", required_wins=10),
    _item("frame", "vip_dragon", tier="vip", rarity="legendary", sku="vip_frame_dragon", price_brl_cents=1690),
]

# Backward-compatible V1 exports
AVATAR_VALID_VALUES: dict[str, tuple[str, ...]] = {
    "skin": ("porcelain", "fair", "warm", "tan", "brown", "deep"),
    "eyes": ("calm", "cheerful", "sharp", "wise"),
    "hair": ("none", "short", "wavy", "bun", "braids", "curly", "long"),
    "hairColor": ("brown", "black", "blonde", "red", "silver", "navy"),
    "beard": ("none", "goatee", "full", "mustache"),
    "hat": ("none", "captain", "explorer", "bandana", "helm", "crown_gold"),
    "outfit": ("settler", "captain", "armor", "merchant"),
    "outfitColor": ("crimson", "royal", "emerald", "amber", "slate"),
    "background": ("ocean", "sunset", "forest", "mountain", "gold", "crimson"),
    "frame": ("wood", "bronze", "silver", "gold", "imperial"),
}

AVATAR_UNLOCK_REQUIREMENTS: dict[str, dict[str, int]] = {
    "frame": {"bronze": 1, "silver": 3, "gold": 5, "imperial": 10},
    "hat": {"crown_gold": 7},
}

_CATALOG_BY_SLOT: dict[str, dict[str, dict[str, Any]]] = {}
for _entry in AVATAR_CATALOG_ITEMS:
    _CATALOG_BY_SLOT.setdefault(_entry["slot"], {})[_entry["id"]] = _entry

_ALLOWED_SLOT_VALUES: dict[str, set[str]] = {}
for _slot, _items in _CATALOG_BY_SLOT.items():
    _ALLOWED_SLOT_VALUES[_slot] = set(_items.keys())
for _field, _vals in AVATAR_VALID_VALUES.items():
    _ALLOWED_SLOT_VALUES.setdefault(_field, set()).update(_vals)


def sanitize_avatar_config(raw: dict | None) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    sanitized: dict[str, Any] = {}

    raw_version = raw.get("version")
    if isinstance(raw_version, int) and not isinstance(raw_version, bool) and raw_version in (1, 2):
        sanitized["version"] = raw_version

    for field, allowed in _ALLOWED_SLOT_VALUES.items():
        val = raw.get(field)
        if isinstance(val, str) and val in allowed:
            sanitized[field] = val

    raw_colors = raw.get("colors")
    if isinstance(raw_colors, dict):
        clean_colors: dict[str, str] = {}
        for key in AVATAR_COLOR_FIELDS:
            cval = raw_colors.get(key)
            if isinstance(cval, str) and HEX_COLOR_RE.match(cval):
                clean_colors[key] = cval
        if clean_colors:
            sanitized["colors"] = clean_colors

    raw_snap = raw.get("portraitSnapshot")
    if (
        isinstance(raw_snap, str)
        and len(raw_snap) <= MAX_SNAPSHOT_CHARS
        and SNAPSHOT_RE.match(raw_snap)
    ):
        sanitized["portraitSnapshot"] = raw_snap

    return sanitized


def find_locked_avatar_items(
    cfg: dict[str, Any] | None,
    wins: int = 0,
    entitlements: Iterable[str] | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(cfg, dict):
        return []
    entitlements_set = set(entitlements or ())
    locked: list[dict[str, Any]] = []
    for slot, val in cfg.items():
        if slot in ("version", "colors", "portraitSnapshot") or not isinstance(val, str):
            continue
        item = _CATALOG_BY_SLOT.get(slot, {}).get(val)
        if item is None:
            continue
        tier = item["tier"]
        req = int(item.get("required_wins") or 0)
        item_key = f"{slot}:{val}"
        if tier == "free":
            continue
        if tier == "earnable":
            if wins >= req or item_key in entitlements_set:
                continue
            locked.append(
                {
                    "slot": slot,
                    "id": val,
                    "tier": tier,
                    "required_wins": req,
                    "sku": item.get("sku"),
                }
            )
        elif tier == "vip":
            if item_key in entitlements_set:
                continue
            locked.append(
                {
                    "slot": slot,
                    "id": val,
                    "tier": tier,
                    "required_wins": req,
                    "sku": item.get("sku"),
                }
            )
    return locked


def filter_unlocked_avatar_config(
    raw: dict | None,
    wins: int = 0,
    entitlements: Iterable[str] | None = None,
) -> dict[str, Any]:
    """Sanitize avatar config and silently drop items not yet unlocked."""
    clean = sanitize_avatar_config(raw)
    locked_slots = {
        item["slot"]
        for item in find_locked_avatar_items(clean, wins=wins, entitlements=entitlements)
    }
    return {k: v for k, v in clean.items() if k not in locked_slots}
