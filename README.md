# Wormhole: Lethal Company-inspired first-person survival

A first-person 3D survival game: you are **inside the suit**, walking the corridors with a
flashlight in hand. Built with three.js (vendored locally, no network needed).

## Controls

- Mouse = look around (click the view once to capture the mouse, `ESC` releases it)
- W, A, S, D = walk
- Shift = sprint (wider FOV + afterimage trail)
- E = interact with the lever, curtain, eye, code books, exits and the wormhole

## How to play

1. Open a terminal in the repository folder.
2. Run:
   `python -m http.server 8000`
3. Open:
   `http://localhost:8000`

Walk through the rooms, keep an eye on oxygen and the shadow creature, interact with each
room's object to unseal the exit, then reforge the wormhole.

## First-person body

- Gloved hands holding a torch that lights the corridor (real spotlight, not a fake cone)
- Your own legs swing beneath you — look down to see them walk
- Head bob, stride sway and a sprint FOV kick so movement feels physical

## Visuals

- Real 3D rooms: instanced walls with neon crowns, textured floors and ceilings, fog
- Emissive props with point lights and additive glow sprites (lever, curtain, eye, code, portal)
- Spiked shadow creature that hunts you through the room
- Swirling multi-ring wormhole finale, particle bursts, screen shake, damage flashes
- Helmet visor vignette, CRT scanlines and animated HUD bars

## Files

- `index.html` — HUD, viewport and first-person overlays
- `style.css` — sci-fi interface, visor and HUD animations
- `script.js` — three.js scene, first-person controller, props, FX, room logic
- `vendor/three.module.js` — vendored three.js r160 (MIT)
- `legacy/` — the earlier 2D top-down build, kept for reference

