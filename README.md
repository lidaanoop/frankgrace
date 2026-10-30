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

## Visuals

- Animated top-down walk cycle: swinging legs/arms, body bob, glowing boots
- Sprint afterimage trail plus footstep spark particles
- Neon wall trim, pulsing floor grid, rolling energy bands
- Player flashlight cone, vignette lighting and CRT scanlines
- Particle bursts, screen shake and colour flashes on interactions, damage and room changes
- Pulsing beacons for props, tendrilled shadow enemy, swirling wormhole finale
- Glowing "press E" prompt whenever you are close to an interactable

## Files

- `index.html` — HUD (animated stat bars) and canvas shell
- `style.css` — sci-fi interface styling and HUD animations
- `script.js` — walking gameplay, animation, FX, enemy AI, room logic
