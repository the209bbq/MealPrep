#!/usr/bin/env python3
"""One-off: cut out Forkinator pose PNGs from white-background JPG sources."""
from __future__ import annotations

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


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def is_near_white(r: int, g: int, b: int) -> bool:
    return r >= BG_THRESHOLD and g >= BG_THRESHOLD and b >= BG_THRESHOLD


def is_pale_yellow(r: int, g: int, b: int) -> bool:
    return r >= 220 and g >= 210 and b >= 120 and not is_near_white(r, g, b)


def is_flood_matte(r: int, g: int, b: int) -> bool:
    return is_near_white(r, g, b) or is_pale_yellow(r, g, b)


def is_idea_halo_pixel(r: int, g: int, b: int) -> bool:
    """Pale, low-saturation pixels (glow fringe and JPG boxes on white)."""
    if is_flood_matte(r, g, b):
        return True
    mn = min(r, g, b)
    mx = max(r, g, b)
    if mx - mn > 55:
        return False
    if mn < 192:
        return False
    # Neutral gray fringe from JPG glow mats (not yellow bulb / metal shading).
    return abs(r - g) <= 10 and abs(g - b) <= 12


def flood_transparent(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        return is_near_white(r, g, b)

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


def soft_matte_idea_glow(img: Image.Image) -> Image.Image:
    """Edge-connected pale pixels fade to transparent (no boxy glow halo)."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]

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
        r, g, b, a = px[x, y]
        if a == 0:
            visited[y][x] = True
            q.append((x + 1, y))
            q.append((x - 1, y))
            q.append((x, y + 1))
            q.append((x, y - 1))
            continue
        if not is_flood_matte(r, g, b):
            continue
        visited[y][x] = True
        apply_idea_alpha_matte(px, x, y)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    return rgba


def flood_transparent_idea(img: Image.Image) -> Image.Image:
    """Remove remaining opaque near-white; keep partial-alpha glow fringe."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        if a < 255:
            return False
        return is_near_white(r, g, b)

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


def apply_idea_alpha_matte(px, x: int, y: int) -> None:
    r, g, b, a = px[x, y]
    if a == 0:
        return
    if not is_idea_halo_pixel(r, g, b):
        return
    mn = min(r, g, b)
    new_a = clamp((255 - mn) * 3, 0, 255)
    if new_a == 0:
        px[x, y] = (0, 0, 0, 0)
        return
    if new_a >= 254:
        return
    r2 = clamp(int(r * 255 / new_a), 0, 255)
    g2 = clamp(int(g * 255 / new_a), 0, 255)
    b2 = clamp(int(b * 255 / new_a), 0, 255)
    px[x, y] = (r2, g2, b2, new_a)


def soften_remaining_idea_halos(img: Image.Image) -> Image.Image:
    """Fade enclosed pale pixels (JPG glow boxes not edge-connected)."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    for y in range(h):
        for x in range(w):
            apply_idea_alpha_matte(px, x, y)
    return rgba


def strip_thinking_cloud_components(img: Image.Image) -> Image.Image:
    """Remove only right-side thought cloud + dots, not the fork handle."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    min_x_cut = int(515 / 1024 * w)
    top_half_max_y = int(h * 0.5)

    fg = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            fg[y][x] = not is_near_white(r, g, b)

    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if not fg[sy][sx] or seen[sy][sx]:
                continue
            stack = [(sx, sy)]
            seen[sy][sx] = True
            cells: list[tuple[int, int]] = []
            min_x, min_y, max_x, max_y = sx, sy, sx, sy
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and fg[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))

            if min_x > min_x_cut and max_y < top_half_max_y:
                for x, y in cells:
                    px[x, y] = (255, 255, 255)

    return rgb


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
        work = strip_thinking_cloud_components(work)
        cut = flood_transparent(work)
    elif "idea" in name:
        cut = soft_matte_idea_glow(work)
        cut = soften_remaining_idea_halos(cut)
        cut = flood_transparent_idea(cut)
    else:
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
        if name in ("forkinator-idea.png", "forkinator-sad.png") and (OUT_DIR / name).exists():
            print(f"{name}: skipped (unchanged)")
            continue
        process(name, src)
        out = OUT_DIR / name
        print(f"{name}: {out.stat().st_size} bytes, {Image.open(out).size}")


if __name__ == "__main__":
    main()
