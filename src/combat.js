import { FACTION, CELL_TYPE, MAX_ROUNDS, TILE_SIZE, GRID_SIZE } from './config.js';
import { gameState, getCell, getUnitAt, gridToWorld, isValidTile } from './state.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { spawnFloatingText, spawnFireEffect } from './vfx.js';
import { moveUnitMeshSmooth, flashMeshColor, scaleDownAndRemove } from './animations.js';
import { updateHUD } from './hud.js';
import { Materials } from './materials.js';

export function applyKnockback(targetUnit, pushDx, pushDz) {
  if (!targetUnit || !targetUnit.alive) return;
  const newX = targetUnit.x + pushDx;
  const newZ = targetUnit.z + pushDz;

  if (!isValidTile(newX, newZ)) {
    spawnFloatingText('EDGE BUMP -1', targetUnit.mesh.position, '#ff5500');
    damageUnit(targetUnit, 1);
    audio.playPunch();
    return;
  }

  const destCell = getCell(newX, newZ);
  const destUnit = getUnitAt(newX, newZ);

  if (destCell.type === CELL_TYPE.CHASM) {
    targetUnit.x = newX;
    targetUnit.z = newZ;
    moveUnitMeshSmooth(targetUnit, newX, newZ, () => {
      spawnFloatingText('PITFALL!', targetUnit.mesh.position, '#ff0033');
      spawnFireEffect(targetUnit.mesh.position.x, 0, targetUnit.mesh.position.z, 25);
      damageUnit(targetUnit, 999);
    });
    return;
  }

  if (destUnit || destCell.type === CELL_TYPE.MOUNTAIN || destCell.type === CELL_TYPE.CORE) {
    spawnFloatingText('COLLISION! -1', targetUnit.mesh.position, '#ffaa00');
    spawnFireEffect(targetUnit.mesh.position.x, 0.5, targetUnit.mesh.position.z, 12);
    damageUnit(targetUnit, 1);

    if (destUnit) {
      spawnFloatingText('BUMP! -1', destUnit.mesh.position, '#ffaa00');
      damageUnit(destUnit, 1);
    } else if (destCell.type === CELL_TYPE.CORE) {
      damageCore(destCell, 1);
    } else if (destCell.type === CELL_TYPE.MOUNTAIN) {
      damageMountain(destCell, 1);
    }
    audio.playPunch();
    return;
  }

  targetUnit.x = newX;
  targetUnit.z = newZ;
  moveUnitMeshSmooth(targetUnit, newX, newZ);
}

export function damageUnit(unit, amount) {
  if (!unit || !unit.alive) return;
  unit.hp -= amount;
  spawnFloatingText(`-${amount} HP`, unit.mesh.position, (unit.faction === FACTION.PLAYER ? '#00f0ff' : '#ff0033'));
  spawnFireEffect(unit.mesh.position.x, 0.6, unit.mesh.position.z, 15);

  flashMeshColor(unit.mesh, 0xffffff);

  if (unit.hp <= 0) {
    unit.alive = false;
    unit.hp = 0;
    spawnFloatingText('DESTROYED', unit.mesh.position, '#ff0033');
    spawnFireEffect(unit.mesh.position.x, 0.6, unit.mesh.position.z, 40);
    audio.playExplosion();

    scaleDownAndRemove(unit.mesh, () => {
      scene.remove(unit.mesh);
    });
  }
  updateHUD();
}

export function damageCore(cell, amount) {
  cell.hp -= amount;
  const wPos = gridToWorld(cell.x, cell.z);
  spawnFloatingText(`CORE DAMAGED! -${amount}`, { x: wPos.x, y: 1.6, z: wPos.z }, '#00ff88');
  spawnFireEffect(wPos.x, 1.0, wPos.z, 20);
  audio.playCoreAlarm();

  if (cell.featureMesh) {
    flashMeshColor(cell.featureMesh, 0xff0000);

    if (cell.hp === 1) {
      const d = cell.featureMesh.userData.dodecahedron;
      const w = cell.featureMesh.userData.wire;
      if (d) d.material = Materials.coreDamagedFaceted;
      if (w) w.visible = true;
    }
  }

  if (cell.hp <= 0) {
    cell.hp = 0;
    cell.type = CELL_TYPE.EMPTY;
    spawnFloatingText('CORE LOST!', { x: wPos.x, y: 1.6, z: wPos.z }, '#ff0000');
    spawnFireEffect(wPos.x, 1.0, wPos.z, 45);
    if (cell.featureMesh) {
      scaleDownAndRemove(cell.featureMesh, () => {
        scene.remove(cell.featureMesh);
        cell.featureMesh = null;
      });
    }
  }

  updateHUD();

  const remainingCores = gameState.cores.filter(c => c.hp > 0).length;
  if (remainingCores === 0) {
    triggerGameOver('ALL CORES DESTROYED');
  }
}

export function damageMountain(cell, amount) {
  cell.hp -= amount;
  const wPos = gridToWorld(cell.x, cell.z);
  spawnFloatingText(`RUBBLE -${amount}`, { x: wPos.x, y: 1, z: wPos.z }, '#94a3b8');
  spawnFireEffect(wPos.x, 0.7, wPos.z, 15);
  if (cell.hp <= 0) {
    cell.type = CELL_TYPE.EMPTY;
    if (cell.featureMesh) {
      scaleDownAndRemove(cell.featureMesh, () => {
        scene.remove(cell.featureMesh);
        cell.featureMesh = null;
      });
    }
  }
}

export function clearTelegraphs() {
  gameState.telegraphMarkers.forEach(m => scene.remove(m));
  gameState.telegraphMarkers = [];
}

export function createTelegraphVisual(enemy) {
  if (!enemy.intent) return;
  const startPos = gridToWorld(enemy.x, enemy.z);
  const targetPos = gridToWorld(enemy.intent.targetX, enemy.intent.targetZ);

  const reticleGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.92, TILE_SIZE * 0.92);
  reticleGeo.rotateX(-Math.PI / 2);
  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0xff0033,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide
  });
  const reticle = new THREE.Mesh(reticleGeo, reticleMat);
  reticle.position.set(targetPos.x, 0.08, targetPos.z);
  scene.add(reticle);
  gameState.telegraphMarkers.push(reticle);

  const dir = new THREE.Vector3(targetPos.x - startPos.x, 0, targetPos.z - startPos.z);
  const length = dir.length();
  if (length > 0.1) {
    dir.normalize();
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(startPos.x, 0.5, startPos.z), length * 0.78, 0xff0033, 0.6, 0.4);
    scene.add(arrow);
    gameState.telegraphMarkers.push(arrow);
  }
}

export function recalculateEnemyIntents() {
  clearTelegraphs();
  const enemies = gameState.units.filter(u => u.alive && u.faction === FACTION.ENEMY);

  enemies.forEach(enemy => {
    let bestTarget = null;
    let highestPriority = -1;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dz) !== 1) continue;

        const maxRange = (enemy.type === 'SPITTER') ? 3 : 1;
        for (let r = 1; r <= maxRange; r++) {
          const tx = enemy.x + dx * r;
          const tz = enemy.z + dz * r;
          if (!isValidTile(tx, tz)) continue;

          const cell = getCell(tx, tz);
          const unit = getUnitAt(tx, tz);

          let priority = 0;
          if (cell.type === CELL_TYPE.CORE) priority = 10;
          else if (unit && unit.faction === FACTION.PLAYER) priority = 8;
          else if (cell.type === CELL_TYPE.MOUNTAIN) priority = 1;

          if (priority > highestPriority) {
            highestPriority = priority;
            bestTarget = { x: tx, z: tz, dx: dx, dz: dz };
          }
        }
      }
    }

    if (!bestTarget) {
      const fwdZ = Math.min(GRID_SIZE - 1, enemy.z + 1);
      bestTarget = { x: enemy.x, z: fwdZ, dx: 0, dz: 1 };
    }

    enemy.intent = {
      targetX: bestTarget.x,
      targetZ: bestTarget.z,
      dx: bestTarget.dx,
      dz: bestTarget.dz,
      damage: (enemy.type === 'SCARAB' ? 2 : 1)
    };

    if (enemy.intent.dx !== 0 || enemy.intent.dz !== 0) {
      enemy.mesh.rotation.y = Math.atan2(enemy.intent.dx, enemy.intent.dz);
    }

    createTelegraphVisual(enemy);
  });
}

export function triggerVictory() {
  gameState.phase = 'VICTORY';
  const modal = document.getElementById('modal-screen');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const statRounds = document.getElementById('modal-stat-rounds');
  const statCores = document.getElementById('modal-stat-cores');

  const intactCores = gameState.cores.filter(c => c.hp > 0).length;

  title.innerText = 'SECTOR SECURED';
  title.className = 'text-3xl md:text-4xl font-orbitron font-black text-blue-400 mt-1 mb-3 text-glow-blue';
  desc.innerText = `Tactical directive accomplished. ${intactCores} Core(s) preserved intact!`;
  statRounds.innerText = `${MAX_ROUNDS} / ${MAX_ROUNDS}`;
  statCores.innerText = `${intactCores} / ${gameState.cores.length}`;

  modal.classList.remove('opacity-0', 'pointer-events-none');
}

export function triggerGameOver(reason) {
  gameState.phase = 'GAME_OVER';
  const modal = document.getElementById('modal-screen');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const statRounds = document.getElementById('modal-stat-rounds');
  const statCores = document.getElementById('modal-stat-cores');

  title.innerText = 'DEFENSE FAILED';
  title.className = 'text-3xl md:text-4xl font-orbitron font-black text-red-500 mt-1 mb-3 text-glow-red';
  desc.innerText = reason || 'All Cores destroyed. Sector lost.';
  statRounds.innerText = `${gameState.round} / ${MAX_ROUNDS}`;
  statCores.innerText = '0 / 3';

  modal.classList.remove('opacity-0', 'pointer-events-none');
}
