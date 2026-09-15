# GodBox · 2D and 3D

The first version of an original god-sandbox: paint the land, settle islands, and watch a small world grow. Original code and procedural graphics, with no WorldBox assets.

## Run locally

Needs Node.js 22.12+.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. Locally, Save downloads a JSON world file; the folder button loads it. Browser storage is not used. Without a file save, a local world lasts only until the page reloads.

## What works

- Two views of the same world: a pixel map from above and 3D terrain with lighting and shadows. The 2D / 3D switch keeps the simulation, pause, selected person, and follow camera. Each view has its own camera.
- 2D opens by default. `?view=3d` starts in 3D; WebGL loads only on first use. If it is unavailable, the game stays in 2D.
- Zoom and pan in both views, orbit and tilt in 3D. All brushes share one map.
- Archipelago, continent, and empty ocean with a reproducible generation seed.
- Meadow, forest, sand, ocean, mountain, and snow brushes.
- People of four races, sheep, and wolves. Three adults of the same race on connected land found a town.
- Fire, rain, lightning, and meteor with a dedicated 3D strike animation; disasters are written into the chronicle of the town they hit. Flooding and erase tools.
- Pause, speeds 1× / 2× / 5×, cell and person details, chronicle.
- Person card: activity and decision reason, needs, temperament, skills, family, and personal events. Follow zooms the camera; the selected path is visible in both views.
- World and AI save, damaged-file checks, version 1 save migration, 500-creature cap.

## How people behave

- Job choice weighs hunger, energy, company, health, danger, and town needs. Temperaments, jobs, skills, and practice are in play.
- A* routes around water, mountains, houses, and fire, checks island connectivity, and rebuilds paths when the map changes. Search is budgeted per simulation step.
- Trees, berries, and deposits are finite. People harvest, mine stone, ore, crystals, clay, mycelium, and fish, carry hauls to the store, and eat from shared stock. Buildings have a material cost and on-site work progress; finished houses raise town capacity.
- Talking forms bonds and families. With housing and food, children are born with parents and an inherited trait. Children learn from adults while talking; adults take working jobs. People age and die.
- Ghouls hunt sheep and strangers and can steal stores. Aliens hunger more slowly and feed on crystal light. Mycelites spore meadows into forest and grow mushroom gardens faster.
- Towns notice strangers on their deposits: guards clash. Sheep stay in a flock and flee wolves; wolves hunt as a pack.
- People flee fire and predators; brave adults and guards can fight back. An elder is chosen from the adults; people can look for another reachable town of their race if the old one is cut off.

This is a 0.4 prototype of an original simulation. Diplomacy, state wars, tech ages, complex politics, full genealogy, and sound are not implemented. The simulation is single-player and runs on the client; this is not a full recreation of WorldBox AI.

## Controls

- Left mouse / one finger — apply the selected tool.
- Right button in 2D — pan the map; in 3D — orbit and tilt the camera.
- Shift + right button, middle button, or Alt + drag — pan the camera.
- Wheel / + and − buttons — zoom; zoom percent / 0 key — fit the whole world.
- Palm button — pan mode, orbit button — rotate mode; both work with a finger.
- Q / E — rotate in 3D. Space — pause, Escape — close details and return to inspect.
- People — list of humans; Inspect — pick a person on the map. The 2D / 3D button at the top changes the view without restarting.

## Build for RUN.world

```sh
npm run build:run
npm run preview:run
```

The `dist-run` folder is a static build with relative paths. Official RUN SDK 5.27.0 and Three.js 0.180.0 are pinned in the lockfile; the layout follows neighboring `NewGame`, `CyberCity`, and `storm`. Their game IDs are not reused.

In a RUN host the adapter wires `appStorage`, autosave every 30 seconds after a successful load, host pause/resume, safe area, and reload on player change. In a normal local browser the SDK and its mock cloud do not start. Cloud errors are shown to the player.

To try the real SDK before publishing:

```sh
npm run playground
```

Playground needs a RUN login through its panel. Firebase and RevenueCat are official Playground dependencies; the game itself does not add auth, purchases, or ads.

When the game needs to be uploaded to RUN, use the installed official CLI:

```sh
rundot login
rundot init --name "GodBox" --build-path dist-run
rundot deploy --build-path dist-run
```

`init` is needed once for a separate GodBox game; it creates `game.config.prod.json`. Neighboring projects’ game IDs must not be copied here. This project is already bound to RUN; cloud saves and launch inside the mobile RUN host still need a check after each deploy.

Docs: [Getting Started](https://series-1.gitbook.io/rundot-docs/readme/getting-started), [Runtime Environment](https://series-1.gitbook.io/rundot-docs/readme/runtime-environment), [Lifecycles](https://series-1.gitbook.io/rundot-docs/readme/lifecycles), [Safe Areas](https://series-1.gitbook.io/rundot-docs/readme/safe_area).

## Checks

```sh
npm test
npm run build:run
```

Tests cover generation, pathfinding and rebuilds, finite resources and stores, building, need priorities, families, island isolation, fire/rain, flooding, old-save migration, reproducible simulation, the 500-creature cap, and save size. Separate cases cover ghoul hunting, store theft, guard clashes, mycelite spores, alien crystal feeding, sheep flight, and disaster chronicle entries. 3D geometry and brush coordinates after both cameras change are also tested. A narrow browser window does not replace a performance check on a physical phone.
