# Wormhole: Lethal Company-inspired walking survival

This is a browser survival game inspired by Lethal Company-style walking exploration.

## Controls

- W, A, S, D = move
- Shift = sprint
- E = interact with lever, curtains, doors, and objects

## How to play

1. Open a terminal in the repository folder.
2. Run:
   `python -m http.server 8000`
3. Open:
   `http://localhost:8000`

You will walk around the ship, avoid the shadow, interact with objects in each room, and progress through the wormhole sequence.

## Files

- `index.html` — HUD and canvas shell
- `style.css` — sci-fi interface styling
- `script.js` — walking gameplay, enemy AI, room logic
