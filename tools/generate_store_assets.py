"""Generate promotional tiles.

The two Web Store screenshots in store-assets/ are captured from the current
extension experience; this script intentionally does not regenerate them.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'store-assets'
ICON = ROOT / 'icons' / 'icon128.png'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
SERIF = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'


def font(path, size):
    return ImageFont.truetype(path, size)


def text(draw, xy, value, size=20, color='#dfe6ef', bold=False, serif=False):
    draw.text(xy, value, font=font(SERIF if serif else BOLD if bold else FONT, size), fill=color)


def card(draw, box, fill='#17263a', outline='#4b5b70', radius=8):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def badge(draw, xy, label, color='#3f765d'):
    x, y = xy
    width = max(118, len(label) * 10 + 28)
    draw.rounded_rectangle((x, y, x + width, y + 34), radius=6, fill=color, outline='#d0aa5b', width=1)
    text(draw, (x + 12, y + 7), label, 15, '#e9f8de', bold=True)


def shield(image, xy, size):
    icon = Image.open(ICON).convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
    image.alpha_composite(icon, xy)


def small_promo():
    image = Image.new('RGBA', (440, 280), '#0b1523')
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 440, 280), fill='#101d2e')
    draw.ellipse((300, -90, 520, 130), fill='#1d3850')
    draw.ellipse((-120, 180, 130, 430), fill='#172b3e')
    shield(image, (28, 56), 118)
    text(draw, (166, 72), 'Loot', 31, '#f0d381', bold=True, serif=True)
    text(draw, (166, 108), 'Captain', 31, '#f0d381', bold=True, serif=True)
    text(draw, (168, 160), 'EverQuest gear comparison', 15, '#c3ceda')
    badge(draw, (168, 194), 'UPGRADE  +1,240')
    return image


def marquee_promo():
    image = Image.new('RGBA', (1400, 560), '#09121f')
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1400, 560), fill='#101d2e')
    draw.ellipse((920, -280, 1550, 420), fill='#1b344c')
    draw.ellipse((-250, 310, 450, 950), fill='#142b3d')
    shield(image, (74, 118), 240)
    text(draw, (368, 122), 'Loot Captain', 56, '#f0d381', bold=True, serif=True)
    text(draw, (372, 202), 'Compare gear before spending loot.', 25, '#dfe6ef')
    text(draw, (372, 252), 'Local profiles  ·  Slot-aware stats  ·  RaidLoot + OpenDKP', 18, '#9fb0c3')
    badge(draw, (372, 318), 'UPGRADE  +1,240')
    card(draw, (840, 94, 1318, 454), '#0b1523', '#53677f', 12)
    text(draw, (880, 126), 'CLOAK OF THE FALLEN', 21, '#f0d381', bold=True, serif=True)
    text(draw, (880, 164), 'Worn item  →  Candidate item', 14, '#9eacbc')
    for i, (label, value) in enumerate([('AC', '+12'), ('HP', '+118'), ('Heroics', '+14'), ('Luck', '+22')]):
        y = 214 + i * 48
        draw.line((880, y + 30, 1274, y + 30), fill='#24384f', width=1)
        text(draw, (892, y), label, 16, '#c3ceda', bold=True)
        text(draw, (1178, y), value, 16, '#84d7a2', bold=True)
    text(draw, (880, 410), '1AC = 10HP', 16, '#f0d381', bold=True)
    text(draw, (372, 438), 'No account. No tracking. Your profiles stay local.', 15, '#8fa0b4')
    return image


def save(name, image):
    image.convert('RGB').save(OUT / name, 'PNG', optimize=True)
    assert Image.open(OUT / name).size == image.size


OUT.mkdir(exist_ok=True)
save('promo-small-440x280.png', small_promo())
save('promo-marquee-1400x560.png', marquee_promo())
