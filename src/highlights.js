import { GRID_SIZE, TILE_SIZE, CELL_TYPE } from './config.js';
import { gameState, isValidTile, getCell, getUnitAt, gridToWorld } from './state.js';
import { scene, camera } from './scene.js';

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
    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    dirs.forEach(d => {
      for (let r = 2; r <= 5; r++) {
        const nx = unit.x + d.x * r;
        const nz = unit.z + d.z * r;
        if (isValidTile(nx, nz)) attackTiles.push({ x: nx, z: nz, dx: d.x, dz: d.z });
      }
    });
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

export function computeAttackOutcome(unit, tx, tz, dx, dz) {
  const hits = [];

  function simPush(u, pdx, pdz) {
    if (pdx === 0 && pdz === 0) return null;
    const nx = u.x + pdx, nz = u.z + pdz;
    if (!isValidTile(nx, nz)) return { x: u.x, z: u.z, pdx, pdz, fate: 'EDGE' };
    const cell = getCell(nx, nz);
    const occ = gameState.units.find(o => o.alive && o.x === nx && o.z === nz && o !== u);
    if (cell.type === CELL_TYPE.CHASM) return { x: nx, z: nz, pdx, pdz, fate: 'FALL' };
    if (cell.type === CELL_TYPE.POOL && u.type !== 'FLIER') return { x: nx, z: nz, pdx, pdz, fate: 'OVERLOAD' };
    if (occ || cell.type === CELL_TYPE.MOUNTAIN || cell.type === CELL_TYPE.CORE) return { x: u.x, z: u.z, pdx, pdz, fate: 'BLOCKED' };
    return { x: nx, z: nz, pdx, pdz, fate: 'PUSH' };
  }

  function addHit(u, dmg, pdx, pdz) {
    const push = simPush(u, pdx, pdz);
    const bumpDmg = (push?.fate === 'EDGE' || push?.fate === 'BLOCKED') ? 1 : 0;
    const totalDmg = dmg + bumpDmg;
    const newHp = Math.max(0, u.hp - totalDmg);
    const dies = newHp <= 0 || push?.fate === 'FALL';
    const fate = push?.fate === 'FALL' ? 'FALL' : dies ? 'KILL' : 'HIT';
    hits.push({ unit: u, damage: totalDmg, newHp, dies, push, fate });
  }

  if (unit.type === 'STRIKER') {
    const u = getUnitAt(tx, tz);
    if (u) addHit(u, 2, dx, dz);
  } else if (unit.type === 'ARTILLERY') {
    const center = getUnitAt(tx, tz);
    if (center) addHit(center, 1, 0, 0);
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([adx, adz]) => {
      const ax = tx + adx, az = tz + adz;
      if (isValidTile(ax, az)) {
        const u = getUnitAt(ax, az);
        if (u) addHit(u, 1, adx, adz);
      }
    });
  } else if (unit.type === 'RAILGUN') {
    for (let r = 1; r <= GRID_SIZE; r++) {
      const lx = unit.x + dx * r, lz = unit.z + dz * r;
      if (!isValidTile(lx, lz)) break;
      const u = getUnitAt(lx, lz);
      if (u) addHit(u, 1, dx, dz);
      if (lx === tx && lz === tz) break;
    }
  }

  return hits;
}

export function showAttackPreviewMarkers(outcomes, tx, tz) {
  clearAttackPreview();

  const selPos = gridToWorld(tx, tz);
  const selGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94);
  selGeo.rotateX(-Math.PI / 2);
  const selMesh = new THREE.Mesh(selGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  selMesh.position.set(selPos.x, 0.12, selPos.z);
  scene.add(selMesh);
  gameState.previewMarkers.push(selMesh);

  outcomes.forEach(o => {
    const unitPos = gridToWorld(o.unit.x, o.unit.z);

    if (o.dies) {
      const wp = new THREE.Vector3(unitPos.x, 0.6, unitPos.z).project(camera);
      const sx = (wp.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-wp.y * 0.5 + 0.5) * window.innerHeight;
      const skull = document.createElement('span');
      skull.className = 'ph ph-light ph-skull preview-kill-icon';
      skull.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);font-size:32px;color:#000;text-shadow:0 0 3px #fff;pointer-events:none;z-index:50;`;
      document.body.appendChild(skull);
    }

    if (!o.push) return;

    const { pdx, pdz, fate } = o.push;
    const arrowColor = fate === 'FALL' ? 0xff0033 : fate === 'OVERLOAD' ? 0x00ccff : fate === 'EDGE' || fate === 'BLOCKED' ? 0xff8800 : 0xffee00;
    const arrowLen = (fate === 'EDGE' || fate === 'BLOCKED') ? TILE_SIZE * 0.55 : TILE_SIZE * 0.85;
    const dir = new THREE.Vector3(pdx, 0, pdz).normalize();
    const origin = new THREE.Vector3(unitPos.x, 0.25, unitPos.z);
    const arrow = new THREE.ArrowHelper(dir, origin, arrowLen, arrowColor, 0.35, 0.22);
    scene.add(arrow);
    gameState.previewMarkers.push(arrow);

    if (fate === 'PUSH' || fate === 'FALL' || fate === 'OVERLOAD') {
      const destPos = gridToWorld(o.push.x, o.push.z);
      const diskGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 8);
      const disk = new THREE.Mesh(diskGeo, new THREE.MeshBasicMaterial({ color: arrowColor, transparent: true, opacity: 0.9 }));
      disk.position.set(destPos.x, 0.15, destPos.z);
      scene.add(disk);
      gameState.previewMarkers.push(disk);
    }
  });
}

export function clearAttackPreview() {
  gameState.previewMarkers.forEach(m => scene.remove(m));
  gameState.previewMarkers = [];
  gameState.attackPreview = null;
  document.querySelectorAll('.preview-kill-icon').forEach(el => el.remove());
}
