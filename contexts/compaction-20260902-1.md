# Session Compaction Summary

## User Intent
- Fix data pools so they're passable terrain (only harmful on end-of-turn or push)
- Add a new hover-capable player unit with a directional ranged missile attack
- Add a corresponding powerful ranged enemy unit to increase difficulty
- Make projectiles stop at first obstacle rather than passing through
- Show enemy action order in the unit info panel for tactical planning

## Contextual Work Summary

### Data Pool Passability Fix
- Pools were incorrectly treated as blocked in player pathing, move highlights, and BFS pathfinding
- Now passable for all units; only apply data overload when ending turn on them (or being pushed onto them)

### New Player Unit: ROCKET
- Flattened ovoid mesh with hover animation (wobbles up/down, gentle roll)
- Directional missile attack at range 2–5, detonates on first contact for 2 direct damage
- Immune to data pools and chasms (same rules as FLIER)
- Added to the random player roster: 3 out of 4 types spawn each game

### New Enemy Unit: CANNON
- Square pyramid mesh, rotated to face its target
- Directional red bolt projectile at range 2–4, detonates on first contact for 2 damage
- Added to random enemy roster alongside existing types
- Line-of-sight logic stops scanning at first obstacle in both AI scoring and execution

### Projectile Line-of-Sight
- Both player ROCKET and enemy CANNON now detonate at the first unit, mountain, or core in their path
- Attack preview (computeAttackOutcome) reflects this correctly

### Enemy Action Order Display
- Briefly experimented with 3D sprite labels below enemies (removed — occlusion issues)
- Final implementation: order number shown in unit card title when an enemy is selected (e.g. "MORTAR #3")
- Order derived from gameState.units array, matching actual execution sequence

### Version & Cache
- Bumped manifest and service worker to 0.3.0
- Added missing vfx.js and interact.min.js to service worker precache list

## Files Touched

### Core Logic
- **src/config.js**: Added ROCKET and CANNON to UNIT_TYPES
- **src/state.js**: findPath now treats pools as passable; chasms passable for FLIER/ROCKET
- **src/combat.js**: CANNON AI scoring/execution, chasm/pool immunity for FLIER/ROCKET
- **src/input.js**: ROCKET player attack, CANNON enemy execution, spawner draws from 4 types
- **src/highlights.js**: Pool passability in move highlights, ROCKET attack range and preview

### Visual
- **src/materials.js**: createRocketMesh (flattened ovoid), createCannonMesh (square pyramid)
- **src/vfx.js**: spawnRocketProjectile (yellow bolt with ember trail), spawnEnemyBolt (red bolt)
- **src/main.js**: ROCKET hover animation in the per-frame unit loop

### UI
- **src/hud.js**: Enemy order number rendered next to unit name in the info card
- **src/map.js**: Random 3-of-4 selection for both player and enemy rosters

### Meta
- **manifest.json**: Version 0.3.0
- **sw.js**: Version 0.3.0, added vfx.js and interact.min.js to precache
