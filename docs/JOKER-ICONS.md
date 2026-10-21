# Distinct monochrome Joker icons

Generated with the built-in imagegen tool on 2026-10-21, using the four user-supplied playing-card examples as style references. The two original caricatures are included under the project GPL-3.0-only license.

| Deck card | Artwork | Generated source | Runtime asset |
| --- | --- | --- | --- |
| Red joker (`Xr`) | Standing jester with a miniature jester staff | `assets/joker-red-icon-source.png` | `public/images/joker-red-icon.jpg` |
| Black joker (`Xb`) | Seated, cross-legged juggling jester | `assets/joker-black-icon-source.png` | `public/images/joker-black-icon.jpg` |

Both icons are black and white and contain no lettering. Their different poses identify the two cards; their game powers are identical. Accessible labels retain the deck's red/black card names. The Joker announcement shows the variant recorded in the latest public joker play.

`python scripts/prepare-joker.py` preserves the transparent PNG sources, trims transparent margins for packaging, fits each icon within an 100 x 144 box, and centers it on a 120 x 160 opaque cream card face. It also prepares selected and inactive faces with the exact card background and ink colors, avoiding bright image rectangles when disabled. White source highlights become the card paper color. Icons display at 33 x 44 inside the same 41 x 53 hand buttons and borders as ordinary cards. Runtime files are small RGB baseline JPEGs for IE6. No transparency or image processing is required by the browser. The previous colored portrait sources and files are retained but are no longer used by the game.

## Final prompts

### Standing joker

Use the attached playing-card examples only as style references. Create an ORIGINAL classic playing-card jester caricature, full body, not a face portrait. A simple black-and-white INK ICON on a genuinely TRANSPARENT background, no card border or card rectangle. Crisp bold black shapes with a few white interior highlights, simplified strong silhouette that reads clearly at 24 x 36 pixels; no shading, color, grey gradients, paper texture or thin crosshatching. Slender old-fashioned theatrical joker, angular mischievous face and pointed cap with bells, not cute or friendly children's storybook art. Entire figure fully visible and centered with generous empty space. NO words, NO letters, NO numbers, NO logos, NO suit symbols, NO watermark. Portrait composition. Variant A: a standing long-legged court jester with one hand on his hip and the other holding a miniature jester-head staff; bent pointed shoes, asymmetric three-point cap, split black-and-white tunic, a sly tilted grin. Elegant slightly crooked stance.

### Juggling joker

Use the attached playing-card examples only as style references. Create an ORIGINAL classic playing-card jester caricature, full body, not a face portrait. A simple black-and-white INK ICON on a genuinely TRANSPARENT background, no card border or card rectangle. Crisp bold black shapes with a few white interior highlights, simplified strong silhouette that reads clearly at 24 x 36 pixels; no shading, color, grey gradients, paper texture or thin crosshatching. Slender old-fashioned theatrical joker, angular mischievous face and pointed cap with bells, not cute or friendly children's storybook art. Entire figure fully visible and centered with generous empty space. NO words, NO letters, NO numbers, NO logos, NO suit symbols, NO watermark. Portrait composition. Variant B: a DIFFERENT character and pose: a seated cross-legged jester in a two-point fool's cap, tossing three plain round balls above one raised hand, other hand extended, pointed shoes, bold black diamond on the tunic, impish angular face. A compact dynamic silhouette, distinct from a standing staff-bearing jester.
