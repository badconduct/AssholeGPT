"""Pack generated source art as small baseline JPEGs for IE6 (Pillow)."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
source = root / 'assets'
out = root / 'public'
camp = Image.open(source / 'camp-source.png').convert('RGB')
ImageOps.fit(camp, (740, 244), centering=(0.5, 0.48)).save(out / 'images/camp-table.jpg', quality=84, progressive=False)
ImageOps.fit(camp, (410, 360), centering=(0.4, 0.5)).save(out / 'images/camp-menu.jpg', quality=84, progressive=False)
atlas = Image.open(source / 'friends-source.png').convert('RGB')
names = ['maya', 'owen', 'jules', 'dev', 'beck', 'nina', 'eli', 'you']
for i, name in enumerate(names):
    col, row = i % 4, i // 4
    tile = atlas.crop((col * atlas.width // 4, row * atlas.height // 2,
                       (col + 1) * atlas.width // 4, (row + 1) * atlas.height // 2))
    ImageOps.fit(tile, (120, 150)).save(out / ('portraits/' + name + '.jpg'), quality=85, progressive=False)
print('Prepared two campsite JPEGs and eight portrait JPEGs.')
