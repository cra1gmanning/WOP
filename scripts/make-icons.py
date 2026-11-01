#!/usr/bin/env python3
"""Draw the home-screen icons for the workout planner."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"


def write_png(path: Path, size: int, paint) -> None:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(paint(x, y, size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def rounded(x, y, size, radius, inset=0):
    px, py = x + 0.5, y + 0.5
    left, top = inset, inset
    right, bottom = size - inset, size - inset
    if px < left or py < top or px > right or py > bottom:
        return False
    centers = [
        (left + radius, top + radius),
        (right - radius, top + radius),
        (left + radius, bottom - radius),
        (right - radius, bottom - radius),
    ]
    for cx, cy in centers:
        if (px - cx) ** 2 + (py - cy) ** 2 > radius ** 2:
            in_corner_box = (px < left + radius or px > right - radius) and (py < top + radius or py > bottom - radius)
            if in_corner_box and abs(px - cx) <= radius and abs(py - cy) <= radius:
                return False
    return True


def glyph(x, y, size):
    """A nine-rung ladder, the thing the planner is built around."""
    nx = (x + 0.5) / size
    ny = (y + 0.5) / size
    if not (0.30 <= nx <= 0.70 and 0.22 <= ny <= 0.78):
        return False
    rail = nx < 0.38 or nx > 0.62
    rung_index = int((ny - 0.22) / (0.56 / 9))
    rung_start = 0.22 + rung_index * (0.56 / 9)
    rung = abs(ny - (rung_start + 0.012)) < 0.018 and 0.36 <= nx <= 0.64
    return rail or rung


def paint(maskable: bool):
    def pixel(x, y, size):
        bg = (12, 15, 18, 255)
        if maskable:
            inside = True
        else:
            inside = rounded(x, y, size, size * 0.22)
        if not inside:
            return (0, 0, 0, 0)
        if glyph(x, y, size):
            return (214, 255, 63, 255)
        return bg

    return pixel


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    write_png(ROOT / "icon-192.png", 192, paint(False))
    write_png(ROOT / "icon-512.png", 512, paint(False))
    write_png(ROOT / "apple-touch-icon.png", 180, paint(False))
    write_png(ROOT / "icon-512-maskable.png", 512, paint(True))


if __name__ == "__main__":
    main()
