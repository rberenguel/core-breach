import { GRID_SIZE, TILE_SIZE, CELL_TYPE, UNIT_TYPES, FACTION, getDifficultyForRound, getLevelScaling } from './config.js';
import { gameState, getCell, getUnitAt, gridToWorld, isValidTile, nextUnitId, resetUnitIdCounter } from './state.js';
import { rng } from './rng.js';
import { scene } from './scene.js';
import { Materials, createQuantumCoreMesh, createMountainMesh, createRubbleMesh, createUnitMeshByType, createPoolMesh } from './materials.js';
import { audio } from './audio.js';
import { recalculateEnemyIntents, clearTelegraphs } from './combat.js';
import { updateHUD } from './hud.js';
import { clearHighlights } from './highlights.js';

export function initEmptyBoard() {
  if (gameState.boardGroup) {
    scene.remove(gameState.boardGroup);
  }
  gameState.boardGroup = new THREE.Group();
  scene.add(gameState.boardGroup);

  gameState.board = [];
  for (let z = 0; z < GRID_SIZE; z++) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({
        x, z,
        type: CELL_TYPE.EMPTY,
        tileMesh: null,
        featureMesh: null,
        hp: 0,
        maxHp: 0,
        id: null
      });
    }
    gameState.board.push(row);
  }
}

export function spawnUnit(template, gx, gz, rotY = 0) {
  const mesh = createUnitMeshByType(template.id);
  const worldPos = gridToWorld(gx, gz);
  mesh.position.set(worldPos.x, 0, worldPos.z);
  mesh.rotation.y = rotY;
  scene.add(mesh);

  const hpBonus = (template.faction === FACTION.ENEMY && gameState.enemyHpBonus) ? gameState.enemyHpBonus : 0;
  const unit = {
    id: nextUnitId(),
    type: template.id,
    name: template.name,
    faction: template.faction,
    hp: template.hp + hpBonus,
    maxHp: template.maxHp + hpBonus,
    move: template.move,
    actName: template.actName || 'STRIKE',
    actDesc: template.actDesc || '',
    rangeType: template.rangeType || 'MELEE',
    pattern: template.pattern || 'MELEE',
    dmg: template.dmg || 1,
    x: gx,
    z: gz,
    alive: true,
    hasMoved: false,
    hasActed: false,
    intent: null,
    mesh: mesh
  };

  gameState.units.push(unit);
  return unit;
}

export function addSpawner() {
  let attempts = 0;
  while (attempts < 30) {
    attempts++;
    const sx = Math.floor(rng.random() * GRID_SIZE);
    const sz = 1 + Math.floor(rng.random() * 4);
    const cell = getCell(sx, sz);
    if (cell.type === CELL_TYPE.EMPTY && !getUnitAt(sx, sz) && !gameState.spawners.find(s => s.x === sx && s.z === sz)) {
      const worldPos = gridToWorld(sx, sz);
      const outer = 0.9;
      const inner = 0.72;
      const shape = new THREE.Shape();
      shape.moveTo(-outer, -outer);
      shape.lineTo( outer, -outer);
      shape.lineTo( outer,  outer);
      shape.lineTo(-outer,  outer);
      shape.lineTo(-outer, -outer);
      const hole = new THREE.Path();
      hole.moveTo(-inner, -inner);
      hole.lineTo( inner, -inner);
      hole.lineTo( inner,  inner);
      hole.lineTo(-inner,  inner);
      hole.lineTo(-inner, -inner);
      shape.holes.push(hole);
      const squareGeo = new THREE.ShapeGeometry(shape, 1);
      squareGeo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(squareGeo, new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      mesh.position.set(worldPos.x, 0.07, worldPos.z);
      scene.add(mesh);

      gameState.spawners.push({ x: sx, z: sz, mesh: mesh });
      break;
    }
  }
}

function isValidPlayerTile(x, z) {
  if (!isValidTile(x, z)) return false;
  const cell = getCell(x, z);
  return cell.type === CELL_TYPE.EMPTY && !getUnitAt(x, z);
}

function findFallbackPlayerPosition(startZ = 7) {
  for (let z = startZ; z >= 0; z--) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (isValidPlayerTile(x, z)) return { x, z };
    }
  }
  return null;
}

const PLAYER_SPAWN_SLOTS = [
  { x: 1, z: 7 },
  { x: 3, z: 7 },
  { x: 6, z: 7 }
];

export function generateProceduralLevel() {
  rng.init(gameState.seed);

  // Preserve surviving player units
  const survivors = gameState.units.filter(u => u.alive && u.faction === FACTION.PLAYER);
  const deadAndEnemies = gameState.units.filter(u => !survivors.includes(u));

  // Remove meshes for dead units and enemies, keep survivor meshes
  deadAndEnemies.forEach(u => { if (u.mesh) scene.remove(u.mesh); });
  gameState.spawners.forEach(s => { if (s.mesh) scene.remove(s.mesh); });

  // Temporarily move survivors off-board so they don't block placement
  survivors.forEach(u => { u.x = -1; u.z = -1; });

  // Keep survivors; enemies will be respawned
  gameState.units = [...survivors];

  gameState.cores = [];
  gameState.spawners = [];
  gameState.pools = [];
  gameState.selectedUnit = null;
  gameState.selectedTile = null;
  gameState.moveHistory = null;
  gameState.round = 1;
  gameState.difficulty = getDifficultyForRound(gameState.battleCount);
  const scaling = getLevelScaling(gameState.battleCount);
  gameState.enemyHpBonus = scaling.enemyHpBonus;
  gameState.phase = 'PLAYER_TURN';

  // Reset ID counter only on fresh runs (no survivors)
  if (survivors.length === 0) {
    resetUnitIdCounter();
  }

  initEmptyBoard();
  clearHighlights();
  clearTelegraphs();

  // 1. Procedural Green Cores (3 Protected Cores)
  let coresPlaced = 0;
  while (coresPlaced < 3) {
    const cx = 1 + Math.floor(rng.random() * 6);
    const cz = 3 + Math.floor(rng.random() * 3);
    const cell = getCell(cx, cz);
    if (cell.type !== CELL_TYPE.EMPTY) continue;
    // reject if any existing core is diagonally adjacent
    const diagConflict = gameState.cores.some(c => Math.abs(c.x - cx) === 1 && Math.abs(c.z - cz) === 1);
    if (diagConflict) continue;
    cell.type = CELL_TYPE.CORE;
    cell.hp = scaling.coreHp;
    cell.maxHp = scaling.coreHp;
    cell.id = `CORE_${coresPlaced + 1}`;
    gameState.cores.push(cell);
    coresPlaced++;
  }

  // 2. Mountains (2–5 obstacles)
  const mountainTarget = 2 + Math.floor(rng.random() * 4);
  let mountainsPlaced = 0;
  while (mountainsPlaced < mountainTarget) {
    const mx = Math.floor(rng.random() * GRID_SIZE);
    const mz = 1 + Math.floor(rng.random() * 5);
    const cell = getCell(mx, mz);
    if (cell.type === CELL_TYPE.EMPTY) {
      cell.type = CELL_TYPE.MOUNTAIN;
      cell.hp = 4;
      cell.maxHp = 4;
      mountainsPlaced++;
    }
  }

  // 2.6. Pools (1–3 static data pools)
  const poolTarget = 1 + Math.floor(rng.random() * 3);
  let poolsPlaced = 0;
  while (poolsPlaced < poolTarget) {
    const px = Math.floor(rng.random() * GRID_SIZE);
    const pz = 1 + Math.floor(rng.random() * 5);
    const cell = getCell(px, pz);
    if (cell.type === CELL_TYPE.EMPTY) {
      cell.type = CELL_TYPE.POOL;
      poolsPlaced++;
    }
  }

  // 2.5. Find connected mountain groups for merged meshes
  {
    const allMountains = [];
    for (let z = 0; z < GRID_SIZE; z++)
      for (let x = 0; x < GRID_SIZE; x++) {
        const c = getCell(x, z);
        if (c.type === CELL_TYPE.MOUNTAIN) allMountains.push(c);
      }
    const visited = new Set();
    for (const seed of allMountains) {
      const key = `${seed.x},${seed.z}`;
      if (visited.has(key)) continue;
      const group = [];
      const queue = [seed];
      visited.add(key);
      while (queue.length > 0) {
        const c = queue.shift();
        group.push(c);
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nk = `${c.x+dx},${c.z+dz}`;
          if (!visited.has(nk)) {
            const nb = getCell(c.x+dx, c.z+dz);
            if (nb && nb.type === CELL_TYPE.MOUNTAIN) { visited.add(nk); queue.push(nb); }
          }
        }
      }
      for (const c of group) c.mountainGroup = group;
    }
  }

  // 3. Chasms (2 gaps)
  let chasmsPlaced = 0;
  while (chasmsPlaced < 2) {
    const cx = Math.floor(rng.random() * GRID_SIZE);
    const cz = 2 + Math.floor(rng.random() * 3);
    const cell = getCell(cx, cz);
    if (cell.type === CELL_TYPE.EMPTY) {
      cell.type = CELL_TYPE.CHASM;
      chasmsPlaced++;
    }
  }

  // 4. Instantiate 3D Tiles and Features
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = getCell(x, z);
      const worldPos = gridToWorld(x, z);

      const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.32, TILE_SIZE * 0.96);
      let mat;
      if (cell.type === CELL_TYPE.CHASM) mat = Materials.tileChasm;
      else if (cell.type === CELL_TYPE.POOL) mat = Materials.tilePool.clone();
      else mat = Materials.tileBase.clone();

      const tileY = cell.type === CELL_TYPE.CHASM ? -0.8 : cell.type === CELL_TYPE.POOL ? -0.36 : -0.16;
      const tileMesh = new THREE.Mesh(tileGeo, mat);
      tileMesh.position.set(worldPos.x, tileY, worldPos.z);
      tileMesh.receiveShadow = (cell.type !== CELL_TYPE.CHASM);
      gameState.boardGroup.add(tileMesh);
      cell.tileMesh = tileMesh;

      if (cell.type !== CELL_TYPE.CHASM && cell.type !== CELL_TYPE.POOL) {
        const edges = new THREE.EdgesGeometry(tileGeo);
        const line = new THREE.LineSegments(edges, Materials.tileBorder);
        tileMesh.add(line);
      }

      if (cell.type === CELL_TYPE.POOL) {
        const poolMesh = createPoolMesh(worldPos.x, worldPos.z);
        gameState.boardGroup.add(poolMesh);
        cell.featureMesh = poolMesh;
        gameState.pools.push({ cell, mesh: poolMesh });
      }

      if (cell.type === CELL_TYPE.CORE) {
        const coreMesh = createQuantumCoreMesh();
        coreMesh.position.set(worldPos.x, 0, worldPos.z);
        gameState.boardGroup.add(coreMesh);
        cell.featureMesh = coreMesh;
      } else if (cell.type === CELL_TYPE.MOUNTAIN && cell.mountainGroup && cell.mountainGroup[0] === cell) {
        const cellInfos = cell.mountainGroup.map(c => { const w = gridToWorld(c.x, c.z); return { wx: w.x, wz: w.z }; });
        const mountain = createMountainMesh(cellInfos, 1.0);
        gameState.boardGroup.add(mountain);
        for (const c of cell.mountainGroup) c.featureMesh = mountain;
      }
    }
  }

  // 5. Place surviving player units and fill empty slots
  const usedSlots = new Set();
  survivors.forEach((unit, idx) => {
    // Try fixed slot first, then fallback
    let pos = null;
    if (idx < PLAYER_SPAWN_SLOTS.length) {
      const slot = PLAYER_SPAWN_SLOTS[idx];
      if (isValidPlayerTile(slot.x, slot.z)) {
        pos = { ...slot };
        usedSlots.add(`${slot.x},${slot.z}`);
      }
    }
    if (!pos) {
      for (const slot of PLAYER_SPAWN_SLOTS) {
        const key = `${slot.x},${slot.z}`;
        if (!usedSlots.has(key) && isValidPlayerTile(slot.x, slot.z)) {
          pos = { ...slot };
          usedSlots.add(key);
          break;
        }
      }
    }
    if (!pos) pos = findFallbackPlayerPosition(7);

    if (pos) {
      unit.x = pos.x;
      unit.z = pos.z;
      const worldPos = gridToWorld(pos.x, pos.z);
      unit.mesh.position.set(worldPos.x, 0, worldPos.z);
    }
    unit.mesh.rotation.y = 0;
    unit.hasMoved = false;
    unit.hasActed = false;
    unit.dataOverload = false;
    unit.intent = null;
    unit.justSpawned = false;
    unit.skipAttack = false;
    unit.moveHistory = null;
    unit.hp = Math.min(unit.maxHp, unit.hp + 1);
  });

  // Fresh run: spawn initial 3 random player units (only when no survivors)
  if (survivors.length === 0) {
    const allPlayerConfigs = [UNIT_TYPES.STRIKER, UNIT_TYPES.ARTILLERY, UNIT_TYPES.RAILGUN, UNIT_TYPES.ROCKET];
    for (let i = allPlayerConfigs.length - 1; i > 0; i--) {
      const j = Math.floor(rng.random() * (i + 1));
      [allPlayerConfigs[i], allPlayerConfigs[j]] = [allPlayerConfigs[j], allPlayerConfigs[i]];
    }
    const playerConfigs = allPlayerConfigs.slice(0, 3);
    playerConfigs.forEach((cfg, idx) => {
      const slot = PLAYER_SPAWN_SLOTS[idx];
      spawnUnit(cfg, slot.x, slot.z, 0);
    });
  }

  // Handle pending recruit from upgrade
  if (gameState.pendingRecruit) {
    const recruitConfig = Object.values(UNIT_TYPES).find(u => u.id === gameState.pendingRecruit && u.faction === FACTION.PLAYER);
    if (recruitConfig) {
      const playerCount = gameState.units.filter(u => u.alive && u.faction === FACTION.PLAYER).length;
      if (playerCount < 3) {
        let pos = null;
        for (const slot of PLAYER_SPAWN_SLOTS) {
          const key = `${slot.x},${slot.z}`;
          if (!usedSlots.has(key) && isValidPlayerTile(slot.x, slot.z)) {
            pos = { ...slot };
            usedSlots.add(key);
            break;
          }
        }
        if (!pos) pos = findFallbackPlayerPosition(7);
        if (pos) {
          spawnUnit(recruitConfig, pos.x, pos.z, 0);
        }
      }
    }
    gameState.pendingRecruit = null;
  }


  // 6. Spawn Red Enemy Units (random pick from 4, count scales with level)
  const enemyCount = 3 + scaling.extraEnemies;
  const allEnemyConfigs = [UNIT_TYPES.TANK, UNIT_TYPES.FLIER, UNIT_TYPES.MORTAR, UNIT_TYPES.CANNON];
  for (let i = allEnemyConfigs.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [allEnemyConfigs[i], allEnemyConfigs[j]] = [allEnemyConfigs[j], allEnemyConfigs[i]];
  }
  let enemiesSpawned = 0;
  while (enemiesSpawned < enemyCount) {
    const ex = Math.floor(rng.random() * GRID_SIZE);
    const ez = Math.floor(rng.random() * 3);
    const cell = getCell(ex, ez);
    if (cell.type === CELL_TYPE.EMPTY && !getUnitAt(ex, ez)) {
      const cfg = enemiesSpawned < allEnemyConfigs.length ? allEnemyConfigs[enemiesSpawned] : allEnemyConfigs[Math.floor(rng.random() * allEnemyConfigs.length)];
      spawnUnit(cfg, ex, ez, Math.PI);
      enemiesSpawned++;
    }
  }

  // 7. Tactical Spawners
  const spawnerCount = 2 + scaling.extraSpawners;
  for (let s = 0; s < spawnerCount; s++) addSpawner();

  updateHUD();
  recalculateEnemyIntents();
  audio.playSelect();
}
