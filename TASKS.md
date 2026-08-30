# CYBER_BREACH — Pending Tasks

## ~~1. Seeded RNG + URL replay~~ DONE
- Implement a congruent (LCG or similar) random number generator to replace all `Math.random()` calls
- Accept `?lvl=SEED` query parameter to seed the RNG at startup
- Display the current seed somewhere visible in the UI (HUD corner)
- Replaying the same seed must produce an identical scenario (deterministic level gen + enemy behavior)

## ~~2. Simplify enemy shapes~~ DONE
- Spitter (and any other overly-complex enemy) violates the "simple geometric primitives" rule from the design doc
- All enemies must use single, recognisable low-poly shapes:
  - Scarab → 4-sided pyramid (square base)
  - Hornet → octahedron
  - Spitter → replace stacked cylinder+octahedron with a single simple shape (TBD — e.g. a flat disc / torus-like prism, or just a sphere)

## 3. Enemy hit estimation ignores trees/obstacles
- The red reticle / damage-preview logic does not account for trees (and possibly other blocking terrain)
- Line-of-fire or blast path should check for tree tiles and block/alter the estimated hit accordingly
- Fix `recalculateEnemyIntents` (or wherever intent paths are computed) to treat trees as blockers

## 4. Add mountains (terrain deformation)
- Mountains are raised impassable terrain tiles (like Into the Breach)
- Visually: deform or extrude the tile geometry upward (not just a flat obstacle marker)
- Rules:
  - Block movement and line of fire
  - Units pushed into a mountain take 1 collision damage (same as existing bump rule)
  - Mountains should appear in procedural level generation

## 5. Enemy AI movement
- Enemies appear to be stationary — confirm and fix enemy movement in the execution phase
- AI should at minimum advance toward its target / preferred attack position each turn
- Revisit `executeEnemyTurn` (or equivalent) to ensure enemies actually move before attacking

## 6. Spawn points look silly
- Make it a a growing and shrinking hexagon on the tile