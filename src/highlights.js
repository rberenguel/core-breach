import { GRID_SIZE, TILE_SIZE, CELL_TYPE } from './config.js';
import { gameState, isValidTile, getCell, getUnitAt, gridToWorld } from './state.js';
import { scene } from './scene.js';

export function clearHighlights() {
  gameState.tileHighlights.forEach(mesh => scene.remove(mesh));
  gameState.tileHighlights = [];
}

export function showMoveHighlights(unit) {
  clearHighlights();
  if (!unit || unit.hasMoved || !unit.alive) return;

  const reachable = [];
  const queue = [{ x: unit.x, z: unit.z, dist: 0 }];
  const visited = new Set([`${unit.x},${unit.z}`]);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.dist < unit.move) {
      const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
      dirs.forEach(d => {
        const nx = cur.x + d.x;
        const nz = cur.z + d.z;
        const key = `${nx},${nz}`;
        if (isValidTile(nx, nz) && !visited.has(key)) {
          visited.add(key);
          const cell = getCell(nx, nz);
          const occUnit = getUnitAt(nx, nz);
          if (cell.type === CELL_TYPE.EMPTY && !occUnit) {
            reachable.push({ x: nx, z: nz });
            queue.push({ x: nx, z: nz, dist: cur.dist + 1 });
          }
        }
      });
    }
  }

  reachable.forEach(t => {
    const pos = gridToWorld(t.x, t.z);
    const group = new THREE.Group();

    const planeGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    group.add(planeMesh);

    const innerGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.82, TILE_SIZE * 0.82);
    innerGeo.rotateX(-Math.PI / 2);
    const edges = new THREE.EdgesGeometry(innerGeo);
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
    edgeLine.position.y = 0.02;
    group.add(edgeLine);

    group.position.set(pos.x, 0.08, pos.z);
    group.userData = { isMoveTarget: true, gridX: t.x, gridZ: t.z };
    scene.add(group);
    gameState.tileHighlights.push(group);
  });
}

export function showAttackHighlights(unit) {
  clearHighlights();
  if (!unit || unit.hasActed || !unit.alive) return;

  const attackTiles = [];

  if (unit.rangeType === 'MELEE') {
    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    dirs.forEach(d => {
      const nx = unit.x + d.x;
      const nz = unit.z + d.z;
      if (isValidTile(nx, nz)) attackTiles.push({ x: nx, z: nz, dx: d.x, dz: d.z });
    });
  } else if (unit.rangeType === 'MORTAR') {
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const dist = Math.abs(unit.x - x) + Math.abs(unit.z - z);
        if (dist >= 2 && dist <= 5) {
          attackTiles.push({ x: x, z: z, dx: 0, dz: 0 });
        }
      }
    }
  } else if (unit.rangeType === 'LINE') {
    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    dirs.forEach(d => {
      for (let r = 1; r < GRID_SIZE; r++) {
        const nx = unit.x + d.x * r;
        const nz = unit.z + d.z * r;
        if (isValidTile(nx, nz)) {
          attackTiles.push({ x: nx, z: nz, dx: d.x, dz: d.z });
        } else break;
      }
    });
  }

  attackTiles.forEach(t => {
    const pos = gridToWorld(t.x, t.z);
    const group = new THREE.Group();

    const planeGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    group.add(planeMesh);

    const innerGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.82, TILE_SIZE * 0.82);
    innerGeo.rotateX(-Math.PI / 2);
    const edges = new THREE.EdgesGeometry(innerGeo);
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 }));
    edgeLine.position.y = 0.02;
    group.add(edgeLine);

    group.position.set(pos.x, 0.08, pos.z);
    group.userData = { isAttackTarget: true, gridX: t.x, gridZ: t.z, dx: t.dx, dz: t.dz };
    scene.add(group);
    gameState.tileHighlights.push(group);
  });
}
