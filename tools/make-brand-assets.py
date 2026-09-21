"""Regenerate every brand asset from the A-Z Globe logo.

    python tools/make-brand-assets.py      (requires Pillow)

Run this whenever `apps/azglobe/assets/icons/colored-LOGO-a-z.png` is replaced, then
`npx expo prebuild --clean` so Android/iOS pick the new icons up.


The source is a 10500x10500 PNG with the circular mark stacked above a "GLOBE"
wordmark and a lot of surrounding white. Different slots need different crops:

  app icon / adaptive foreground  -> the MARK only. The wordmark is unreadable
                                     at 48dp and Android's mask would clip it.
  splash / in-app brand           -> the full lockup, which has room to breathe.
"""
from PIL import Image, ImageChops
import os

Image.MAX_IMAGE_PIXELS = None
SRC = 'apps/azglobe/assets/icons/colored-LOGO-a-z.png'
# App icons are per-app; the brand mark is shared, so it lives in core.
APP = 'apps/azglobe/assets'
BRAND = 'packages/core/assets/brand'

im = Image.open(SRC).convert('RGBA')
W, H = im.size

# Ink mask: anything that is not white.
flat = Image.new('RGB', im.size, (255, 255, 255))
flat.paste(im, mask=im.split()[3])
mask = ImageChops.difference(flat, Image.new('RGB', im.size, (255, 255, 255))).convert('L')
ink = mask.point(lambda v: 255 if v > 10 else 0)
box = ink.getbbox()
print('ink bbox:', box)

# The mark and the wordmark are separated by a band of blank rows. Find the
# largest such band inside the ink area and split there. (An earlier attempt
# used row WIDTH instead, which cut the circle in half: the mark is widest at
# its middle, so walking up from the bottom hit that before reaching the gap.)
SAMPLE = 1024
small = ink.resize((SAMPLE, SAMPLE), Image.NEAREST)
sp = small.load()
profile = [sum(1 for x in range(SAMPLE) if sp[x, y] > 40) for y in range(SAMPLE)]
rows = [y for y, n in enumerate(profile) if n > 0]

runs, start = [], None
for y in range(rows[0], rows[-1] + 1):
    if profile[y] <= 2:
        if start is None:
            start = y
    elif start is not None:
        runs.append((start, y - 1))
        start = None
if not runs:
    raise SystemExit('no blank band found between mark and wordmark')

gap = max(runs, key=lambda r: r[1] - r[0])
split = (gap[0] + gap[1]) // 2
print(f'blank bands: {runs}; splitting at sampled row {split}')

scale = H / SAMPLE
split_y = int(split * scale)
print('split in source pixels: y =', split_y)

mark_box = (box[0], box[1], box[2], split_y)
print('mark box:', mark_box, '->', mark_box[2] - mark_box[0], 'x', mark_box[3] - mark_box[1])

mark = im.crop(mark_box)
lockup = im.crop(box)


def square(img, size, pad_ratio, bg=None):
    """Fit `img` into a square canvas, occupying (1 - 2*pad_ratio) of it."""
    canvas = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    inner = int(size * (1 - 2 * pad_ratio))
    w, h = img.size
    ratio = min(inner / w, inner / h)
    resized = img.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), Image.LANCZOS)
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2), resized)
    return canvas


def flatten(img, colour=(255, 255, 255, 255)):
    out = Image.new('RGBA', img.size, colour)
    out.alpha_composite(img)
    return out


os.makedirs(BRAND, exist_ok=True)
written = []


def save(img, path):
    img.save(path)
    written.append((path, img.size, os.path.getsize(path) // 1024))


# App icon — iOS renders it opaque and does its own rounding, so bake white in.
save(flatten(square(mark, 1024, 0.12)), f'{APP}/icon.png')

# Android adaptive foreground: content must sit inside the central ~66% of the
# 108dp canvas or the launcher's mask clips it.
save(square(mark, 1024, 0.26), f'{APP}/android-icon-foreground.png')

# The logo is multicolour, so the plate behind it is white rather than the
# brand red — red behind red/orange figures muddies them.
bgplate = Image.new('RGBA', (1024, 1024), (255, 255, 255, 255))
save(bgplate, f'{APP}/android-icon-background.png')

# Themed (monochrome) icon: a single-colour silhouette of the mark.
sil = Image.new('RGBA', mark.size, (0, 0, 0, 0))
alpha = mark.split()[3].point(lambda v: 255 if v > 40 else 0)
notwhite = ImageChops.difference(
    flatten(mark).convert('RGB'), Image.new('RGB', mark.size, (255, 255, 255))
).convert('L').point(lambda v: 255 if v > 10 else 0)
sil.putalpha(ImageChops.multiply(alpha, notwhite))
sil_black = Image.new('RGBA', mark.size, (0, 0, 0, 255))
sil_black.putalpha(sil.split()[3])
save(square(sil_black, 1024, 0.26), f'{APP}/android-icon-monochrome.png')

# Splash — the full lockup, transparent so it sits on the configured colour.
save(square(lockup, 1024, 0.18), f'{APP}/splash-icon.png')

# Web favicon.
save(flatten(square(mark, 96, 0.08)), f'{APP}/favicon.png')

# In-app brand mark for the sign-in screen, at the three densities RN expects.
save(square(mark, 120, 0.02), f'{BRAND}/az-mark.png')
save(square(mark, 240, 0.02), f'{BRAND}/az-mark@2x.png')
save(square(mark, 360, 0.02), f'{BRAND}/az-mark@3x.png')

# Full lockup for any place that wants the wordmark too.
save(square(lockup, 360, 0.02), f'{BRAND}/az-lockup.png')
save(square(lockup, 720, 0.02), f'{BRAND}/az-lockup@2x.png')
save(square(lockup, 1080, 0.02), f'{BRAND}/az-lockup@3x.png')

print()
for path, size, kb in written:
    print(f'  {path:46s} {size[0]}x{size[1]:<5} {kb} KB')
