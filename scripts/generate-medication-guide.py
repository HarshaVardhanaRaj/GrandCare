"""Generate GrandCare's four-second, no-dependency tablet guide GIF and poster."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


WIDTH, HEIGHT = 400, 140
FRAME_COUNT = 40
FRAME_DELAY_CS = 10  # 100 ms per frame; four seconds per loop.
PALETTE = [
    (244, 248, 245),  # canvas
    (255, 255, 255),  # white
    (234, 244, 239),  # pale green
    (49, 125, 104),   # green
    (34, 103, 81),    # deep green
    (30, 48, 44),     # ink
    (112, 129, 121),  # muted
    (184, 213, 193),  # soft green
    (232, 180, 93),   # tablet
    (247, 226, 176),  # light tablet
    (203, 231, 241),  # water
    (101, 175, 198),  # water line
    (215, 229, 219),  # border
    (240, 203, 180),  # skin tone accent
    (90, 107, 98),    # outline
    (225, 238, 229),  # completed step
]


def new_frame() -> bytearray:
    return bytearray([0]) * (WIDTH * HEIGHT)


def pixel(image: bytearray, x: int, y: int, color: int) -> None:
    if 0 <= x < WIDTH and 0 <= y < HEIGHT:
        image[y * WIDTH + x] = color


def rect(image: bytearray, x0: int, y0: int, x1: int, y1: int, color: int) -> None:
    x0, x1 = sorted((max(0, x0), min(WIDTH - 1, x1)))
    y0, y1 = sorted((max(0, y0), min(HEIGHT - 1, y1)))
    if x0 <= x1 and y0 <= y1:
        row = bytes([color]) * (x1 - x0 + 1)
        for y in range(y0, y1 + 1):
            start = y * WIDTH + x0
            image[start:start + len(row)] = row


def circle(image: bytearray, cx: int, cy: int, radius: int, color: int) -> None:
    for dy in range(-radius, radius + 1):
        span = int(math.sqrt(max(0, radius * radius - dy * dy)))
        rect(image, cx - span, cy + dy, cx + span, cy + dy, color)


def ring(image: bytearray, cx: int, cy: int, radius: int, thickness: int, color: int) -> None:
    outer = radius
    inner = max(0, radius - thickness)
    for dy in range(-outer, outer + 1):
        outer_span = int(math.sqrt(max(0, outer * outer - dy * dy)))
        if abs(dy) <= inner:
            inner_span = int(math.sqrt(max(0, inner * inner - dy * dy)))
            pixel_start, pixel_end = cx - outer_span, cx - inner_span - 1
            rect(image, pixel_start, cy + dy, pixel_end, cy + dy, color)
            pixel_start, pixel_end = cx + inner_span + 1, cx + outer_span
            rect(image, pixel_start, cy + dy, pixel_end, cy + dy, color)
        else:
            rect(image, cx - outer_span, cy + dy, cx + outer_span, cy + dy, color)


def line(image: bytearray, x0: int, y0: int, x1: int, y1: int, color: int, width: int = 2) -> None:
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    error = dx - dy
    while True:
        for oy in range(-(width // 2), width // 2 + 1):
            for ox in range(-(width // 2), width // 2 + 1):
                pixel(image, x0 + ox, y0 + oy, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = error * 2
        if e2 > -dy:
            error -= dy
            x0 += sx
        if e2 < dx:
            error += dx
            y0 += sy


def rounded_box(image: bytearray, x0: int, y0: int, x1: int, y1: int,
                radius: int, fill: int, outline: int | None = None) -> None:
    if outline is not None:
        rounded_box(image, x0 - 1, y0 - 1, x1 + 1, y1 + 1, radius + 1, outline)
    rect(image, x0 + radius, y0, x1 - radius, y1, fill)
    rect(image, x0, y0 + radius, x1, y1 - radius, fill)
    for cx in (x0 + radius, x1 - radius):
        for cy in (y0 + radius, y1 - radius):
            circle(image, cx, cy, radius, fill)


def draw_document(image: bytearray, cx: int, cy: int) -> None:
    rounded_box(image, cx - 10, cy - 19, cx + 10, cy + 19, 3, 1, 14)
    for y in (cy - 10, cy - 4, cy + 2):
        line(image, cx - 5, y, cx + 5, y, 7, 2)
    line(image, cx - 5, cy + 11, cx - 1, cy + 15, 3, 3)
    line(image, cx - 1, cy + 15, cx + 6, cy + 7, 3, 3)


def draw_tablet(image: bytearray, cx: int, cy: int) -> None:
    rounded_box(image, cx - 15, cy - 8, cx + 15, cy + 8, 8, 8, 14)
    rect(image, cx, cy - 6, cx + 13, cy + 6, 9)
    line(image, cx, cy - 7, cx, cy + 7, 14, 1)


def draw_water(image: bytearray, cx: int, cy: int) -> None:
    # A clear glass with a visible water line.
    line(image, cx - 11, cy - 17, cx + 11, cy - 17, 14, 2)
    line(image, cx - 9, cy - 15, cx - 6, cy + 17, 14, 2)
    line(image, cx + 9, cy - 15, cx + 6, cy + 17, 14, 2)
    line(image, cx - 6, cy + 17, cx + 6, cy + 17, 14, 2)
    rect(image, cx - 7, cy + 1, cx + 7, cy + 15, 10)
    line(image, cx - 7, cy + 1, cx + 7, cy + 1, 11, 2)


def draw_check(image: bytearray, cx: int, cy: int) -> None:
    ring(image, cx, cy, 19, 3, 3)
    line(image, cx - 9, cy, cx - 2, cy + 7, 3, 4)
    line(image, cx - 2, cy + 7, cx + 11, cy - 8, 3, 4)


def draw_arrow(image: bytearray, x: int, y: int, color: int) -> None:
    line(image, x - 8, y, x + 7, y, color, 2)
    line(image, x + 2, y - 5, x + 7, y, color, 2)
    line(image, x + 2, y + 5, x + 7, y, color, 2)


def make_frame(frame_number: int) -> bytearray:
    image = new_frame()
    rounded_box(image, 5, 5, WIDTH - 6, HEIGHT - 6, 20, 1, 12)
    stage = frame_number // 10
    centers = (52, 151, 250, 348)
    cy = HEIGHT // 2

    for index, cx in enumerate(centers):
        if index < stage:
            fill, outline = 15, 3
        elif index == stage:
            fill, outline = 2, 4
            pulse = 33 + round(2 * math.sin((frame_number % 10) * math.pi / 9))
            ring(image, cx, cy, pulse, 2, 7)
        else:
            fill, outline = 1, 12
        circle(image, cx, cy, 28, fill)
        ring(image, cx, cy, 28, 2, outline)

    draw_arrow(image, 102, cy, 3 if stage > 0 else 12)
    draw_arrow(image, 201, cy, 3 if stage > 1 else 12)
    draw_arrow(image, 300, cy, 3 if stage > 2 else 12)
    draw_document(image, centers[0], cy)
    draw_tablet(image, centers[1], cy)
    draw_water(image, centers[2], cy)
    draw_check(image, centers[3], cy)
    return image


def lzw_encode(pixels: bytearray) -> bytes:
    # Keep the code width at five bits and reset well before the 32-code boundary.
    # Frequent resets are small and make this encoder simple and fully portable.
    clear_code, end_code = 16, 17
    codes = [clear_code]
    table: dict[tuple[int, int], int] = {}
    next_code = 18
    prefix = pixels[0]

    for symbol in pixels[1:]:
        key = (prefix, symbol)
        found = table.get(key)
        if found is not None:
            prefix = found
            continue
        codes.append(prefix)
        if next_code < 30:
            table[key] = next_code
            next_code += 1
        if next_code >= 30:
            codes.append(clear_code)
            table = {}
            next_code = 18
        prefix = symbol

    codes.extend((prefix, end_code))
    packed = bytearray()
    accumulator = bit_count = 0
    for code in codes:
        accumulator |= code << bit_count
        bit_count += 5
        while bit_count >= 8:
            packed.append(accumulator & 0xFF)
            accumulator >>= 8
            bit_count -= 8
    if bit_count:
        packed.append(accumulator & 0xFF)

    blocks = bytearray([4])  # Minimum code size for the 16-entry global palette.
    for start in range(0, len(packed), 255):
        chunk = packed[start:start + 255]
        blocks.append(len(chunk))
        blocks.extend(chunk)
    blocks.append(0)
    return bytes(blocks)


def gif_bytes(frames: list[bytearray]) -> bytes:
    palette = bytearray()
    for color in PALETTE:
        palette.extend(color)
    output = bytearray(b"GIF89a")
    output.extend(struct.pack("<HHBBB", WIDTH, HEIGHT, 0xF3, 0, 0))
    output.extend(palette)
    output.extend(b"\x21\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00")

    for frame in frames:
        output.extend(b"\x21\xf9\x04\x00")
        output.extend(struct.pack("<H", FRAME_DELAY_CS))
        output.extend(b"\x00\x00")
        output.extend(b"\x2c")
        output.extend(struct.pack("<HHHHB", 0, 0, WIDTH, HEIGHT, 0))
        output.extend(lzw_encode(frame))
    output.append(0x3B)
    return bytes(output)


def png_bytes(image: bytearray) -> bytes:
    rgb = bytearray()
    for y in range(HEIGHT):
        rgb.append(0)  # PNG filter: None.
        row = image[y * WIDTH:(y + 1) * WIDTH]
        for color_id in row:
            rgb.extend(PALETTE[color_id])

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(rgb), level=9))
            + chunk(b"IEND", b""))


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    public = root / "public"
    frames = [make_frame(index) for index in range(FRAME_COUNT)]
    (public / "medication-guide-tablet.gif").write_bytes(gif_bytes(frames))
    (public / "medication-guide-tablet.png").write_bytes(png_bytes(frames[0]))
    print("Wrote four-second tablet guide GIF and reduced-motion poster.")


if __name__ == "__main__":
    main()
