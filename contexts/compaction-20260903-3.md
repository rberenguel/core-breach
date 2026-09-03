# Session Compaction Summary

## User Intent
- Fix the roguelike unit persistence bug where dead units were secretly replaced between battles
- Correct the recruit upgrade card appearing too frequently
- Polish and stabilize the inter-battle upgrade draft flow

## Contextual Work Summary

### Bug Diagnosis & Fix: Death Not Permanent
- Root cause: `generateProceduralLevel` auto-filled empty squad slots with fresh random units after preserving survivors
- This directly contradicted the explicit design requirement that death is permanent
- Removed the auto-fill block entirely; empty slots now stay empty across battles
- Added back the initial 3-unit spawn gated behind `survivors.length === 0` so fresh runs still work

### Recruit Card Probability
- Previously the recruit card was unconditionally added to the pool whenever squad < 3
- Now gated behind `rng.random() < 0.25` — approximately 1 in 4 drafts when eligible
- Most of the time a dead slot stays dead, forcing harder decisions on stat upgrades

### Earlier Fixes (from prior session continuation)
- RAILGUN double-hit bug: deferred damage+knockback until after the full line scan, preventing pushed units from being hit twice
- Player spawn positions restored to fixed slots `[1,3,6], z=7` with fallback only on terrain block
- Removed all debug logging from map.js, combat.js, main.js

## Files Touched

### Core Logic
- **src/map.js**: Removed auto-fill block; fresh-run spawn gated on `survivors.length === 0`
- **src/upgrades.js**: Recruit card gated at 25% probability via `rng.random() < 0.25`
- **src/input.js**: RAILGUN two-phase scan-then-damage pattern
- **src/combat.js**: Removed debug logging from `damageUnit` and `triggerVictory`
- **src/main.js**: Removed restart handler logging
