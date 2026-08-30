# Session Compaction Summary

## User Intent
- Polish the visual quality of CORE BREACH — unit meshes, effects, and lighting
- Fix a series of geometry, shading, and VFX nits to make the game feel more alive and readable

## Contextual Work Summary

### Unit Geometry
- **Laser/Railgun unit**: Three failed attempts at a "4-sided prism" before landing on the correct interpretation. Final implementation is an isosceles tetrahedron (`BufferGeometry` with 4 hand-placed vertices): flat isosceles triangle base on the ground, front apex pointing in the fire direction (+Z, toward enemy after π rotation), near-vertical back fin rising ~0.9 units from the short back edge, leaning ~11° toward the barycenter. Clearly readable as a dangerous, directional shape.
- **Artillery unit**: Post seam artifact fixed — corner posts were touching the base top with a ~0.005 gap causing z-fighting; moved posts from `y=0.95` to `y=0.92` to embed them.

### Visual Effects
- **Laser beam**: Replaced single 160ms `LineBasicMaterial` line (linewidth ignored by WebGL) with a composite effect: wide cyan box glow + white core box, both oriented along the shot axis, plus a white sphere "slug" that sweeps from unit to target over 400ms while the beam fades over 650ms.
- **Explosion**: Was frame-rate-dependent and opacity-change was silently a no-op (`transparent: true` was missing). Replaced with time-based 780ms animation with eased scale growth and an inner additive glow sphere.
- **Artillery projectile**: Artillery previously exploded instantly at target with no projectile. Added `spawnArcProjectile()` — an orange sphere with halo glow following a parabolic arc (height ~5.5 units, 560ms flight). All damage and VFX now happen in the arrival callback; `recalculateEnemyIntents()` also called post-impact to keep telegraphs correct.
- **Fire particles**: Decay rate slowed (~0.01–0.025 → ~0.01–0.025 range extended) for longer-lingering fire.

### Materials & Floor
- **Floor tiles**: Color changed from `0x152033` (navy, too close to player blue) to `0x0e0b1a` (dark indigo-purple). Roughness raised to 0.85, metalness dropped to 0.05 — matte surface that doesn't reflect blue rim lights back.
- **Tile borders**: `0x0077ee` → `0x00ccff` (bright cyan, clearly distinct from player blue faction).
- **Core dodecahedra**: `emissiveIntensity` reduced from `0.85` to `0.32` — was glowing like a lightbulb under the heavy ambient.

### Lighting (major fix)
- Root cause of flat shading across all units: `AmbientLight` at intensity 1.6 and `HemisphereLight` at 1.8 were flooding shadows — even the darkest face received ~80% illumination.
- **Ambient**: 1.6 → 0.35. **Hemisphere**: 1.8 → 0.55.
- **Key directional light** repositioned from `(22,40,20)` (same +X+Y+Z octant as camera) to `(-11,38,15)` with explicit target at board centre `(7,0,7)`. New direction gives dot products of ~0.89 / ~0.19 / ~−0.42 for the three isometric-visible faces — top bright, front dim, right in key shadow.
- **Blue rim** repositioned to `(28,12,-8)` to fill the key-shadow face with faction colour.
- **Red rim** repositioned to `(-12,10,-28)` to wrap back faces of enemy units from the enemy direction.
- Shadow map resolution 1024 → 2048; frustum widened to cover full board.

## Files Touched

### Rendering & Scene
- **src/scene.js**: Lighting overhaul — ambient/hemisphere drastically reduced, key light repositioned off-camera-axis, rim lights repositioned, shadow map improved

### Geometry & Materials
- **src/materials.js**: Tile color/roughness/metalness, core emissive, artillery post y-position, laser tank mesh (tetrahedron with hand-coded vertices and winding)

### VFX
- **src/vfx.js**: `spawnExplosionEffect` time-based rewrite, `spawnLaserBeamEffect` full replacement (box beam + slug), new `spawnArcProjectile`, slower fire particle decay

### Game Logic
- **src/input.js**: Artillery attack branch refactored to use `spawnArcProjectile` with damage deferred to impact callback; `recalculateEnemyIntents` called post-impact
