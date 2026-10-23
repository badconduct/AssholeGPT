# Bottle-cap scores

Every completed deal awards President +2, Vice President +1, Citizens 0,
Vice Asshole -1 and Asshole -2. The awards balance to zero at every table size.
The totals persist across deals and saved games; a new table starts at zero.
Positive and negative awards cancel out into one signed total per friend.

The table displays at most three small caps beside each total. Gold tops
represent positive scores; silver undersides represent negative scores.
The stack is symbolic, so its size does not keep growing with the score.
The table abbreviates large totals; hover text and Ranks show exact values.
There is no score target or automatic end to the game.

`scripts/prepare-caps.py` draws the original pixel artwork directly using a
fixed palette. The two 20 x 14 GIFs use single-color transparency, no animation
or alpha blending, and are served as `image/gif` for IE6. No SVG, canvas,
CSS transforms or modern image format is required.

New games use scoring version 2. When an older save is first loaded, each
old positive-only total is retained in `legacyScore` and its bottle-cap total
starts at zero. The current deal earns caps if still in progress; a completed
deal is not rescored. `scoreStartRound` records the first counted deal.
Subsequent loads preserve the new totals without repeating migration.
Cards, turn order, rules, ranks and Presidency counts are retained.
