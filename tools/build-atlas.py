#!/usr/bin/env python3
"""Build a vanilla Minecraft item/block texture atlas for the TwichCraft command store."""
from __future__ import annotations

import argparse
import json
import math
import shutil
import zipfile
from pathlib import Path

from PIL import Image


def first_frame(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    if h > w and h % w == 0:
        return img.crop((0, 0, w, w))
    if w != h:
        side = min(w, h)
        return img.crop((0, 0, side, side))
    return img


def load_kind(root: Path, kind: str) -> dict[str, Image.Image]:
    out: dict[str, Image.Image] = {}
    base = root / "assets" / "minecraft" / "textures" / kind
    if not base.is_dir():
        return out
    for path in sorted(base.glob("*.png")):
        try:
            with Image.open(path) as im:
                frame = first_frame(im)
            if frame.size[0] > 64 or frame.size[1] > 64:
                continue
            if frame.size != (16, 16):
                frame = frame.resize((16, 16), Image.Resampling.NEAREST)
            out[path.stem] = frame
        except Exception as e:
            print(f"skip {path}: {e}")
    return out


def extract_jar(jar: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(jar) as zf:
        for name in zf.namelist():
            if not name.endswith(".png"):
                continue
            if name.startswith("assets/minecraft/textures/item/") or name.startswith(
                "assets/minecraft/textures/block/"
            ):
                zf.extract(name, dest)


def pack(item_tex: dict[str, Image.Image], block_tex: dict[str, Image.Image], tile: int = 16):
    # Prefer item texture when both exist; otherwise use block (for block-items like oak_log).
    ids = sorted(set(item_tex) | set(block_tex))
    pack_ids = ids
    n = len(pack_ids)
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols) if n else 1
    atlas = Image.new("RGBA", (cols * tile, rows * tile), (0, 0, 0, 0))
    mapping: dict = {
        "_meta": {
            "tile": tile,
            "cols": cols,
            "rows": rows,
            "count": n,
            "version": "1.20.1",
            "source": "minecraft-1.20.1-client.jar",
        }
    }

    for i, key in enumerate(pack_ids):
        img = item_tex.get(key) or block_tex.get(key)
        if img is None:
            continue
        x = (i % cols) * tile
        y = (i // cols) * tile
        atlas.paste(img, (x, y))
        entry = {"x": x, "y": y, "w": tile, "h": tile}
        mapping[key] = entry
        if key in item_tex:
            mapping[f"item/{key}"] = entry
        if key in block_tex:
            mapping[f"block/{key}"] = entry

    # Item ids that don't have a matching texture name in 1.20.1.
    aliases = {
        "shield": "empty_armor_slot_shield",
        "tnt": "tnt_side",
        "enchanted_golden_apple": "golden_apple",
        "crafting_table": "crafting_table_front",
        "furnace": "furnace_front",
        "compass": "compass_00",
        "clock": "clock_00",
        "crossbow": "crossbow_standby",
        "scaffolding": "scaffolding_side",
        "hay_block": "hay_block_side",
        "tipped_arrow": "tipped_arrow_base",
        "white_bed": "red_bed",  # may still miss; resolved below if present
        "chest": "chest_minecart",
        "bow": "bow",
    }
    mapping["_aliases"] = aliases
    for alias, target in aliases.items():
        if target in mapping and alias not in mapping:
            mapping[alias] = mapping[target]

    return atlas, mapping


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--jar",
        type=Path,
        default=Path(
            "/home/rayray/.local/share/PrismLauncher/libraries/com/mojang/minecraft/1.20.1/minecraft-1.20.1-client.jar"
        ),
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("/home/rayray/Downloads/0x_Cursor/MC_TwitchIntegration/assets"),
    )
    args = ap.parse_args()

    work = Path("/tmp/mc_tex_atlas_build")
    if work.exists():
        shutil.rmtree(work)
    extract_jar(args.jar, work)

    item_tex = load_kind(work, "item")
    block_tex = load_kind(work, "block")
    atlas, mapping = pack(item_tex, block_tex)

    args.out.mkdir(parents=True, exist_ok=True)
    atlas_path = args.out / "atlas.png"
    json_path = args.out / "atlas.json"
    atlas.save(atlas_path, optimize=True)
    json_path.write_text(json.dumps(mapping, separators=(",", ":"), sort_keys=True))
    print(f"wrote {atlas_path} ({atlas.size[0]}x{atlas.size[1]}, {atlas_path.stat().st_size} bytes)")
    print(f"wrote {json_path} ({mapping['_meta']['count']} icons)")


if __name__ == "__main__":
    main()
