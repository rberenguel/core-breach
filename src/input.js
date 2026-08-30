import { FACTION, CELL_TYPE, UNIT_TYPES, TILE_SIZE } from './config.js';
import { gameState, getCell, getUnitAt, isValidTile, gridToWorld } from './state.js';
import { rng } from './rng.js';
import { scene, camera, raycaster, mouse, groundPlane } from './scene.js';
import { audio } from './audio.js';
import { updateHUD } from './hud.js';
import { clearHighlights, showMoveHighlights, showAttackHighlights } from './highlights.js';
import { spawnFloatingText, spawnFireEffect, spawnExplosionEffect, spawnLaserBeamEffect, spawnArcProjectile } from './vfx.js';
import { moveUnitMeshSmooth, animatePunchMesh } from './animations.js';
import { applyKnockback, damageUnit, damageCore, damageMountain, recalculateEnemyIntents, clearTelegraphs, triggerVictory, executeEnemyMovementPhase } from './combat.js';
import { spawnUnit, addSpawner } from './map.js';

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function selectUnit(unit) {
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
  gameState.selectedUnit = null;
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
        executePlayerAttack(gameState.selectedUnit, gx, gz, actTarget.userData.dx, actTarget.userData.dz);
        return;
      }
    }
  }

  if (clickedUnit && clickedUnit.faction === FACTION.ENEMY) {
    selectUnit(clickedUnit);
    audio.playSelect();
  } else {
    deselectUnit();
  }
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

  const intersectPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
    const gx = Math.round(intersectPoint.x / TILE_SIZE);
    const gz = Math.round(intersectPoint.z / TILE_SIZE);

    if (isValidTile(gx, gz)) {
      handleTileClick(gx, gz);
    } else {
      deselectUnit();
    }
  }
}

export function executePlayerMove(unit, destX, destZ) {
  gameState.moveHistory = { unit: unit, origX: unit.x, origZ: unit.z };

  unit.x = destX;
  unit.z = destZ;
  unit.hasMoved = true;
  audio.playMove();

  moveUnitMeshSmooth(unit, destX, destZ, () => {
    gameState.selectedAction = 'PRIMARY';
    showAttackHighlights(unit);
    updateHUD();
  });
}

export function undoPlayerMove() {
  if (!gameState.moveHistory || gameState.moveHistory.unit.hasActed) return;
  const { unit, origX, origZ } = gameState.moveHistory;
  unit.x = origX;
  unit.z = origZ;
  unit.hasMoved = false;
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
      damageMountain(targetCell, 2);
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

      recalculateEnemyIntents();
    });
  } else if (unit.type === 'LASER') {
    audio.playLaser();
    const startPos = gridToWorld(unit.x, unit.z);
    const endPos = gridToWorld(targetX, targetZ);
    spawnLaserBeamEffect(startPos, endPos);
    spawnFireEffect(endPos.x, 0.65, endPos.z, 20);

    const targetUnit = getUnitAt(targetX, targetZ);
    const targetCell = getCell(targetX, targetZ);
    if (targetUnit) {
      damageUnit(targetUnit, 1);
      applyKnockback(targetUnit, dirX, dirZ);
    } else if (targetCell && targetCell.type === CELL_TYPE.MOUNTAIN) {
      damageMountain(targetCell, 1);
    } else if (targetCell && targetCell.type === CELL_TYPE.CORE) {
      damageCore(targetCell, 1);
    }
  }

  deselectUnit();
  recalculateEnemyIntents();
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
      const bugTypes = [UNIT_TYPES.SCARAB, UNIT_TYPES.HORNET, UNIT_TYPES.SPITTER];
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
    }
  });

  await executeEnemyMovementPhase();

  gameState.phase = 'PLAYER_TURN';
  updateHUD();
  audio.playSelect();
}
