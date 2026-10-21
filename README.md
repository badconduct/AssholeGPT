# AssholeGPT — No Ferry Till Monday

A long weekend on Pinecone Island, summer 2003. A picnic table, a portable CD player, a cooler throne, and friends who take the pecking order far too seriously.

**One ongoing President / Asshole / Scum game.** No campaign, stages, money, unlocks or story progression. Play with five to eight total seats: you and four to seven computer friends. The same cast, cumulative points, wins and ranks continue between deals.

## Run

On the **modern server computer**, install Node 22.9 or later (Node 24 recommended):

```powershell
cd V:\AssholeGPT
npm ci
npm start
```

Open **http://localhost:3084/**. On the Windows 98SE computer, open **http://YOUR-SERVER-LAN-IP:3084/** in **Internet Explorer 6**, with JavaScript, cookies and XMLHTTP / ActiveX enabled. Allow TCP port 3084 on the modern server's firewall if needed. `HOST` defaults to `0.0.0.0`; set `HOST=127.0.0.1` for local-only use. `PORT` changes the port. The server itself does not run on Windows 98SE.

Enter a name, choose five to eight seats and your house rules, and click **Deal us in**. The start menu initially selects **continuous laps, match or beat, wild twos, and two unbeatable jokers**. Click cards, then **Play selected**, or **Pass**. **Suggest** cycles through legal groups without submitting them. **Ranks** introduces the friends and tracks the table's scores. **Log** records recent moves and remarks. **View: Classic** uses a plain backdrop and remembers the choice in a cookie.

Card selection, Suggest, Clear and Play selected are enabled only during your own playable turn or your own exchange choice. They lock during opponents' turns, requests in flight, model pauses, joker announcements and completed deals. Play selected stays visibly muted until a selection is available. Jokers show two distinct, wordless black-and-white jester icons centered on the card: a standing staff-bearing figure and a seated juggling figure. Accessible labels retain the deck's red/black names. Their game powers are identical.

## Island house rules

- Select pile turn style, matching, twos and jokers independently at game start. Choices apply to the new table, remain fixed for its ongoing rounds, and travel with recovery saves and snapshots. The in-game Rules panel and table strip show the active rules. Changing the start menu does not change a current table.
- Use 52 cards without jokers, or 54 with two jokers. Natural rank order: **3 4 5 6 7 8 9 10 J Q K A 2**. Suits are equal. All cards are dealt; the dealer rotates so extra cards rotate too.
- First round opens with the three of clubs, alone or in a matching group.
- Lead a single, pair, triple or four equal ranks, optionally filled out with wild twos. Normal replies use **exactly the same number of cards**, at a higher rank or an equal rank if matching is enabled. **The first play at the highest rank wins ties.** Matching sheds cards but does not take the lead or skip anyone. For example: you play 8, Maya plays 8, Owen plays 8; you still hold the lead. If Jules plays 9, Jules takes it.
- You may pass even with a legal play. Passing locks you out until the pile clears. You must play when leading an empty pile.
- **One lap per pile:** the opening player leads, then each remaining seat gets one turn in clockwise order. The pile clears before returning to the original leading seat, even if that player has finished. A later higher play does not extend the lap.
- **Continuous laps:** players may respond again. The pile clears when the turn would return to the seat holding the first highest play; a higher play starts a fresh circuit from that seat.
- In either style, the winner leads the next pile. Equal plays shed cards without taking the lead. If the winner has finished, the next unfinished player clockwise leads. Jokers and clearing twos still end either style immediately.
- The empty table explicitly names the previous pile winner and next leader. Passing applies only to the old pile: a player who passed may inherit the next lead if the winner has finished and they are next clockwise with cards. The numbered round in the header is the whole deal; each pile within that deal is a trick.
- **Twos** have four independent named settings: ordinary highest rank; wild group fillers; single two clears; or wild fillers plus single-two clears. In wild mode, `7c + 7d + 2h` counts as three sevens, and `2h + 7c + 7d` is the same play. The group needs one natural rank, has at most four cards, and ranks as that natural card. An all-twos group is highest, with the ordinary pile-size requirement. Wild mode alone does not let one two beat a pair. The separate clearing option lets a single two beat and immediately clear any pile.
- **Jokers**, when enabled, each play **alone**, beat any pile regardless of size, and immediately clear it. They cannot fill groups or be combined with another joker. After a special clear, its player leads again, or the next unfinished player clockwise if that player has finished. You cannot finish on a Joker. A player left holding only Jokers forfeits and takes Asshole; others continue playing for the remaining ranks. If another player also forfeits, they take the next lowest unclaimed rank. Finishing on a two is allowed. A special card cannot bypass the first opening's three-of-clubs requirement.
- A joker triggers a **JOKER!** overlay naming its winner and announcing no counterplay. The server pauses about 2.2 seconds before the next lead; play controls wait for the announcement to finish. A second joker cannot challenge the first. A later joker can only be a new legal play in a new pile. Saves retain the result without replaying an old announcement. The Log spells out red and black jokers instead of displaying only internal `Xr` / `Xb` codes.
- No equal-rank skips, revolutions, eight-clears, runs, or other special finishing penalties are implemented.
- First out becomes President, second Vice President; the middle seats are Citizens. Second-last is Vice Asshole, last is Asshole. Points range from number-of-players minus one for first to zero for last. A Presidency also adds one win.
- Next deal, Asshole gives President their **two highest cards**; Vice Asshole gives Vice President their **one highest**. Exchange order is jokers, then twos, then aces down through threes. **President chooses any two cards to return; Vice President chooses any one. Neither is required to return their lowest cards.** These choices come from their **original deal**, before receiving gifts. If you hold a top rank, select your return yourself. In ChatGPT/API mode, each top-ranked opponent makes a separate model decision, considering groups and control cards instead of automatically returning its lowest cards. Local mode retains its simple low-card return policy. All gifts are withheld until both return choices are locked. Exchanges retain everyone's original hand size. Asshole leads the new round.

Older saves without a pile turn style keep continuous laps. Older AssholeGPT saves without a rules field retain their original higher-only, ordinary-high twos, no-joker rules. API callers omitting rule settings also keep those original defaults.

Other regional rules include equal plays that skip the next seat, four-of-a-kind revolutions reversing rank order, four matching cards clearing the pile, larger sets beating smaller ones, compulsory beating, returning after a pass, and different rank exchanges or opening players. These are examples for possible future settings, not currently selectable. See [Pagat's President variations](https://www.pagat.com/climbing/president.html). There is no single universal regional ruleset; the menu names behavior rather than claiming a geographic standard.

## Friends

| Friend | Campsite job | Playing style |
| --- | --- | --- |
| Maya | Keeper of the mixtapes | Patient, keeps control cards |
| Owen | Overprepared camper | Clears awkward groups |
| Jules | Disposable-camera documentarian | Pushes big groups |
| Dev | Portable-speaker engineer | Competes for the lead |
| Beck | Self-appointed fire marshal | Changes tempo |
| Nina | First into the water | Low cards and useful pairs |
| Eli | Instant-noodle philosopher | Saves control for the end |

Six seats is the default. Larger tables add Nina and Eli; smaller tables seat the first four friends. These are fictional adults in their twenties.

## Opponents

The shipped default `AI_MODE=local` uses built-in bots and authored camping banter. It needs no login, credentials, internet connection or model service. The active workstation's private `.env` can override it; `AI_MODE=chatgpt` selects the installed, ChatGPT-authenticated Codex CLI. The footer then displays **CHATGPT FRIENDS**, while `/healthz` reports the canonical adapter name `codex`. Bots see only their own hand and public information. They keep private memories across rounds; this is contextual memory, not model training.

The server also adapts HoldEmGPT's optional model paths. Configure them in `.env` (see `.env.example`); restart to apply changes:

- `AI_MODE=api`: set `AI_URL` to a complete compatible Chat Completions endpoint and `AI_MODEL`. `AI_API_FORMAT=responses` selects a compatible Responses endpoint instead. `AI_TOKEN` or `AI_TOKEN_FILE` supplies an optional server-side bearer credential. Redirects are rejected. The connection is exercised by the first decision.
- `AI_MODE=codex` (or `chatgpt`): uses the installed Codex CLI and its existing login under the server account. `AI_MODEL=default` keeps its configured model. `CODEX_COMMAND` and `CODEX_JS_PATH` are optional executable / JS-entry paths. This inherits HoldEmGPT's isolated, serialized, noninteractive CLI adapter and requires its supported CLI flags. Startup checks the login. It is not offline inference.

When an opponent has no legal reply, the engine records a normal pass without calling the model. The check includes wild groups and special clearing cards. A legal play that empties an opponent's hand is also automatic, with a scripted character remark announcing their newly earned rank (for example, "I'm President! Put that on the summer mix."). Other playable turns still go to the model to choose whether to play or pass. Forced passes remain in the public history and round ledger for later decisions.

Model opponents receive their own hand, public counts/ranks, legal move choices, recent conversation and their own private memory. A structured round ledger preserves the first play, every play and pass in order, ties, pile clears, current trick responses and the seat holding the lead. Public card tracking includes every card played this round and per-rank counts of played cards, cards in that seat's own hand, and unseen cards. Prompts prioritize tracking jokers, aces and twos, then kings and queens, while preserving useful groups. This supplies accurate public memory; it does not reveal where unseen cards are held or guarantee optimal decisions.

The full round ledger is independent of the bounded display log and survives saves. Older saves recover available ordered history; an incomplete timeline is explicitly marked, while all already-played cards remain available from the existing public card list. Each seat also knows its own exchange transfers, never another seat's private exchange. No opponent receives the real deck, other hands or memories, uncommitted return choices, incoming gift identities before choosing its return, or the human's private exchange log.

President and VP choices use separate model calls before gifts are applied. For example, an opponent may keep a pair of threes and return a lone four. A failed choice pauses that same exchange seat; Retry retains the other seat's committed choice. Pending exchanges and private memories survive saving/loading. Public banter is produced with ordinary play decisions, escaped and conservatively filtered for card disclosures. A provider error, timeout or invalid move **pauses the current opponent** for Retry; it does not silently switch to local bots. Mock API acceptance covers decisions, isolation, exchange choices and retry; live ChatGPT-authenticated CLI checks also verified a legal exchange preserving a pair of threes and an ordinary card decision. Live checks use disposable game fixtures, not the active player's private hand.

## Saves

Every accepted action autosaves to `data/saves/` on the server (`SAVE_DIR` overrides it). The **Save / Load** panel shows a private recovery code. Keep it to resume after restarting the server or changing computers. **Make a separate snapshot** creates a different immutable save code, leaving the continuing recovery save independent.

Loading restores the cards, ranks, scores, cast, turn, exchange selections, log and per-seat memories. It creates a fresh recovery branch. Loading an active recovery code transfers its current session; the previous browser returns to the lobby on its next state request. A previously loaded code remains its saved historical branch. Starting a new table preserves the prior code's disk save. Old HoldEmGPT saves are not compatible.

Back up the save directory. Codes grant access to a table. In-memory sessions expire after 24 idle hours, but saved games persist. The client polls while friends act, stops on your turn / between rounds, and reconnects after a network interruption. A Save during an active bot move is disabled; wait until your turn or the round ends.

## Windows 98SE target

The architecture follows HoldEmGPT: a modern Node dealer and an HTML4 / ES3 client using XMLHTTP, including `Microsoft.XMLHTTP` ActiveX fallback. No browser JSON parser, fetch, canvas, SVG, web fonts, TLS, CSS transforms, flexbox or grid is required. The fixed 740-pixel layout is designed for an 800 × 600 display. Gameplay controls fit without scrolling; optional rules, ranks, saves and logs expand below them. Art is cached opaque baseline JPEG; no inference or game analysis runs on the old computer.

Automated acceptance covers Chromium at 800 × 600, ES3 parsing, the ActiveX code path via a browser shim, and complete repeated games. **Physical Windows 98SE / IE6 rendering and performance still need testing on that system.** No native Win98 executable is included.

## Verify

```powershell
npm run check
npm run check:browser
```

The suite checks repeated full games across every house-rule combination, 52/54-card conservation, scores, wild-group comparison, joker clears, pass lockout, completed-player leads, trades, illegal actions, hidden information, structured round history, played-card tracking, legacy timeline recovery, HTTP sessions / CSRF, rules in saves, legacy save migration, model failure and retry, asynchronous model exchanges, and ES3 syntax. The browser check plays six rounds across a five-seat classic table and an eight-seat one-lap matching/wild/joker table, checks a model President/human VP exchange with a fixture provider, controls at 800 × 600, saves / loads, views and an ActiveX shim. It creates only disposable test servers and temp saves. Screenshots and the browser report are written to `artifacts/`.

## Containers

`docker compose up --build -d` starts the game on loopback port 3084 and keeps saves in a named volume. To use a legacy LAN computer, change the published address from `127.0.0.1` to the modern server's LAN address. No secrets or source art are copied into the image. The default image supports local and compatible API opponents; CLI mode needs an operator-prepared image with Codex and its private login. Compose explicitly selects local opponents.

For a reverse proxy, set `PUBLIC_ORIGIN` to its exact HTTP(S) origin. Set `COOKIE_SECURE=true` for HTTPS. Legacy IE6 access is intended over HTTP on a trusted LAN. Add access controls and request limits before exposing a server to the internet.

## Credits

Based on **HoldEmGPT** by badconduct, GPL-3.0-only. The atomic save store, credential loader and optional CLI adapter are adapted from `V:\holdemGPT`. The President dealer, camping cast, interface, tests and artwork are new. HoldEmGPT itself was left unchanged.

Generated fictional artwork, source prompts and conversion steps are documented in [docs/ARTWORK.md](docs/ARTWORK.md). Runtime artwork lives in `public/images/` and `public/portraits/`; original PNGs are in `assets/`. The game intentionally ships without music or sound effects in this first version. See [LICENSE](LICENSE).
