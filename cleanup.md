# Core Breach — Cleanup Checklist

Each item is self-contained and safe to tackle independently.

---

## Dead imports and exports

- [ ] **`groundPlane` export** (`scene.js:91`)  
  Remove `export const groundPlane = ...`. Nothing imports it. Was an early raycasting surface replaced by tile-mesh raycasting.

- [ ] **`GRID_SIZE`, `TILE_SIZE` in `main.js`** (`main.js:9`)  
  Remove both from the import. Neither is used in `main.js` body; they belong to `scene.js`.

- [ ] **`MAX_ROUNDS` in `hud.js`** (`hud.js:1`)  
  Remove from the import. Not used in `hud.js` body.

- [ ] **`TILE_SIZE`, `getDifficultyForRound` in `input.js`** (`input.js:1`)  
  Remove both. `TILE_SIZE` is not used; `getDifficultyForRound` is not used (`GRID_SIZE` is used so keep that).

---

## Orphaned material definitions

- [ ] **`Materials.spawnerRing`** (`materials.js:68`)  
  Delete the entry. `addSpawner()` in `map.js` creates its material inline. The named material is never referenced.

- [ ] **`Materials.mountainGlow`** (`materials.js:29`)  
  Delete the entry. `createMountainMesh` uses `Materials.mountain` and `Materials.mountainEdge` only.

---

## Pan-knob ghost

- [ ] **`pan-knob` in `hud.js`** (`hud.js:26, 31, 95, 111`)  
  Remove all four `getElementById('pan-knob')` references and their conditionals. The element does not exist in `index.html` and never will.

---

## Debug logging

- [ ] **Debug listener loop** (`main.js:94–103`)  
  Delete the `forEach` that attaches `pointerdown`/`click` loggers to buttons. The real handlers follow immediately after.

- [ ] **Tap log** (`main.js:63`)  
  Delete `console.log('[TAP] raw=', ...)`.

- [ ] **Button handler logs** (`main.js:106, 107, 121, 122, 127, 128`)  
  Delete all six `console.log('[CLICKLOG] ...')` lines inside the actual click handlers.

---

## Duplicate sleep

- [ ] **`sleep` in `combat.js`** (`combat.js:215–217`)  
  Extract `sleep` to `state.js` (or a new `utils.js`), export it, and import it in both `combat.js` and `input.js`. This removes the duplicate and makes the export on `input.js`'s version meaningful. Note: a direct import from `input.js` into `combat.js` would create a circular dependency, so a shared module is the right move.

---

## Dual round-limit constants

- [ ] **`gameState.maxRounds` vs `MAX_ROUNDS`** (`state.js:14`, `config.js:3`)  
  Initialize `gameState.maxRounds` from `MAX_ROUNDS` in `state.js` (i.e. `maxRounds: MAX_ROUNDS`) so there is one source of truth. `input.js` reads `gameState.maxRounds`; `combat.js` reads `MAX_ROUNDS`. Both will then agree automatically if the value ever changes.

---

## Telegraph accuracy

- [ ] **`bestAttackFromTile` in `combat.js`** (`combat.js:436–468`)  
  This function drives the level-start telegraphs via `recalculateEnemyIntents`. It scores from the enemy's current tile without movement, difficulty, repeat-target, or prior-attack-zone logic — producing different decisions than `chooseBestAction` does on the actual turn. Consider either:  
  (a) having `recalculateEnemyIntents` call `chooseBestAction` directly (slower, but honest), or  
  (b) keeping `bestAttackFromTile` but making it call `scoreAction` instead of reimplementing scoring inline — and documenting clearly that these are *approximate* telegraphs, not predictions.  
  The current state silently misleads: the telegraph shows one target, the enemy attacks a different one.

---

## Missing CSS classes

- [ ] **`text-orange-300`, `border-orange-400/40`** (`index.html:56–57`)  
  These classes are applied to the difficulty display row but do not exist in `utils.css`. Add them. Suggested values:
  ```css
  .text-orange-300       { color: #fdba74; }
  .border-orange-400\/40 { border-color: rgba(251,146,60,0.4); }
  ```

- [ ] **`text-emerald-300`** (`hud.js:98`)  
  Used as a fallback class for tile status text. Does not exist in `utils.css`. Add it:
  ```css
  .text-emerald-300 { color: #6ee7b7; }
  ```

---

## Dead responsive CSS

- [ ] **Unused `md:` variants** (`utils.css`)  
  The following classes are defined but appear in no HTML or JS template string:
  `md:flex-row`, `md:items-center`, `md:w-88`, `md:w-14`, `md:h-14`  
  Delete them. (`md:text-4xl` is used in `combat.js` modal titles — keep that one.)

---

## Test opportunities

These are the pure or near-pure functions worth covering with automated tests. A single `tests/` directory with plain Node.js (`node --test`, available since Node 18) is enough — no build tooling needed.

### Pure functions — zero mocking required

- **`getDifficultyForRound(round)`** (`config.js:11`)  
  Three boundary cases: round 1 → EASY, round 5 → NORMAL, round 6 → HARD.

- **`getLevelScaling(battleCount)`** (`config.js:17`)  
  Verify the four output fields cap correctly at battleCount 0, 4, 6, 12, etc.

- **`gridToWorld(gx, gz)`** (`state.js:3`)  
  Check that `(0,0)` → `{x:0, z:0}` and `(3,5)` → `{x:6, z:10}` given `TILE_SIZE = 2`.

- **`isValidTile(gx, gz)`** (`state.js:7`)  
  Boundaries: (0,0) valid, (7,7) valid, (-1,0) invalid, (8,0) invalid.

- **`rng.random()` after `rng.init(seed)`** (`rng.js`)  
  Fix a seed, run N iterations, assert the sequence is deterministic and values stay in [0, 1).

- **`seedToCode` / `codeToSeed`** (`main.js:255–273`)  
  These are currently private. Export them (or move to `state.js`) to unlock testing.  
  Round-trip property: `codeToSeed(seedToCode(n)) === n` for several seeds.  
  Format property: `seedToCode(n)` always returns exactly 6 lowercase/uppercase letters.

### State-dependent but still worth testing

These require a minimal board setup (a 2D array of cells) but no Three.js or DOM.

- **`findPath(startX, startZ, destX, destZ, unit)`** (`state.js:52`)  
  Set up a small `gameState.board` (e.g. 4×4 all EMPTY), assert path found.  
  Test MOUNTAIN blocking, CHASM blocking non-fliers vs. allowing fliers.  
  Test unreachable destination returns null.

- **`computeAttackOutcome(unit, tx, tz, dx, dz)`** (`highlights.js:134`)  
  Set up a board and two units. Test STRIKER: 2 dmg + knockback into CHASM → dies.  
  Test RAILGUN piercing: two enemies in a line both hit.  
  Test ARTILLERY splash: center + four adjacent units all take damage.

- **`getReachableTiles(unit)`** (`combat.js:304`)  
  Small board, unit with move=2. Assert correct tile count with and without obstacles.

### Suggested file layout

```
tests/
  config.test.js     — getDifficultyForRound, getLevelScaling
  state.test.js      — gridToWorld, isValidTile, findPath
  rng.test.js        — rng determinism and range
  seed.test.js       — seedToCode / codeToSeed round-trip
  combat.test.js     — getReachableTiles
  highlights.test.js — computeAttackOutcome
```

Run with: `node --test tests/*.test.js`

The Three.js-dependent code (rendering, animations, VFX, audio, HUD DOM) cannot be tested this way without a headless browser. Keep those manual-only.
