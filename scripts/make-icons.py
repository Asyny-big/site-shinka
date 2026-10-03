#!/usr/bin/env python3
"""Генерация apple-touch-icon.png (180×180) в стиле favicon.svg. Нужен Pillow."""
from PIL import Image, ImageDraw
import math, os
S = 180 * 4
img = Image.new('RGB', (S, S), '#0d0d0c')
d = ImageDraw.Draw(img)
c = S / 2
def ring(r, w, col):
    d.ellipse([c - r, c - r, c + r, c + r], outline=col, width=int(w))
k = S / 100
ring(34 * k + 4.5 * k, 9 * k, '#f2f0eb')
ring(20 * k + 1.5 * k, 3 * k, '#f2f0eb')
for i in range(5):
    a = i * 2 * math.pi / 5
    x1, y1 = c + 7 * k * math.sin(a), c - 7 * k * math.cos(a)
    x2, y2 = c + 18 * k * math.sin(a), c - 18 * k * math.cos(a)
    d.line([x1, y1, x2, y2], fill='#f2f0eb', width=int(3.5 * k))
d.ellipse([c - 5 * k, c - 5 * k, c + 5 * k, c + 5 * k], fill='#ff4f12')
d.ellipse([c - 3.2 * k, c - 28 * k - 3.2 * k, c + 3.2 * k, c - 28 * k + 3.2 * k], fill='#ff4f12')
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'apple-touch-icon.png')
img.resize((180, 180), Image.LANCZOS).save(out, optimize=True)
print('ok', out)
