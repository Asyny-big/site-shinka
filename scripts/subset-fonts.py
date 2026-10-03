#!/usr/bin/env python3
"""Сборка самохостинговых шрифтов (Latin + Cyrillic) из системных OFL-шрифтов.
Запуск один раз: python3 scripts/subset-fonts.py  (нужен fontTools).
Результат уже лежит в public/fonts — запускать повторно не обязательно."""
from fontTools import subset
from fontTools.ttLib import TTFont
import os, sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts')
os.makedirs(OUT, exist_ok=True)
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x400, 0x460)) +
    [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x201E, 0x2022,
     0x2026, 0x2032, 0x2116, 0x20BD, 0x2190, 0x2191, 0x2192, 0x2193, 0x2197, 0x2198, 0x2212,
     0x00D7, 0x2248, 0x2264, 0x2265, 0x00B0, 0x2300, 0x00D8, 0x03B8, 0x2605, 0x2606, 0x2713, 0x2116, 0x2009, 0x202F]
)
SRC = {
    'inter-display-black': '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf',
    'inter-regular': '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
    'inter-semibold': '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',
    'mono-regular': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    'mono-bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
}
for name, path in SRC.items():
    opts = subset.Options()
    opts.flavor = 'woff'
    opts.layout_features = ['kern', 'liga', 'calt', 'tnum', 'case', 'ss01', 'cv11']
    opts.name_IDs = ['*']
    opts.hinting = False
    opts.desubroutinize = True
    font = TTFont(path)
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    out = os.path.join(OUT, name + '.woff')
    if name.startswith('mono'):
        # «Liberation» — Reserved Font Name по OFL: модифицированный (субсет) шрифт переименован.
        for rec in font['name'].names:
            try:
                txt = rec.toUnicode()
            except Exception:
                continue
            if 'Liberation' in txt:
                rec.string = txt.replace('Liberation Mono', 'YD Mono').replace('LiberationMono', 'YDMono').replace('Liberation', 'YD')
    font.flavor = 'woff'
    font.save(out)
    print(name, os.path.getsize(out) // 1024, 'KB')
