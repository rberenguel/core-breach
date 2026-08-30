# Session Compaction Summary

## User Intent
- Implement pool (data pool) terrain mechanics
- Add attack preview system so player can see outcomes before committing a shot
- Fix several bugs: shared materials, drag vs click detection, telegraph cancellation on push

## Contextual Work Summary

### Pool Mechanics
- Pools are passable terrain (walkable, pushable into) — no instakill
- Non-FLIER units ending on a pool get `dataOverload = true`: attack cancelled/disabled
- FLIERs completely unaffected
- `dataOverload` clears when unit moves off pool; persists across turns if still on pool
- Enemy with `dataOverload` skips attack in execution phase ("OVERLOADED — NO ATTACK")
- Player with `dataOverload`: attack highlights not shown, button greyed, HUD shows "DATA OVERLOAD"

### Attack Preview System (Two-Click Confirm)
- First click on attack tile: shows preview markers (arrows, push destinations, skull icons for kills)
- Second click on same tile OR action button: executes the attack
- `computeAttackOutcome()` in `highlights.js`: pure simulation of hit/push/kill outcomes including bump damage from EDGE and BLOCKED fates
- `showAttackPreviewMarkers()`: ArrowHelper per affected unit (color-coded by fate), destination disk, skull icon HTML overlay projected to screen space for kills
- `clearAttackPreview()`: removes Three.js markers and `.preview-kill-icon` DOM elements
- Key bug fixed: `showAttackPreviewMarkers` calls `clearAttackPreview` internally, so `attackPreview` must be set in `handleTileClick` AFTER calling `showAttackPreviewMarkers`
- HUD shows "CONFIRM FIRE?" status and action button changes to outcome text when preview active
- `formatOutcomes()` in `hud.js` formats hit descriptions including kill-by-border cases

### Bug Fixes
- **Shared materials**: Enemy unit meshes (Scarab/Hornet/Spitter) and player Striker/Artillery all used the same `Materials.enemyRed`/`Materials.playerBlue` instance — flashing one affected all. Fixed by cloning per mesh/function
- **Telegraph cancellation on knockback**: `clearEnemyTelegraph` nulls `unit.intent`, then `createTelegraphVisual` returned early. Fixed by snapshotting updated intent before clearing, then restoring it
- **Flash color bleed**: `flashMeshColor` captured current emissive as `orig`, but stacked hits set `orig = 0xffffff`. Fixed by always restoring to `0`
- **Drag vs click**: Distance-only threshold (6px, then 12px) was insufficient. Fixed with dual requirement: `dist > 12 AND held > 120ms` before `isDragging = true`. Also reset `isDragging` on `pointerdown` to prevent stuck state. Camera only rotates when `isDragging` is confirmed

### Pool Knockback Path
- `applyKnockback`: pool no longer a collision obstacle; non-FLIER pushed into pool → `dataOverload = true`, telegraph cleared
- `getReachableTiles` (combat.js) and `showMoveHighlights` (highlights.js): pools allowed as passable tiles in BFS
- `executeEnemyMovementPhase`: checks landing cell after move; sets `dataOverload` and skips intent creation if on pool

### Skull Icon
- Kill prediction shows black `ph-skull` Phosphor icon projected from 3D world position to screen coords
- Positioned as fixed HTML element, cleaned up by class name `.preview-kill-icon`

## Files Touched

### Core Logic
- **src/combat.js**: Pool knockback path; `getReachableTiles` allows pools; `executeEnemyMovementPhase` pool check; telegraph snapshot fix; `flashMeshColor` always resets to 0
- **src/input.js**: `executePlayerMove` sets/clears `dataOverload`; `undoPlayerMove` clears `dataOverload`; `executeEnemyPhase` skips overloaded enemies; turn reset preserves overload if still on pool; two-click attack flow in `handleTileClick`; imports preview functions
- **src/state.js**: Added `attackPreview: null`, `previewMarkers: []`

### Visual / Materials
- **src/materials.js**: All enemy and player unit mesh functions now clone materials per instance
- **src/animations.js**: `flashMeshColor` restores emissive to `0` unconditionally
- **src/highlights.js**: `computeAttackOutcome`, `showAttackPreviewMarkers`, `clearAttackPreview` added; imports `camera` from scene for skull projection

### UI
- **src/hud.js**: `formatOutcomes` helper; preview state renders "CONFIRM FIRE?" and outcome text in action button; `dataOverload` status display
- **src/main.js**: `btn-act-primary` confirms preview when `attackPreview` set; drag detection uses time+distance dual threshold; `isDragging` reset on `pointerdown`

## Open Issues
- `showMoveHighlights` in highlights.js still only allows `CELL_TYPE.EMPTY` (not POOL) — minor discrepancy with `getReachableTiles` in combat.js which allows pools
- Pool tile info card still says "CANCELS ATTACK" which is accurate but could mention it affects the NEXT turn
