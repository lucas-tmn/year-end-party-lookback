#!/usr/bin/env python3
"""Sinh 30 ảnh giả (ngang/dọc, kích thước lớn như ảnh DSLR) để test."""
import colorsys
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
random.seed(7)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 420)
except Exception:
    font = ImageFont.load_default()

for i in range(1, 31):
    portrait = i % 4 == 0
    w, h = (4000, 6000) if portrait else (6000, 4000)
    hue = (i * 0.071) % 1
    top = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(hue, 0.55, 0.95))
    bot = tuple(int(c * 255) for c in colorsys.hsv_to_rgb((hue + 0.15) % 1, 0.8, 0.45))
    small = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        small.putpixel((0, y), tuple(int(top[k] * (1 - t) + bot[k] * t) for k in range(3)))
    im = small.resize((w, h), Image.BILINEAR)
    d = ImageDraw.Draw(im)
    for _ in range(14):
        r = random.randint(200, 900)
        x, y = random.randint(0, w), random.randint(0, h)
        c = tuple(random.randint(120, 255) for _ in range(3))
        d.ellipse((x - r, y - r, x + r, y + r), outline=c, width=40)
    txt = f"{i:02d}"
    tw = d.textlength(txt, font=font)
    d.text(((w - tw) / 2, h / 2 - 250), txt, fill=(255, 255, 255), font=font)
    im.save(out / f"DSC_{i:04d}.jpg", quality=95)
print("ok", len(list(out.glob("*.jpg"))))
