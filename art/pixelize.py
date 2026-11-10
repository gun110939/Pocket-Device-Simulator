"""Turn a generated image into clean pixel art: magenta becomes transparent, the sprite is
cropped, snapped to a GRID-cell grid (majority colour per cell) and locked to the 4-colour palette.
usage: pixelize.py IN.png OUT.png GRID [pad]   (needs ffmpeg; no PIL)
GRID is the output size of the longer side in pixels. Output is RGBA at 1 px per art pixel."""
import struct, subprocess, sys, zlib
from collections import Counter

PALETTE = [(0x0f, 0x38, 0x0f), (0x30, 0x62, 0x30), (0x8b, 0xac, 0x0f), (0x9b, 0xbc, 0x0f)]
MAGENTA = (255, 0, 255)
CANDIDATES = PALETTE + [MAGENTA]


def load_rgb(path):
    w, h = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                                    '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout.strip().split(','))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return w, h, raw


def nearest(r, g, b):
    # strong magenta and pink fringe count as background
    if r > 150 and b > 150 and g < 120:
        return 4
    best, bi = 1 << 30, 0
    for i, (pr, pg, pb) in enumerate(CANDIDATES):
        d = (r - pr) ** 2 * 3 + (g - pg) ** 2 * 4 + (b - pb) ** 2 * 2
        if d < best:
            best, bi = d, i
    return bi


def write_png(path, w, h, rgba_rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rgba_rows)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    src, out, grid = sys.argv[1], sys.argv[2], int(sys.argv[3])
    pad = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    w, h, raw = load_rgb(src)
    cls = bytearray(w * h)
    for i in range(w * h):
        cls[i] = nearest(raw[3 * i], raw[3 * i + 1], raw[3 * i + 2])
    # bounding box of the sprite
    xs = [i % w for i in range(w * h) if cls[i] != 4]
    ys = [i // w for i in range(w * h) if cls[i] != 4]
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    bw, bh = x1 - x0, y1 - y0
    cell = max(bw, bh) / grid
    gw, gh = max(1, round(bw / cell)), max(1, round(bh / cell))
    rows = []
    for gy in range(gh + 2 * pad):
        row = []
        for gx in range(gw + 2 * pad):
            cx, cy = gx - pad, gy - pad
            if not (0 <= cx < gw and 0 <= cy < gh):
                row += [0, 0, 0, 0]
                continue
            sx0, sx1 = x0 + int(cx * cell), x0 + int((cx + 1) * cell)
            sy0, sy1 = y0 + int(cy * cell), y0 + int((cy + 1) * cell)
            c = Counter()
            # sample the inner part of the cell to avoid neighbouring outlines bleeding in
            mx, my = max(1, (sx1 - sx0) // 5), max(1, (sy1 - sy0) // 5)
            for y in range(sy0 + my, max(sy0 + my + 1, sy1 - my)):
                base = y * w
                for x in range(sx0 + mx, max(sx0 + mx + 1, sx1 - mx)):
                    c[cls[base + x]] += 1
            k = c.most_common(1)[0][0] if c else 4
            row += [0, 0, 0, 0] if k == 4 else [*PALETTE[k], 255]
        rows.append(row)
    write_png(out, gw + 2 * pad, gh + 2 * pad, rows)
    print(out, f'{gw + 2 * pad}x{gh + 2 * pad}')


main()
