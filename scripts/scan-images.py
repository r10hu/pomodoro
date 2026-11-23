#!/usr/bin/env python3
"""
Scans assets/img/ and generates assets/img/images.json so any image uploaded
to assets/img/ automatically appears in the Pomodoro app's Image select menu.

Runs automatically via GitHub Actions on every push to GitHub, and can also be
run locally with: python3 scripts/scan-images.py
"""

import json
import re
from pathlib import Path
from urllib.parse import quote

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"}

REPO_ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = REPO_ROOT / "assets" / "img"
MANIFEST_PATH = IMG_DIR / "images.json"


def make_label(stem: str) -> str:
    """Turn a filename like 'my_pixel-castle' into 'My Pixel Castle'."""
    words = re.split(r"[-_\s]+", stem.strip())
    cleaned = [w for w in words if w]
    if not cleaned:
        return stem
    return " ".join(w[0].upper() + w[1:] if len(w) > 1 else w.upper() for w in cleaned)


def make_id(stem: str) -> str:
    """Create a clean, URL-safe ID from a filename stem."""
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return slug or "image"


def scan_images() -> list:
    if not IMG_DIR.is_dir():
        return []

    image_files = sorted(
        (
            p
            for p in IMG_DIR.iterdir()
            if p.is_file()
            and not p.name.startswith(".")
            and p.suffix.lower() in SUPPORTED_EXTENSIONS
        ),
        key=lambda p: p.name.lower(),
    )

    used_ids = set()
    entries = []

    for img_path in image_files:
        base_id = make_id(img_path.stem)
        img_id = base_id
        if img_id in used_ids:
            ext_slug = img_path.suffix.lstrip(".").lower()
            img_id = f"{base_id}-{ext_slug}"
        counter = 2
        while img_id in used_ids:
            img_id = f"{base_id}-{counter}"
            counter += 1
        used_ids.add(img_id)

        entries.append(
            {
                "id": img_id,
                "label": make_label(img_path.stem),
                "path": f"assets/img/{quote(img_path.name)}",
            }
        )

    return entries


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    entries = scan_images()
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Updated {MANIFEST_PATH.relative_to(REPO_ROOT)} with {len(entries)} image(s).")


if __name__ == "__main__":
    main()
