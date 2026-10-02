#!/usr/bin/env python3
"""Генерация иконки приложения (build/icon_1024.png) — чистый Python, без зависимостей."""
import zlib, struct, os

W = H = 1024

# ── буфер RGBA ────────────────────────────────────────────
px = bytearray(W * H * 4)

def setp(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 4
        px[i:i+4] = bytes(c)

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def rounded_rect(x0, y0, x1, y1, r, color):
    """Заливка прямоугольника со скруглёнными углами."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            # расстояние до ближайшего угла
            cx = x0 + r if x < x0 + r else (x1 - r - 1 if x > x1 - r - 1 else x)
            cy = y0 + r if y < y0 + r else (y1 - r - 1 if y > y1 - r - 1 else y)
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r or (x0 + r <= x < x1 - r) or (y0 + r <= y < y1 - r):
                if (x0 <= x < x1) and (y0 <= y < y1):
                    # точная проверка углов
                    if x < x0 + r and y < y0 + r and (x - (x0 + r)) ** 2 + (y - (y0 + r)) ** 2 > r * r:
                        continue
                    if x >= x1 - r and y < y0 + r and (x - (x1 - r - 1)) ** 2 + (y - (y0 + r)) ** 2 > r * r:
                        continue
                    if x < x0 + r and y >= y1 - r and (x - (x0 + r)) ** 2 + (y - (y1 - r - 1)) ** 2 > r * r:
                        continue
                    if x >= x1 - r and y >= y1 - r and (x - (x1 - r - 1)) ** 2 + (y - (y1 - r - 1)) ** 2 > r * r:
                        continue
                    setp(x, y, color)

# ── фон: вертикальный градиент бирюзовый ─────────────────
top = (20, 184, 166)      # teal-400
bottom = (13, 94, 116)    # teal-700
R = 210
for y in range(H):
    row_col = lerp(top, bottom, y / H)
    for x in range(W):
        # скруглённые углы иконки
        cx = R if x < R else (W - R - 1 if x > W - R - 1 else x)
        cy = R if y < R else (H - R - 1 if y > H - R - 1 else y)
        if (x - cx) ** 2 + (y - cy) ** 2 <= R * R:
            setp(x, y, row_col + (255,))

# ── белая «панель» клавиатуры ─────────────────────────────
PLATE = (248, 250, 252, 255)
rounded_rect(120, 330, 904, 694, 64, PLATE)

# ── клавиши ───────────────────────────────────────────────
KEY = (15, 23, 42, 255)        # тёмно-синий
ACCENT = (251, 191, 36, 255)   # янтарный акцент
KR = 16

def key(x, y, w, h=96, color=KEY):
    rounded_rect(x, y, x + w, y + h, KR, color)

inner_x, inner_w = 148, 728
rows_y = [348, 464, 580]

# ряд 1: 10 клавиш
w1, gap = 63, 10
for i in range(10):
    x = inner_x + i * (w1 + gap)
    key(x, rows_y[0], w1, color=ACCENT if i == 4 else KEY)

# ряд 2: 9 клавиш со сдвигом
w2 = 71
start2 = inner_x + (inner_w - (9 * w2 + 8 * gap)) // 2
for i in range(9):
    x = start2 + i * (w2 + gap)
    key(x, rows_y[1], w2)

# ряд 3: 4 клавиши + пробел
ws = 63
space_w = 300
total = ws * 4 + space_w + 4 * gap
start3 = inner_x + (inner_w - total) // 2
xs = start3
for i in range(5):
    if i == 2:
        key(xs, rows_y[2], space_w)
        xs += space_w + gap
    else:
        key(xs, rows_y[2], ws)
        xs += ws + gap

# ── запись PNG ────────────────────────────────────────────
raw = b''
for y in range(H):
    raw += b'\x00' + bytes(px[y * W * 4:(y + 1) * W * 4])

def chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(raw, 9))
png += chunk(b'IEND', b'')

os.makedirs('build', exist_ok=True)
with open('build/icon_1024.png', 'wb') as f:
    f.write(png)
print('build/icon_1024.png', len(png), 'bytes')
