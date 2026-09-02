# Session Compaction Summary

## User Intent
- Fix inconsistency in the CANNON enemy's attack behavior and telegraph display
- Allow directional ranged units (ROCKET, CANNON) to attack adjacent targets (range 1)
- Make the game more challenging after a 16–17 win streak by adjusting enemy AI and scaling difficulty
- Improve visual feedback when units are pushed into chasms
- Add enemy attack pattern preview when tapping an enemy unit

## Contextual Work Summary

### CANNON Consistency Fix
- Fixed the CANNON telegraph visual so it draws a straight red line instead of reusing the melee arrow
- Replaced hardcoded damage values across intent generation with `enemy.dmg` from config
- Ensured `spawnUnit` copies `dmg` so all enemies use their correct damage values

### Adjacent Range for Directional Units
- ROCKET and CANNON can now fire at range 1 (adjacent tiles), not just range 2+
- Updated attack highlights, attack outcome computation, and execution logic for both player ROCKET and enemy CANNON

### Enemy Attack Pattern Preview
- Added `showEnemyAttackHighlights` to render red range overlays for any selected enemy
- Displays tiles based on the enemy's pattern: melee (adjacent), MORTAR (range 2–3), CANNON (range 1–4)
- Triggered automatically when tapping an enemy unit

### Difficulty Scaling System
- Added `getLevelScaling(battleCount)` that progressively increases challenge:
  - More starting enemies (3 → 4 → 5)
  - More spawners (2 → 3 → 4)
  - Core HP drops from 2 to 1 after 5 wins
  - Enemy HP bonus (+1) after 6 wins
- Spawned enemies now move and telegraph immediately, but skip their first attack (one-turn grace period instead of doing nothing)

### Core Placement Rule
- Cores can no longer be placed diagonally adjacent to each other
- Prevents an unbeatable diagonal configuration where enemies can attack from an unreachable tile

### Chasm Fall Animation
- Added `fallIntoChasm` animation: unit shrinks and accelerates downward into the chasm
- Replaced the fire explosion effect for chasm deaths with this falling visual
- `damageUnit(999)` still triggers after the animation completes

### Version Bump
- Updated manifest and service worker cache to 0.4.0

## Files Touched

### Core Logic
- **src/combat.js**: CANNON telegraph uses line geometry; removed `justSpawned` from movement-phase skip so new enemies move immediately; fixed hardcoded damage to use `enemy.dmg`; removed redundant intent setup for just-spawned enemies
- **src/config.js**: Added `getLevelScaling(battleCount)` returning extraEnemies, extraSpawners, enemyHpBonus, coreHp
- **src/input.js**: ROCKET execution scans from range 1; added `skipAttack` flag for newly spawned enemies; skips attack execution when flag is set
- **src/highlights.js**: ROCKET attack highlights and `computeAttackOutcome` start at range 1; new `showEnemyAttackHighlights` function
- **src/map.js**: Applies `getLevelScaling` to enemy count, spawner count, core HP, and enemy HP bonus; added diagonal adjacency check for core placement

### Visual
- **src/animations.js**: New `fallIntoChasm(mesh, callback)` animation
- **src/vfx.js**: No changes (fire effect removed from chasm path in combat.js)

### UI
- **src/hud.js**: No changes this session

### Meta
- **manifest.json**: Version 0.4.0
- **sw.js**: Cache bumped to core-breach-v0.4.0
