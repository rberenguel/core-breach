# into — codebase map

Turn-based tactics game on an 8×8 grid. Three.js rendering, no framework.

## Key constants (`config.js`)
- `GRID_SIZE=8`, `TILE_SIZE=2.0`, `MAX_ROUNDS=5`
- `FACTION`: `PLAYER | ENEMY`
- `CELL_TYPE`: `EMPTY | MOUNTAIN | CHASM | CORE`
- `UNIT_TYPES`: all unit definitions (id, name, faction, hp, move, actName, rangeType)
  - Player: `STRIKER` (melee), `ARTILLERY` (mortar), `LASER` = **PRISM RAILGUN** (line)
  - Enemy: `SCARAB`, `HORNET`, `SPITTER`

## File responsibilities

| File | Does |
|---|---|
| `config.js` | All constants and unit/enemy stat templates |
| `state.js` | `gameState` singleton, `getCell`, `getUnitAt`, `gridToWorld` |
| `map.js` | `generateProceduralLevel`, `spawnUnit(template, gx, gz, rotY)`, `addSpawner` |
| `materials.js` | Three.js mesh factories per unit type; `createUnitMeshByType(typeId)` |
| `input.js` | Click handling, `executePlayerMove/Attack/Repair`, `executeEnemyPhase` |
| `combat.js` | `damageUnit`, `applyKnockback`, `recalculateEnemyIntents`, `triggerVictory/GameOver` |
| `vfx.js` | Particle effects, laser beam, arc projectile, floating text |
| `main.js` | `animate` loop, seed encode/decode (`seedToCode`/`codeToSeed`), `applySeed` |
| `scene.js` | Three.js scene/camera/renderer setup, `updateCameraFromAngles` |
| `hud.js` | DOM HUD updates |
| `highlights.js` | Move/attack highlight overlays |
| `audio.js` | Sound effects |
| `rng.js` | Mulberry32 seeded PRNG (`rng.init(seed)`, `rng.random()`) |

## Spawn layout (`map.js:generateProceduralLevel`)
Player units spawn at row `z=7` (bottom), enemy units at rows `z=0..2` (top).  
`spawnUnit` sets `mesh.rotation.y = rotY`. Player default `rotY=0`; enemies use `Math.PI`.  
PRISM RAILGUN (LASER) is index 2 of `playerConfigs`, spawned at `x=6`.

## Seed system (`main.js`)
uint32 ↔ 6-char base-52 string (a-z + A-Z). URL param `?lvl=<code>`.  
`seedToCode(n)` / `codeToSeed(str)` / `applySeed(n)` / `parseSeedFromUrl()`.
