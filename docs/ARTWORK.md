# Pinecone Island artwork

Created with the built-in imagegen tool for this project on 2026-10-20. Original fictional artwork is distributed under the project GPL-3.0-only license. No reference photographs or third-party character likenesses were supplied.

Sources: `assets/camp-source.png`, `assets/friends-source.png`.
The active monochrome Joker icons, source images, packaging and final prompts are documented in [JOKER-ICONS.md](JOKER-ICONS.md). The superseded portrait is documented in [JOKER-ARTWORK.md](JOKER-ARTWORK.md).
Runtime assets: `public/images/camp-table.jpg`, `public/images/camp-menu.jpg`, `public/portraits/{maya,owen,jules,dev,beck,nina,eli,you}.jpg`.

`python scripts/prepare-art.py` uses Pillow to crop, resize and encode opaque baseline JPEGs. The runtime has no Python or image library dependency. Source artwork is excluded from the container image.

## Environment prompt

Game environment artwork, landscape 1536x1024. A richly painted background for a nostalgic 2003 island camping card game, warm hand-painted adventure game art with visible brush textures, believable proportions. View from sitting at one end of an empty weathered wooden picnic table on a pine-covered little island at dusk. Table fills lower half and its center is clear for a game UI card pile. Warm kerosene lantern on the far left table edge, blue cooler on beach, dome tents, distant lake and hazy islands, fire ring off to right, string lights, disposable camera and silver portable CD player beside table. Amber sunset, deep teal shadows, friendly relaxed summer mood. No people, no cards, no text, no logos, no UI, opaque image.

## Cast atlas prompt

A game portrait atlas, 1536x1024 landscape, exactly eight portraits in a precise 4 column by 2 row equal rectangular grid with no gutters, no borders, no text or labels. Each cell is a separate head-and-shoulders portrait, face centered in cell with margin above head, warm painted 2000s adventure game style, soft brush texture, realistic distinct fictional adults on an island camping holiday in summer 2003. Consistent warm amber lantern light and dark forest teal backgrounds. Top row left to right: Maya, 24, South Asian woman, dark wavy bob, rust tank top, small headphones around neck, quietly amused; Owen, 26, pale white man with sandy short hair, faint beard, olive outdoors shirt, earnest; Jules, 23, Black woman, short natural curls, yellow ringer tee, camera strap, mischievous smile; Dev, 25, Indian man, black spiky hair, rectangular early-2000s glasses, blue open short sleeve shirt over white tee, thoughtful. Bottom row left to right: Beck, 27, broad white man, backwards faded orange baseball cap, light scruff, checked red flannel shirt, huge grin; Nina, 24, East Asian woman, black ponytail, turquoise hoodie, athletic and bright; Eli, 26, lean brown-skinned man with curly brown hair, small silver earring, purple graphic-free tee, soft smile; player avatar, 25, androgynous white adult, shaggy light brown hair, simple cream tee and denim overshirt, friendly. No modern smartphones, no logos, no text.
