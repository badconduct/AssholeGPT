"""Draw tiny original pixel bottle-cap icons as IE6-compatible transparent GIFs."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
outline = [(1, 5), (2, 3), (4, 3), (4, 2), (7, 2), (7, 1), (12, 1),
           (13, 2), (16, 2), (16, 3), (18, 3), (19, 5), (18, 7),
           (19, 9), (17, 11), (14, 11), (13, 12), (6, 12), (5, 11),
           (2, 11), (1, 9), (2, 7)]
for side in ['up', 'down']:
    image = Image.new('P', (20, 14), 0)
    colors = [(255, 0, 255), (22, 38, 31), (109, 76, 34), (215, 164, 68),
              (255, 222, 137), (159, 176, 166), (221, 229, 216), (75, 96, 84)]
    image.putpalette([v for color in colors for v in color] + [0] * (768 - len(colors) * 3))
    draw = ImageDraw.Draw(image)
    draw.polygon(outline, fill=2 if side == 'up' else 5, outline=1)
    for x in [3, 6, 9, 12, 15, 17]:
        draw.line((x, 9, x, 11), fill=1)
    draw.ellipse((2, 2, 18, 10), fill=3 if side == 'up' else 6, outline=1)
    if side == 'up':
        draw.arc((4, 3, 16, 8), 190, 345, fill=4)
        draw.ellipse((7, 4, 13, 7), fill=2)
    else:
        draw.ellipse((4, 4, 16, 9), fill=7, outline=5)
        draw.arc((5, 4, 15, 8), 0, 160, fill=6)
    image.save(root / ('public/images/bottle-cap-' + side + '.gif'), transparency=0)
print('Prepared two 20 x 14 transparent pixel bottle caps.')
