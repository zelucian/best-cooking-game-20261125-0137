# The Golden Skillet — a tiny diner cooking game

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/zelucian/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/zelucian/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

An original cooking game built for the [make.fun bounty](https://make.fun/bounty/best-cooking-game-20261125-0137): run a tiny diner through one busy shift. Tickets pin up on the order board, you grab ingredients from the pantry, chop them at the board, grill patties and boil pasta on the stove, build each dish on the plating counter, and ring the bell at the serve window before the diner's patience runs out. Mid-shift, rush hour hits and orders arrive twice as fast.

## How to play

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. No network, no build step, no libraries — vanilla JS and canvas, with all sound synthesized in the browser.

- **Move** — WASD / arrow keys, or click anywhere on the kitchen floor to walk there.
- **Interact** — `E` or `Space` at the nearest station, or click a station to walk over and use it.
- **Pantry** — keys `1–7` pick an ingredient; click a bin to grab it.
- **Chop** — bring a choppable ingredient to the chopping board and press `E`.
- **Cook** — patties grill and pasta boils on the stove; pick them up when they read READY, before they burn.
- **Plate** — add ingredients to the plate on the plating counter; pick the plate up with empty hands.
- **Serve** — carry a finished plate to the serve window and press `E`. The plate must match a ticket exactly.
- **Trash** — throw away a burnt item or clear a plate.
- `P` / `Esc` pauses, `M` mutes, `R` restarts the shift.

## The menu

| Dish | Build | Coins |
| --- | --- | --- |
| Classic Burger | bun + grilled patty + chopped lettuce + chopped tomato | 100 |
| Garden Salad | chopped lettuce + chopped tomato + chopped cucumber | 80 |
| Tomato Pasta | boiled pasta + chopped tomato | 90 |
| Cheese Melt Burger | bun + grilled patty + cheese + chopped lettuce | 120 |

Fast serves earn a patience bonus (up to +50%); serving dish after dish inside 20 seconds builds a combo worth up to ×2. Lose a ticket and the combo resets.

## Layout

- `game/index.html` — the page; loads `game/src/main.js`.
- `game/src/config.js` — constants, ingredients, recipes, station layout.
- `game/src/random.js` — seeded RNG (mulberry32).
- `game/src/audio.js` — synthesized Web Audio sound effects (no audio files).
- `game/src/orders.js` — the order board: tickets, patience, matching.
- `game/src/kitchen.js` — the chef, stations, chopping, cooking, plating.
- `game/src/render.js` — all canvas drawing: kitchen, food art, tickets, HUD.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — deterministic staged states for screenshots.
- `game/src/main.js` — game loop, shift timer, scoring.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — real renders of the game running in a browser.

## Screenshots

Deterministic staged states, via URL query (same seed every time):

- `?shot=title&seed=7` — title screen with the menu.
- `?shot=play&seed=7` — mid-shift: a burger half-built, a patty grilling, chopping in progress.
- `?shot=rush&seed=7` — rush hour: a full board, low patience, a finished plate on its way to the window.
- `?shot=serve&seed=7` — the serve moment: bell rung, coins flying.

## License

MIT — see [LICENSE](LICENSE).

---
Built for [make.fun](https://make.fun/bounty/best-cooking-game-20261125-0137?ref=182mp9cr)
