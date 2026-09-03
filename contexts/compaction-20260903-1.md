# Session Compaction Summary

## User Intent
- Complete the full cleanup checklist from cleanup.md (dead code, orphaned materials, debug logging, CSS fixes)
- Transform the game from per-battle resets into a roguelike with unit permanence and inter-battle upgrades
- Improve UI clarity (damage display, terrain effect explanations, spawner visual distinction)

## Contextual Work Summary

### Cleanup (cleanup.md)
- Removed dead imports/exports across scene.js, main.js, hud.js, input.js
- Deleted orphaned Three.js materials (mountainGlow, spawnerRing)
- Stripped all debug console logging from main.js
- Extracted duplicate `sleep` into state.js, imported from combat.js and input.js
- Unified `MAX_ROUNDS` source of truth through `gameState.maxRounds`
- Refactored `bestAttackFromTile` to call `scoreAction` with documented approximation note
- Added missing CSS color classes (text-orange-300, text-emerald-300, border-orange-400/40)
- Removed unused responsive md: variants from utils.css

### Visual Polish
- Replaced spawner hexagon marker with square frame, color changed from red to yellow to avoid telegraph collision
- Added DAMAGE stat to unit card HUD
- Added dedicated EFFECT block for terrain tiles and enemy units explaining behavior
- Bumped core HP from 2 to 3, mountain HP from 2 to 4

### Roguelike Architecture
- Unit permanence: surviving player units persist across `generateProceduralLevel` calls with +1 HP heal and reset battle flags
- Death is permanent; empty squad slots filled with unused unit types from the 4-unit pool
- New `src/upgrades.js` draft system: generates cards from stat upgrades (global/unit-specific HP/move/damage), full repair, and conditional recruit
- Draft card count equals cores saved (1–3). Selection enforced before DEPLOY button unlocks
- Damage values refactored from hardcoded constants to `unit.dmg` across input.js, highlights.js, and config.js player templates
- No spawner emergence on final round — clean victory transition
- Defeat resets the entire run (fresh squad, battleCount = 0)
- Version bumped to 0.5.0

## Files Touched

### Core Logic
- **src/config.js**: Added `dmg` to player unit templates; bumped core HP scaling
- **src/state.js**: Added `pendingRecruit`, imported `MAX_ROUNDS`, extracted shared `sleep`
- **src/map.js**: Surgical level reset preserving survivors; fixed player spawn positions with fallback; recruit handling
- **src/input.js**: Damage uses `unit.dmg`; no spawners on final round; terrain `effect` descriptions
- **src/combat.js**: Victory modal triggers draft render; defeat hides draft
- **src/highlights.js**: `computeAttackOutcome` reads `unit.dmg`
- **src/upgrades.js**: New module — draft generation, card rendering, upgrade application

### UI
- **index.html**: Draft card container in victory modal; EFFECT row in unit card; updated startup screen copy
- **src/hud.js**: Populates damage and effect fields; enemy pattern descriptions
- **src/styles.css**: Draft card styling with cyber-panel clip-paths

### Cleanup / Meta
- **src/scene.js**: Removed `groundPlane` export
- **src/main.js**: Removed dead imports/debug logs; restart handler branches victory vs defeat
- **src/hud.js**: Removed `MAX_ROUNDS` import, pan-knob references
- **src/materials.js**: Removed `mountainGlow`, `spawnerRing`
- **libs/utils.css**: Added missing colors, removed dead md: variants
- **manifest.json / sw.js**: Version 0.5.0
