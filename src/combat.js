import { FACTION, CELL_TYPE, MAX_ROUNDS, TILE_SIZE, GRID_SIZE } from './config.js';
import { gameState, getCell, getUnitAt, gridToWorld, isValidTile } from './state.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { spawnFloatingText, spawnFireEffect } from './vfx.js';
import { moveUnitMeshSmooth, flashMeshColor, scaleDownAndRemove } from './animations.js';
import { updateHUD } from './hud.js';
import { Materials, createMountainMesh, createRubbleMesh } from './materials.js';

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

function findSubgroups(cells) {
  const remaining = new Set(cells.map(c => `${c.x},${c.z}`));
  const cellMap = {};
  for (const c of cells) cellMap[`${c.x},${c.z}`] = c;
  const groups = [];
  while (remaining.size > 0) {
    const startKey = remaining.values().next().value;
    remaining.delete(startKey);
    const group = [cellMap[startKey]];
    const queue = [cellMap[startKey]];
    while (queue.length > 0) {
      const c = queue.shift();
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nk = `${c.x+dx},${c.z+dz}`;
        if (remaining.has(nk)) { remaining.delete(nk); group.push(cellMap[nk]); queue.push(cellMap[nk]); }
      }
    }
    groups.push(group);
  }
  return groups;
}

export function damageMountain(cell, amount) {
  cell.hp -= amount;
  const wPos = gridToWorld(cell.x, cell.z);
  spawnFireEffect(wPos.x, 0.7, wPos.z, 15);

  // Remove the old (possibly merged) group mesh
  const oldGroup = cell.mountainGroup || [cell];
  if (cell.featureMesh) { gameState.boardGroup.remove(cell.featureMesh); }
  for (const c of oldGroup) { c.featureMesh = null; c.mountainGroup = null; }

  // Rebuild remaining group cells
  const remaining = oldGroup.filter(c => c !== cell);
  for (const subgroup of findSubgroups(remaining)) {
    const cellInfos = subgroup.map(c => { const w = gridToWorld(c.x, c.z); return { wx: w.x, wz: w.z }; });
    const mesh = createMountainMesh(cellInfos, 1.0);
    gameState.boardGroup.add(mesh);
    for (const c of subgroup) { c.mountainGroup = subgroup; c.featureMesh = mesh; }
  }

  // Handle this cell
  if (cell.hp <= 0) {
    cell.type = CELL_TYPE.EMPTY;
    cell.mountainGroup = null;
    const rubble = createRubbleMesh(wPos.x, wPos.z);
    gameState.boardGroup.add(rubble);
    cell.featureMesh = rubble;
  } else {
    cell.mountainGroup = [cell];
    const mesh = createMountainMesh([{ wx: wPos.x, wz: wPos.z }], 0.5);
    gameState.boardGroup.add(mesh);
    cell.featureMesh = mesh;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  const start3 = new THREE.Vector3(startPos.x, 0.5, startPos.z);
  const end3 = new THREE.Vector3(targetPos.x, 0.5, targetPos.z);
  const dist = start3.distanceTo(end3);

  if (dist > 0.1) {
    if (enemy.pattern === 'RANGED_LOB') {
      const mid = new THREE.Vector3(
        (startPos.x + targetPos.x) / 2,
        1.4 + dist * 0.45,
        (startPos.z + targetPos.z) / 2
      );
      const curve = new THREE.QuadraticBezierCurve3(start3, mid, end3);
      const points = curve.getPoints(24);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.75 });
      const arc = new THREE.Line(arcGeo, arcMat);
      scene.add(arc);
      gameState.telegraphMarkers.push(arc);
    } else {
      const dir = end3.clone().sub(start3).normalize();
      const arrow = new THREE.ArrowHelper(dir, start3, dist * 0.78, 0xff0033, 0.6, 0.4);
      scene.add(arrow);
      gameState.telegraphMarkers.push(arrow);
    }
  }
}

export function getReachableTiles(unit) {
  const visited = new Set();
  const result = [];
  const queue = [{ x: unit.x, z: unit.z, steps: 0 }];
  visited.add(`${unit.x},${unit.z}`);

  while (queue.length > 0) {
    const { x, z, steps } = queue.shift();
    result.push({ x, z });
    if (steps >= unit.move) continue;

    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, nz = z + dz;
      const key = `${nx},${nz}`;
      if (visited.has(key) || !isValidTile(nx, nz)) continue;
      const cell = getCell(nx, nz);
      if (cell.type !== CELL_TYPE.EMPTY) continue;
      if (getUnitAt(nx, nz)) continue;
      visited.add(key);
      queue.push({ x: nx, z: nz, steps: steps + 1 });
    }
  }
  return result;
}

function chooseBestAction(enemy, priorAttackTiles) {
  const reachable = getReachableTiles(enemy);
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const maxRange = enemy.type === 'SPITTER' ? 3 : 1;

  let bestTotalScore = -Infinity;
  let bestAction = null;

  for (const { x: destX, z: destZ } of reachable) {
    const destPenalty = priorAttackTiles.has(`${destX},${destZ}`) ? -200 : 0;

    let bestAttackScore = 0;
    let bestTarget = { x: destX, z: Math.min(GRID_SIZE - 1, destZ + 1), dx: 0, dz: 1 };

    for (const [dx, dz] of DIRS) {
      for (let r = 1; r <= maxRange; r++) {
        const tx = destX + dx * r;
        const tz = destZ + dz * r;
        if (!isValidTile(tx, tz)) break;

        const cell = getCell(tx, tz);
        const unit = getUnitAt(tx, tz);

        let score = 0;
        if (cell.type === CELL_TYPE.CORE) score = 125;
        else if (unit && unit.faction === FACTION.PLAYER) score = 100;
        else if (unit && unit.faction === FACTION.ENEMY) score = -150;
        else if (cell.type === CELL_TYPE.MOUNTAIN) score = 30;

        if (score > bestAttackScore) {
          bestAttackScore = score;
          bestTarget = { x: tx, z: tz, dx, dz };
        }
      }
    }

    if (bestAttackScore <= 0) {
      let minDist = Infinity;
      for (const u of gameState.units) {
        if (u.alive && u.faction === FACTION.PLAYER) {
          const d = Math.abs(u.x - destX) + Math.abs(u.z - destZ);
          if (d < minDist) minDist = d;
        }
      }
      for (const c of gameState.cores) {
        if (c.hp > 0) {
          const d = Math.abs(c.x - destX) + Math.abs(c.z - destZ);
          if (d < minDist) minDist = d;
        }
      }
      bestAttackScore = Math.max(0, 5 - minDist * 0.5);
    }

    const totalScore = bestAttackScore + destPenalty;
    if (totalScore > bestTotalScore) {
      bestTotalScore = totalScore;
      bestAction = { destX, destZ, targetX: bestTarget.x, targetZ: bestTarget.z, dx: bestTarget.dx, dz: bestTarget.dz };
    }
  }

  return bestAction ?? {
    destX: enemy.x, destZ: enemy.z,
    targetX: enemy.x, targetZ: Math.min(GRID_SIZE - 1, enemy.z + 1),
    dx: 0, dz: 1
  };
}

function bestAttackFromTile(enemy, fromX, fromZ) {
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const maxRange = enemy.type === 'SPITTER' ? 3 : 1;
  let bestScore = 0;
  let bestTarget = { x: fromX, z: Math.min(GRID_SIZE - 1, fromZ + 1), dx: 0, dz: 1 };

  for (const [dx, dz] of DIRS) {
    for (let r = 1; r <= maxRange; r++) {
      const tx = fromX + dx * r;
      const tz = fromZ + dz * r;
      if (!isValidTile(tx, tz)) break;

      const cell = getCell(tx, tz);
      const unit = getUnitAt(tx, tz);

      let score = 0;
      if (cell.type === CELL_TYPE.CORE) score = 125;
      else if (unit && unit.faction === FACTION.PLAYER) score = 100;
      else if (unit && unit.faction === FACTION.ENEMY) score = -150;
      else if (cell.type === CELL_TYPE.MOUNTAIN) score = 30;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = { x: tx, z: tz, dx, dz };
      }
    }
  }

  return bestTarget;
}

export function recalculateEnemyIntents() {
  clearTelegraphs();
  const enemies = gameState.units.filter(u => u.alive && u.faction === FACTION.ENEMY);

  enemies.forEach(enemy => {
    const target = bestAttackFromTile(enemy, enemy.x, enemy.z);

    enemy.intent = {
      targetX: target.x,
      targetZ: target.z,
      dx: target.dx,
      dz: target.dz,
      damage: enemy.type === 'SCARAB' ? 2 : 1
    };

    if (target.dx !== 0 || target.dz !== 0) {
      enemy.mesh.rotation.y = Math.atan2(target.dx, target.dz);
    }

    createTelegraphVisual(enemy);
  });
}

export async function executeEnemyMovementPhase() {
  const enemies = gameState.units.filter(u => u.alive && u.faction === FACTION.ENEMY);
  const priorAttackTiles = new Set();

  clearTelegraphs();

  for (const enemy of enemies) {
    if (!enemy.alive || enemy.justSpawned) continue;

    const action = chooseBestAction(enemy, priorAttackTiles);

    if (action.destX !== enemy.x || action.destZ !== enemy.z) {
      enemy.x = action.destX;
      enemy.z = action.destZ;
      await new Promise(resolve => moveUnitMeshSmooth(enemy, action.destX, action.destZ, resolve));
      await sleep(100);
    }

    enemy.intent = {
      targetX: action.targetX,
      targetZ: action.targetZ,
      dx: action.dx,
      dz: action.dz,
      damage: enemy.type === 'SCARAB' ? 2 : 1
    };

    if (action.dx !== 0 || action.dz !== 0) {
      enemy.mesh.rotation.y = Math.atan2(action.dx, action.dz);
    }

    createTelegraphVisual(enemy);
    priorAttackTiles.add(`${action.targetX},${action.targetZ}`);

    await sleep(150);
  }

  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.justSpawned) continue;
    const target = bestAttackFromTile(enemy, enemy.x, enemy.z);
    enemy.intent = {
      targetX: target.x, targetZ: target.z,
      dx: target.dx, dz: target.dz,
      damage: enemy.type === 'SCARAB' ? 2 : 1
    };
    if (target.dx !== 0 || target.dz !== 0) {
      enemy.mesh.rotation.y = Math.atan2(target.dx, target.dz);
    }
    createTelegraphVisual(enemy);
    enemy.justSpawned = false;
  }
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
