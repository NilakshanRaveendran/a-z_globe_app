"""Generate the launch wordmark using the app's Urbanist font (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1]
font = ImageFont.truetype(str(root / 'node_modules/@expo-google-fonts/urbanist/700Bold/Urbanist_700Bold.ttf'), 138)
im = Image.new('RGBA', (768, 768))
draw = ImageDraw.Draw(im)
text = 'A-Z Globe'
b = draw.textbbox((0, 0), text, font=font)
draw.text(((768 - (b[2]-b[0]))/2-b[0], (768-(b[3]-b[1]))/2-b[1]), text, font=font, fill='white')
for target in ['apps/azglobe/assets/splash-wordmark.png', 'apps/azglobe/public/splash-wordmark.png']:
    im.save(root / target)
