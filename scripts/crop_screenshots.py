# /// script
# dependencies = [
#   "Pillow",
# ]
# ///
"""Crop screenshots: remove top 260px and bottom 130px, overwrite in place.

Usage:
    uv run scripts/crop_screenshots.py
"""

from pathlib import Path
from PIL import Image

SCREENS_DIR = Path(__file__).resolve().parent.parent / "screens"
TOP_CROP = 260
BOTTOM_CROP = 130


def main():
    files = sorted(SCREENS_DIR.glob("screenshot_*.jpg"))
    if not files:
        print("No screenshots found in", SCREENS_DIR)
        return

    for f in files:
        img = Image.open(f)
        w, h = img.size
        new_h = h - TOP_CROP - BOTTOM_CROP
        if new_h <= 0:
            print(f"Skipping {f.name}: too small ({w}x{h})")
            continue
        cropped = img.crop((0, TOP_CROP, w, h - BOTTOM_CROP))
        cropped.save(f)
        print(f"Cropped {f.name}: {w}x{h} → {w}x{new_h}")


if __name__ == "__main__":
    main()
