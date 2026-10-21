"""Center distinct generated monochrome jester icons on legacy card faces."""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops

root = Path(__file__).resolve().parent.parent
for variant in ['red', 'black']:
    source = Image.open(root / ('assets/joker-' + variant + '-icon-source.png')).convert('RGBA')
    bounds = source.getchannel('A').getbbox()
    if not bounds:
        raise ValueError('The generated icon is empty: ' + variant)
    icon = ImageOps.contain(source.crop(bounds), (100, 144), Image.Resampling.LANCZOS)
    # Treat white source highlights as card paper, so every state has one background.
    ink = ImageChops.multiply(ImageOps.invert(icon.convert('L')), icon.getchannel('A'))
    for suffix, paper, color in [('', '#f6edd8', '#172f2b'), ('-selected', '#f8d486', '#172f2b'), ('-inactive', '#ded7bf', '#55665a')]:
        card = Image.new('RGB', (120, 160), paper)
        card.paste(Image.new('RGB', icon.size, color), ((120 - icon.width) // 2, (160 - icon.height) // 2), ink)
        path = root / ('public/images/joker-' + variant + '-icon' + suffix + '.jpg')
        card.save(path, quality=93, progressive=False)
        print('Prepared ' + str(path.relative_to(root)) + ' (120 x 160, baseline RGB).')
