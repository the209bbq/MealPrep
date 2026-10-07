#!/usr/bin/env python3
"""One-off: cut out Forkinator pose PNGs from white-background JPG sources."""
from __future__ import annotations

import os
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "forkinator"
SOURCES = {
    "forkinator-idea.png": Path("/home/ubuntu/.cursor/projects/workspace/uploads/idea-src_3fd3.jpg"),
    "forkinator-thinking.png": Path(
        "/home/ubuntu/.cursor/projects/workspace/uploads/thinking-src_9a87.jpg"
    ),
    "forkinator-sad.png": Path("/home/ubuntu/.cursor/projects/workspace/uploads/sad-src_71e7.jpg"),
}
MAX_SIDE = 512
MAX_BYTES = 150_000
BG_THRESHOLD = 248


def flood_transparent(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        return r >= BG_THRESHOLD and g >= BG_THRESHOLD and b >= BG_THRESHOLD

    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if visited[y][x]:
            continue
        visited[y][x] = True
        if not is_bg(x, y):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    return rgba


def strip_thinking_cloud(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    cut_x = int(520 / 1024 * w)
    px = rgba.load()
    for y in range(h):
        for x in range(cut_x, w):
            px[x, y] = (0, 0, 0, 0)
    return rgba


def crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def resize_max_side(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    scale = min(1.0, max_side / max(w, h))
    if scale >= 1.0:
        return img
    nw = max(1, int(w * scale))
    nh = max(1, int(h * scale))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def save_under_budget(img: Image.Image, path: Path) -> None:
    for compress_level in range(9, 2, -1):
        img.save(path, format="PNG", optimize=True, compress_level=compress_level)
        if path.stat().st_size <= MAX_BYTES:
            return
    # last resort: slightly smaller
    w, h = img.size
    smaller = img.resize((max(1, int(w * 0.9)), max(1, int(h * 0.9))), Image.Resampling.LANCZOS)
    smaller.save(path, format="PNG", optimize=True, compress_level=9)


def composite_check(img: Image.Image, path: Path) -> None:
    dark = Image.new("RGBA", img.size, (18, 24, 38, 255))
    dark.alpha_composite(img)
    dark.save(path, format="PNG")


def process(name: str, src: Path) -> None:
    raw = Image.open(src)
    work = raw
    if "thinking" in name:
        work = strip_thinking_cloud(work)
    cut = flood_transparent(work)
    cropped = crop_to_content(cut)
    sized = resize_max_side(cropped, MAX_SIDE)
    out = OUT_DIR / name
    save_under_budget(sized, out)
    composite_check(sized, OUT_DIR / f".{name.replace('.png', '')}-dark-check.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES.items():
        if not src.exists():
            raise SystemExit(f"missing source: {src}")
        process(name, src)
        out = OUT_DIR / name
        print(f"{name}: {out.stat().st_size} bytes, {Image.open(out).size}")


if __name__ == "__main__":
    main()
