import { FACTION, CELL_TYPE, UNIT_TYPES, TILE_SIZE, GRID_SIZE } from './config.js';
import { gameState, getCell, getUnitAt, isValidTile, gridToWorld } from './state.js';
import { rng } from './rng.js';
import { scene, camera, raycaster, mouse } from './scene.js';
import { audio } from './audio.js';
import { updateHUD } from './hud.js';
import { clearHighlights, showMoveHighlights, showAttackHighlights, computeAttackOutcome, showAttackPreviewMarkers, clearAttackPreview } from './highlights.js';
import { spawnFloatingText, spawnFireEffect, spawnExplosionEffect, spawnLaserBeamEffect, spawnArcProjectile } from './vfx.js';
import { moveUnitMeshSmooth, animatePunchMesh } from './animations.js';
import { applyKnockback, damageUnit, damageCore, damageMountain, recalculateEnemyIntents, clearTelegraphs, triggerVictory, executeEnemyMovementPhase } from './combat.js';
import { spawnUnit, addSpawner } from './map.js';

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function selectUnit(unit) {
  clearAttackPreview();
  gameState.selectedUnit = unit;
  gameState.selectedAction = (!unit.hasMoved) ? 'MOVE' : 'PRIMARY';

  if (unit.faction === FACTION.PLAYER) {
    if (!unit.hasMoved) showMoveHighlights(unit);
    else if (!unit.hasActed) showAttackHighlights(unit);
    else clearHighlights();
  } else {
    clearHighlights();
  }

  updateHUD();
}

export function deselectUnit() {
  clearAttackPreview();
  gameState.selectedUnit = null;
  gameState.selectedTile = null;
  clearHighlights();
  updateHUD();
}

export function selectTile(tileInfo) {
  gameState.selectedUnit = null;
  gameState.selectedTile = tileInfo;
  clearHighlights();
  updateHUD();
}

export function handleTileClick(gx, gz) {
  const clickedUnit = getUnitAt(gx, gz);

  if (clickedUnit && clickedUnit.faction === FACTION.PLAYER) {
    selectUnit(clickedUnit);
    audio.playSelect();
    return;
  }

  if (gameState.selectedUnit && !gameState.selectedUnit.hasActed) {
    if (gameState.selectedAction === 'MOVE') {
      const moveTarget = gameState.tileHighlights.find(h => h.userData.isMoveTarget && h.userData.gridX === gx && h.userData.gridZ === gz);
      if (moveTarget) {
        executePlayerMove(gameState.selectedUnit, gx, gz);
        return;
      }
    } else if (gameState.selectedAction === 'PRIMARY') {
      const actTarget = gameState.tileHighlights.find(h => h.userData.isAttackTarget && h.userData.gridX === gx && h.userData.gridZ === gz);
      if (actTarget) {
        const prev = gameState.attackPreview;
        if (prev && prev.targetX === gx && prev.targetZ === gz) {
          clearAttackPreview();
          executePlayerAttack(gameState.selectedUnit, gx, gz, actTarget.userData.dx, actTarget.userData.dz);
        } else {
          const outcomes = computeAttackOutcome(gameState.selectedUnit, gx, gz, actTarget.userData.dx, actTarget.userData.dz);
          showAttackPreviewMarkers(outcomes, gx, gz);
          gameState.attackPreview = { targetX: gx, targetZ: gz, dx: actTarget.userData.dx, dz: actTarget.userData.dz, outcomes };
          updateHUD();
        }
        return;
      } else {
        clearAttackPreview();
        updateHUD();
      }
    }
  }

  if (clickedUnit && clickedUnit.faction === FACTION.ENEMY) {
    selectUnit(clickedUnit);
    audio.playSelect();
    return;
  }

  const cell = getCell(gx, gz);
  if (cell) {
    if (cell.type === CELL_TYPE.MOUNTAIN) {
      audio.playSelect();
      selectTile({
        category: 'TERRAIN', name: 'MOUNTAIN',
        hp: cell.hp, maxHp: cell.maxHp,
        status: cell.hp > 1 ? 'INTACT' : 'DAMAGED',
        statusClass: cell.hp > 1 ? 'text-slate-300 font-bold' : 'text-yellow-400 font-bold',
        detail: 'IMPASSABLE',
      });
      return;
    }
    if (cell.type === CELL_TYPE.CORE) {
      audio.playSelect();
      selectTile({
        category: 'STRUCTURE', name: 'CORE',
        hp: cell.hp, maxHp: cell.maxHp,
        status: cell.hp > 0 ? 'ONLINE' : 'OFFLINE',
        statusClass: cell.hp > 0 ? 'text-emerald-300 font-bold' : 'text-red-400 font-bold',
        detail: 'DEFEND',
      });
      return;
    }
    if (cell.type === CELL_TYPE.CHASM) {
      audio.playSelect();
      selectTile({
        category: 'TERRAIN', name: 'CHASM',
        hp: null, maxHp: null,
        status: 'IMPASSABLE',
        statusClass: 'text-slate-400 font-bold',
        detail: 'FALL HAZARD',
      });
      return;
    }
    if (cell.type === CELL_TYPE.POOL) {
      audio.playSelect();
      selectTile({
        category: 'TERRAIN', name: 'DATA POOL',
        hp: null, maxHp: null,
        status: 'DATA OVERLOAD',
        statusClass: 'text-cyan-400 font-bold',
        detail: 'CANCELS ATTACK',
      });
      return;
    }
    const spawner = gameState.spawners.find(s => s.x === gx && s.z === gz);
    if (spawner) {
      audio.playSelect();
      selectTile({
        category: 'STRUCTURE', name: 'SPAWNER',
        hp: null, maxHp: null,
        status: 'ACTIVE',
        statusClass: 'text-red-400 font-bold',
        detail: 'ENEMY SOURCE',
      });
      return;
    }
  }

  deselectUnit();
}

export function handlePreciseGridClick() {
  if (gameState.phase !== 'PLAYER_TURN') return;

  raycaster.setFromCamera(mouse, camera);

  const unitMeshes = gameState.units.filter(u => u.alive).map(u => u.mesh);
  const unitHits = raycaster.intersectObjects(unitMeshes, true);

  if (unitHits.length > 0) {
    let hitObj = unitHits[0].object;
    while (hitObj.parent && hitObj.parent !== scene) {
      hitObj = hitObj.parent;
    }
    const clickedUnit = gameState.units.find(u => u.alive && u.mesh === hitObj);
    if (clickedUnit) {
      handleTileClick(clickedUnit.x, clickedUnit.z);
      return;
    }
  }

  const tileMeshes = gameState.board.flat().filter(c => c.tileMesh).map(c => c.tileMesh);
  const tileHits = raycaster.intersectObjects(tileMeshes, false);
  if (tileHits.length > 0) {
    const cell = gameState.board.flat().find(c => c.tileMesh === tileHits[0].object);
    if (cell) {
      handleTileClick(cell.x, cell.z);
      return;
    }
  }

  deselectUnit();
}

export function executePlayerMove(unit, destX, destZ) {
  gameState.moveHistory = { unit: unit, origX: unit.x, origZ: unit.z };

  unit.x = destX;
  unit.z = destZ;
  unit.hasMoved = true;
  audio.playMove();

  moveUnitMeshSmooth(unit, destX, destZ, () => {
    const destCell = getCell(destX, destZ);
    if (destCell && destCell.type === CELL_TYPE.POOL && unit.type !== 'FLIER') {
      unit.dataOverload = true;
      spawnFloatingText('DATA OVERLOAD!', unit.mesh.position, '#00ccff');
    } else {
      unit.dataOverload = false;
    }
    gameState.selectedAction = 'PRIMARY';
    if (!unit.dataOverload) showAttackHighlights(unit);
    else clearHighlights();
    updateHUD();
  });
}

export function undoPlayerMove() {
  if (!gameState.moveHistory || gameState.moveHistory.unit.hasActed) return;
  const { unit, origX, origZ } = gameState.moveHistory;
  unit.x = origX;
  unit.z = origZ;
  unit.hasMoved = false;
  unit.dataOverload = false;
  gameState.moveHistory = null;
  audio.playMove();

  moveUnitMeshSmooth(unit, origX, origZ, () => {
    gameState.selectedAction = 'MOVE';
    showMoveHighlights(unit);
    updateHUD();
  });
}

export function executePlayerAttack(unit, targetX, targetZ, dirX, dirZ) {
  clearHighlights();
  unit.hasActed = true;
  gameState.moveHistory = null;

  if (dirX !== 0 || dirZ !== 0) {
    unit.mesh.rotation.y = Math.atan2(dirX, dirZ);
  }

  if (unit.type === 'STRIKER') {
    audio.playPunch();
    animatePunchMesh(unit.mesh);
    const targetUnit = getUnitAt(targetX, targetZ);
    const targetCell = getCell(targetX, targetZ);

    if (targetUnit) {
      damageUnit(targetUnit, 2);
      applyKnockback(targetUnit, dirX, dirZ);
    } else if (targetCell && targetCell.type === CELL_TYPE.MOUNTAIN) {
      damageMountain(targetCell, 1);
    } else if (targetCell && targetCell.type === CELL_TYPE.CORE) {
      damageCore(targetCell, 2);
    }
  } else if (unit.type === 'ARTILLERY') {
    audio.playMortar();
    const unitPos = gridToWorld(unit.x, unit.z);
    const centerPos = gridToWorld(targetX, targetZ);

    spawnArcProjectile(unitPos, centerPos, () => {
      spawnExplosionEffect(centerPos.x, centerPos.z);
      spawnFireEffect(centerPos.x, 0.5, centerPos.z, 30);

      const centerUnit = getUnitAt(targetX, targetZ);
      const centerCell = getCell(targetX, targetZ);
      if (centerUnit) damageUnit(centerUnit, 1);
      if (centerCell && centerCell.type === CELL_TYPE.MOUNTAIN) damageMountain(centerCell, 1);
      if (centerCell && centerCell.type === CELL_TYPE.CORE) damageCore(centerCell, 1);

      const adjacent = [
        { x: targetX + 1, z: targetZ, dx: 1, dz: 0 },
        { x: targetX - 1, z: targetZ, dx: -1, dz: 0 },
        { x: targetX, z: targetZ + 1, dx: 0, dz: 1 },
        { x: targetX, z: targetZ - 1, dx: 0, dz: -1 }
      ];
      adjacent.forEach(adj => {
        if (isValidTile(adj.x, adj.z)) {
          const u = getUnitAt(adj.x, adj.z);
          if (u) {
            damageUnit(u, 1);
            applyKnockback(u, adj.dx, adj.dz);
          }
        }
      });

    });
  } else if (unit.type === 'RAILGUN') {
    audio.playLaser();
    const startPos = gridToWorld(unit.x, unit.z);
    const endPos = gridToWorld(targetX, targetZ);
    spawnLaserBeamEffect(startPos, endPos);
    spawnFireEffect(endPos.x, 0.65, endPos.z, 20);

    for (let r = 1; r <= GRID_SIZE; r++) {
      const lx = unit.x + dirX * r, lz = unit.z + dirZ * r;
      if (!isValidTile(lx, lz)) break;
      const u = getUnitAt(lx, lz);
      const cell = getCell(lx, lz);
      if (u) {
        damageUnit(u, 1);
        applyKnockback(u, dirX, dirZ);
      } else if (cell && cell.type === CELL_TYPE.MOUNTAIN) {
        damageMountain(cell, 1);
      } else if (cell && cell.type === CELL_TYPE.CORE) {
        damageCore(cell, 1);
      }
      if (lx === targetX && lz === targetZ) break;
    }
  }

  deselectUnit();
}

export function executePlayerRepair(unit) {
  clearHighlights();
  unit.hasActed = true;
  unit.hasMoved = true;
  unit.hp = Math.min(unit.maxHp, unit.hp + 1);
  spawnFloatingText('+1 HP REPAIRED', unit.mesh.position, '#00ff88');
  audio.playSelect();
  deselectUnit();
}

export async function executeEnemyPhase() {
  if (gameState.phase !== 'PLAYER_TURN') return;
  gameState.phase = 'ENEMY_EXECUTION';
  deselectUnit();
  clearHighlights();
  updateHUD();

  const enemies = gameState.units.filter(u => u.alive && u.faction === FACTION.ENEMY);

  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.intent) continue;

    if (enemy.dataOverload) {
      enemy.dataOverload = false;
      spawnFloatingText('OVERLOADED — NO ATTACK', enemy.mesh.position, '#00ccff');
      await sleep(400);
      continue;
    }

    const intent = enemy.intent;
    const targetUnit = getUnitAt(intent.targetX, intent.targetZ);
    const targetCell = getCell(intent.targetX, intent.targetZ);

    animatePunchMesh(enemy.mesh);
    audio.playPunch();

    await sleep(250);

    if (targetUnit) {
      damageUnit(targetUnit, intent.damage);
      if (intent.dx !== 0 || intent.dz !== 0) {
        applyKnockback(targetUnit, intent.dx, intent.dz);
      }
    } else if (targetCell && targetCell.type === CELL_TYPE.CORE) {
      damageCore(targetCell, intent.damage);
    } else if (targetCell && targetCell.type === CELL_TYPE.MOUNTAIN) {
      damageMountain(targetCell, intent.damage);
    }

    await sleep(350);

    const remainingCores = gameState.cores.filter(c => c.hp > 0).length;
    if (remainingCores === 0) return;
  }

  // Spawner emergence
  for (let i = gameState.spawners.length - 1; i >= 0; i--) {
    const sp = gameState.spawners[i];
    const blocker = getUnitAt(sp.x, sp.z);
    if (blocker) {
      spawnFloatingText('EMERGENCE BLOCKED! -1', blocker.mesh.position, '#00ff88');
      spawnFireEffect(blocker.mesh.position.x, 0.4, blocker.mesh.position.z, 15);
      damageUnit(blocker, 1);
      audio.playPunch();
    } else {
      scene.remove(sp.mesh);
      gameState.spawners.splice(i, 1);
      const bugTypes = [UNIT_TYPES.TANK, UNIT_TYPES.FLIER, UNIT_TYPES.MORTAR];
      const newType = bugTypes[Math.floor(rng.random() * bugTypes.length)];
      const newEnemy = spawnUnit(newType, sp.x, sp.z, Math.PI);
      newEnemy.justSpawned = true;
      spawnFloatingText('EMERGED!', newEnemy.mesh.position, '#ff0033');
      spawnFireEffect(newEnemy.mesh.position.x, 0.5, newEnemy.mesh.position.z, 25);
      audio.playExplosion();
    }
    await sleep(250);
  }

  if (gameState.spawners.length < 2 && gameState.round < gameState.maxRounds) {
    addSpawner();
  }

  gameState.round++;
  if (gameState.round > gameState.maxRounds) {
    triggerVictory();
    return;
  }

  gameState.units.forEach(u => {
    if (u.alive && u.faction === FACTION.PLAYER) {
      u.hasMoved = false;
      u.hasActed = false;
      const cell = getCell(u.x, u.z);
      if (!cell || cell.type !== CELL_TYPE.POOL || u.type === 'FLIER') {
        u.dataOverload = false;
      }
    }
  });

  await executeEnemyMovementPhase();

  gameState.phase = 'PLAYER_TURN';
  updateHUD();
  audio.playSelect();
}
