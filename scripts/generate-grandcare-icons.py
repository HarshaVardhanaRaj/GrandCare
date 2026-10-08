"""Render the GrandCare heart-and-capsule SVG mark as installable PNG icons."""

from math import ceil, cos, pi, sin
from pathlib import Path
import struct
import zlib


ROOT = Path(__file__).resolve().parents[1]


def cubic(p0, p1, p2, p3, steps=24):
    points = []
    for i in range(steps):
        t = i / steps
        u = 1 - t
        points.append((
            u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
        ))
    return points


def heart_points():
    curves = [
        ((256, 421), (216, 385), (82, 286), (82, 177)),
        ((82, 177), (82, 99), (166, 60), (231, 107)),
        ((231, 107), (244, 116), (251, 127), (256, 136)),
        ((256, 136), (261, 127), (268, 116), (281, 107)),
        ((281, 107), (346, 60), (430, 99), (430, 177)),
        ((430, 177), (430, 286), (296, 385), (256, 421)),
    ]
    return [point for curve in curves for point in cubic(*curve)]


def rounded_rect_points(left, top, right, bottom, radius, steps=12):
    points = []
    arcs = [
        (right - radius, top + radius, -90, 0),
        (right - radius, bottom - radius, 0, 90),
        (left + radius, bottom - radius, 90, 180),
        (left + radius, top + radius, 180, 270),
    ]
    for cx, cy, start, end in arcs:
        for i in range(steps + 1):
            angle = (start + (end - start) * i / steps) * pi / 180
            points.append((cx + radius * cos(angle), cy + radius * sin(angle)))
    return points


def rotate(point, degrees=-45, center=(256, 256)):
    angle = degrees * pi / 180
    x, y = point[0] - center[0], point[1] - center[1]
    return (center[0] + x * cos(angle) - y * sin(angle),
            center[1] + x * sin(angle) + y * cos(angle))


def fill_polygon(pixels, width, height, points, color, scale):
    polygon = [(x * scale, y * scale) for x, y in points]
    low = max(0, int(min(y for _, y in polygon)))
    high = min(height, ceil(max(y for _, y in polygon)))
    rgba = bytes(color)
    for y in range(low, high):
        scan = y + 0.5
        crossings = []
        for i, (x1, y1) in enumerate(polygon):
            x2, y2 = polygon[(i + 1) % len(polygon)]
            if (y1 <= scan < y2) or (y2 <= scan < y1):
                crossings.append(x1 + (scan - y1) * (x2 - x1) / (y2 - y1))
        crossings.sort()
        for left, right in zip(crossings[::2], crossings[1::2]):
            x0 = max(0, int(ceil(left - 0.5)))
            x1 = min(width, int(ceil(right - 0.5)))
            if x1 > x0:
                start = (y * width + x0) * 4
                pixels[start:start + (x1 - x0) * 4] = rgba * (x1 - x0)


def icon_bytes(size):
    scale = 2
    width = height = size * scale
    factor = width / 512
    pixels = bytearray(width * height * 4)
    fill_polygon(pixels, width, height,
                 rounded_rect_points(0, 0, 512, 512, 112),
                 (49, 125, 104, 255), factor)
    fill_polygon(pixels, width, height, heart_points(),
                 (255, 255, 255, 255), factor)

    pill = rounded_rect_points(189, 222, 323, 290, 34)
    fill_polygon(pixels, width, height, [rotate(point) for point in pill],
                 (220, 239, 228, 255), factor)
    seam = [rotate(point) for point in ((252, 224), (260, 224), (260, 288), (252, 288))]
    fill_polygon(pixels, width, height, seam, (49, 125, 104, 255), factor)

    downsampled = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            source = ((2 * y) * width + 2 * x) * 4
            target = (y * size + x) * 4
            for channel in range(4):
                downsampled[target + channel] = (
                    pixels[source + channel] + pixels[source + 4 + channel]
                    + pixels[source + width * 4 + channel]
                    + pixels[source + width * 4 + 4 + channel]
                ) // 4

    raw = b"".join(b"\0" + downsampled[y * size * 4:(y + 1) * size * 4]
                   for y in range(size))
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


if __name__ == "__main__":
    icon_dir = ROOT / "public" / "icons"
    for size in (192, 512):
        (icon_dir / f"grandcare-{size}.png").write_bytes(icon_bytes(size))
        print(f"Wrote grandcare-{size}.png")
