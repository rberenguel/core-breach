# CYBER_BREACH // Project Vision & Design Specification

## 1. Executive Summary
**CYBER_BREACH** is a turn-based, deterministic tactical grid game inspired by *Into the Breach*, presented with a high-contrast geometric *Neuromancer* / Synthwave aesthetic. 

The core game loop emphasizes **spatial manipulation, threat redirection, and positional problem-solving** over raw attrition.

---

## 2. Visual Identity & Art Direction
* **Aesthetic:** Clean, minimalist low-poly primitives with vibrant neon contrasts and dark slate/navy environments.
* **Palette:**
  * **Player Units (Blue Faction):** Electric neon blue (`#0066FF`) with cyan glowing accents (`#00F0FF`).
  * **Enemy Swarm (Red Faction):** Pure high-visibility crimson / neon red (`#FF0033`).
  * **Protected Cores:** Emerald / neon green (`#00FF88`), visually separated from both factions.
  * **Grid & Environment:** Deep navy floor tiles with glowing cyan wireframe borders and subtle scanlines.
* **Unit Geometric Silhouettes (Pure Geometry):**
  * **Striker Mech:** Solid, unadorned geometric cube.
  * **Artillery Mech:** Crowned cube (cube base with crenellated corner posts).
  * **Railgun Tank:** Prismed isometric triangle pointing in its line of fire.
  * **Protected Core:** Freely floating, slowly rotating emerald dodecahedron (smooth by default; becomes sharply faceted/wireframed when damaged).
  * **Scarab:** Pure 4-sided pyramidal wedge.
  * **Hornet:** Pure floating octahedron diamond.
  * **Spitter:** Stacked polyhedral cylinder and octahedron.
* **Visual FX:** Additive procedural fire/ember particles, neon laser line tracers, and shockwave spheres.

---

## 3. Core Combat Rules & Mechanics

### A. Turn Loop
1. **Telegraph Phase (Enemy Intent):** At the start of the round, all enemies lock and broadcast their exact target tiles, trajectories, and damage using high-visibility red reticles and directional arrows.
2. **Player Planning Phase:**
   * Player selects units to view high-contrast cyan movement paths and orange attack zones.
   * Movement can be freely tested and reverted (`REVERT MOVE STEP`) until an attack is committed.
   * Attacks deal direct damage and apply knockback / displacement to alter enemy positions and save targets.
3. **Execution Phase:**
   * Telegraphed enemy attacks resolve in sequence.
   * Active emergence burrows (spawners) spawn reinforcements unless physically blocked by standing on top of them (dealing 1 bump damage to the blocker).
4. **Mission Objective:**
   * Survive **5 complete tactical rounds**.
   * Keep at least **1 Core intact** (Cores have 2 HP each). If all Cores are lost, the defense fails.

### B. Displacement & Knockback Physics
* **Standard Knockback:** Attacks push targets 1 tile away along the impact vector.
* **Obstacle / Unit Bump:** If pushed into an occupied tile (mountain, core, or another unit), **both entities take 1 collision damage**.
* **Edge Impact:** Pushing a unit against the grid perimeter inflicts **1 edge bump damage**.
* **Chasms:** Pushing any unit into a void/chasm causes an **instant pitfall elimination**.

---

## 4. Technical Architecture
* **Renderer:** Three.js WebGL (low-FOV perspective for an orthographic/isometric tactical view).
* **Raycasting:** Exact mathematical horizontal ground-plane intersection (`y = 0`) with drag/click discrimination.
* **Audio Engine:** Zero-dependency Web Audio API synthesizer (procedural sine/saw/noise generators for punches, lasers, mortars, and core alarms).
* **Generation:** Procedural 8×8 grid level generation (randomized core clusters, mountains, chasms, and spawn points).