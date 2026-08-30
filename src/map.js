import { GRID_SIZE, TILE_SIZE, CELL_TYPE, UNIT_TYPES, FACTION } from './config.js';
import { gameState, getCell, getUnitAt, gridToWorld, isValidTile, nextUnitId, resetUnitIdCounter } from './state.js';
import { rng } from './rng.js';
import { scene } from './scene.js';
import { Materials, createQuantumCoreMesh, createMountainMesh, createUnitMeshByType } from './materials.js';
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

  const unit = {
    id: nextUnitId(),
    type: template.id,
    name: template.name,
    faction: template.faction,
    hp: template.hp,
    maxHp: template.maxHp,
    move: template.move,
    actName: template.actName || 'STRIKE',
    actDesc: template.actDesc || '',
    rangeType: template.rangeType || 'MELEE',
    pattern: template.pattern || 'MELEE',
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
      const hexGeo = new THREE.RingGeometry(0.42, 0.58, 6, 1);
      hexGeo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      mesh.position.set(worldPos.x, 0.07, worldPos.z);
      scene.add(mesh);

      gameState.spawners.push({ x: sx, z: sz, mesh: mesh });
      break;
    }
  }
}

export function generateProceduralLevel() {
  rng.init(gameState.seed);
  resetUnitIdCounter();
  initEmptyBoard();

  gameState.units.forEach(u => { if (u.mesh) scene.remove(u.mesh); });
  gameState.spawners.forEach(s => { if (s.mesh) scene.remove(s.mesh); });
  gameState.units = [];
  gameState.cores = [];
  gameState.spawners = [];
  gameState.selectedUnit = null;
  gameState.moveHistory = null;
  gameState.round = 1;
  gameState.phase = 'PLAYER_TURN';

  clearHighlights();
  clearTelegraphs();

  // 1. Procedural Green Cores (3 Protected Cores)
  let coresPlaced = 0;
  while (coresPlaced < 3) {
    const cx = 1 + Math.floor(rng.random() * 6);
    const cz = 3 + Math.floor(rng.random() * 3);
    const cell = getCell(cx, cz);
    if (cell.type === CELL_TYPE.EMPTY) {
      cell.type = CELL_TYPE.CORE;
      cell.hp = 2;
      cell.maxHp = 2;
      cell.id = `CORE_${coresPlaced + 1}`;
      gameState.cores.push(cell);
      coresPlaced++;
    }
  }

  // 2. Mountains (4 Obstacles)
  let mountainsPlaced = 0;
  while (mountainsPlaced < 4) {
    const mx = Math.floor(rng.random() * GRID_SIZE);
    const mz = 1 + Math.floor(rng.random() * 5);
    const cell = getCell(mx, mz);
    if (cell.type === CELL_TYPE.EMPTY) {
      cell.type = CELL_TYPE.MOUNTAIN;
      cell.hp = 2;
      cell.maxHp = 2;
      mountainsPlaced++;
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
      const mat = (cell.type === CELL_TYPE.CHASM) ? Materials.tileChasm : Materials.tileBase.clone();

      const tileMesh = new THREE.Mesh(tileGeo, mat);
      tileMesh.position.set(worldPos.x, (cell.type === CELL_TYPE.CHASM) ? -0.8 : -0.16, worldPos.z);
      tileMesh.receiveShadow = (cell.type !== CELL_TYPE.CHASM);
      gameState.boardGroup.add(tileMesh);
      cell.tileMesh = tileMesh;

      if (cell.type !== CELL_TYPE.CHASM) {
        const edges = new THREE.EdgesGeometry(tileGeo);
        const line = new THREE.LineSegments(edges, Materials.tileBorder);
        tileMesh.add(line);
      }

      if (cell.type === CELL_TYPE.CORE) {
        const coreMesh = createQuantumCoreMesh();
        coreMesh.position.set(worldPos.x, 0, worldPos.z);
        gameState.boardGroup.add(coreMesh);
        cell.featureMesh = coreMesh;
      } else if (cell.type === CELL_TYPE.MOUNTAIN) {
        const mountain = createMountainMesh();
        mountain.position.set(worldPos.x, 0, worldPos.z);
        gameState.boardGroup.add(mountain);
        cell.featureMesh = mountain;
      }
    }
  }

  // 5. Spawn 3 Blue Player Units
  const playerConfigs = [UNIT_TYPES.STRIKER, UNIT_TYPES.ARTILLERY, UNIT_TYPES.LASER];
  const playerXs = [1, 3, 6];
  const playerRots = [0, 0, Math.PI];
  playerConfigs.forEach((cfg, idx) => {
    spawnUnit(cfg, playerXs[idx], 7, playerRots[idx]);
  });

  // 6. Spawn 3 Red Enemy Units
  const enemyConfigs = [UNIT_TYPES.SCARAB, UNIT_TYPES.HORNET, UNIT_TYPES.SPITTER];
  let enemiesSpawned = 0;
  while (enemiesSpawned < 3) {
    const ex = Math.floor(rng.random() * GRID_SIZE);
    const ez = Math.floor(rng.random() * 3);
    const cell = getCell(ex, ez);
    if (cell.type === CELL_TYPE.EMPTY && !getUnitAt(ex, ez)) {
      spawnUnit(enemyConfigs[enemiesSpawned], ex, ez, Math.PI);
      enemiesSpawned++;
    }
  }

  // 7. Tactical Spawners
  addSpawner();
  addSpawner();

  updateHUD();
  recalculateEnemyIntents();
  audio.playSelect();
}
