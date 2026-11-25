[![make.fun competition](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/c/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/noedistro/best-cooking-game-entry/rank.svg)](https://make.fun/c/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/noedistro/best-cooking-game-entry/reward.svg)](https://make.fun/c/best-cooking-game-20261125-0137)

# Nadia's Ember Kitchen — 12 recipes, 6 stations, 3 rushes, 180-second shift in Teluk Arang

Chef Nadia Marlowe runs a charcoal-grill street kitchen on the rooftop of the
night market in Teluk Arang, a fictional harbour town where fishing boats
unload at dusk and the grill smoke rises over the bay. The dinner rush is on,
the charcoal is hot, and every order at Nadia's window is a small
route-planning puzzle you solve with your feet, your knife, and your grill.

## How to play

Walk the loop: **pantry → chopping board → charcoal grill / stove pot →
plating counter → serving window**, one held item at a time, against a
180-second shift.

- **WASD / arrow keys** move Nadia. **E or Space** interacts with the nearest
  station; **clicking** a station walks her there and interacts on arrival.
  Clicking a pantry crate picks that ingredient; pressing E at the pantry
  hands you the next ingredient your most urgent order needs.
- **Chop** raw mains and greens on the chopping board, **grill or boil** them
  in the green window on the ring — leave them too long and they burn, and
  burnt food must be carried to the bin.
- **Plate** in recipe order (base, then main, then topping) and **serve** at
  the window before patience runs out. Tips scale with patience remaining;
  on-time serves build a combo up to ×3.
- **12 recipes** from 3 bases (rice, noodles, flatbread) × 4 mains (chicken,
  fish, tofu, mushroom), each with one topping. **3 rushes** hit at 120, 75
  and 35 seconds remaining, spiking the ticket flow.
- **M** mutes the synthesised sounds; **R** restarts after a shift ends.

## How to run

No build step, no network: the game is static files under `game/`.

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome and play. Staged screenshots
render deterministically at `?shot=cover|play|rush|serve&seed=1`.

## Layout

- `game/` — the game: `index.html`, `styles.css`, and `src/` modules with one
  clear job each (`config`, `recipes`, `random`, `orders`, `kitchen`,
  `cooking`, `plating`, `input`, `audio`, `render`, `shots`, `main`).
- `screenshots/` — four renders of the game's own code (cover first).
- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to the output
  directory and writes `dossier.json` with `buildDossier`.
- `tests/` — unit, integration and gate-constraint tests (`node --test`).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

All art is drawn on canvas and all sounds are synthesised with WebAudio;
nothing is loaded over the network, and the game stores nothing.

## License

MIT — see [LICENSE](LICENSE).
