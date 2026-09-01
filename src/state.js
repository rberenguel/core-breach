import { GRID_SIZE, TILE_SIZE, CELL_TYPE } from './config.js';

export function gridToWorld(gx, gz) {
  return { x: gx * TILE_SIZE, z: gz * TILE_SIZE };
}

export function isValidTile(gx, gz) {
  return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
}

export const gameState = {
  seed: 0,
  round: 1,
  maxRounds: 5,
  battleCount: 1,
  difficulty: 'EASY',
  phase: 'PLAYER_TURN',
  board: [],
  units: [],
  cores: [],
  spawners: [],
  pools: [],
  selectedUnit: null,
  selectedTile: null,
  selectedAction: 'MOVE',
  moveHistory: null,
  tileHighlights: [],
  previewMarkers: [],
  attackPreview: null,
  telegraphMarkers: [],
  particles: [],
  boardGroup: null
};

let _unitIdCounter = 0;
export function nextUnitId() {
  return 'u_' + (++_unitIdCounter);
}
export function resetUnitIdCounter() {
  _unitIdCounter = 0;
}

export function getCell(gx, gz) {
  if (!isValidTile(gx, gz)) return null;
  return gameState.board[gz][gx];
}

export function getUnitAt(gx, gz) {
  return gameState.units.find(u => u.x === gx && u.z === gz && u.alive);
}

export function findPath(startX, startZ, destX, destZ, unit) {
  const flies = unit && (unit.type === 'FLIER' || unit.type === 'ROCKET');
  const queue = [{ x: startX, z: startZ, path: [{ x: startX, z: startZ }] }];
  const visited = new Set([`${startX},${startZ}`]);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === destX && cur.z === destZ) {
      return cur.path;
    }

    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    for (const d of dirs) {
      const nx = cur.x + d.x;
      const nz = cur.z + d.z;
      const key = `${nx},${nz}`;
      if (!isValidTile(nx, nz) || visited.has(key)) continue;

      const cell = getCell(nx, nz);
      const occUnit = getUnitAt(nx, nz);

      let passable = false;
      if (flies) {
        passable = (cell.type === CELL_TYPE.EMPTY || cell.type === CELL_TYPE.POOL || cell.type === CELL_TYPE.CHASM) && !occUnit;
      } else {
        passable = (cell.type === CELL_TYPE.EMPTY || cell.type === CELL_TYPE.POOL) && !occUnit;
      }

      if (passable) {
        visited.add(key);
        queue.push({ x: nx, z: nz, path: [...cur.path, { x: nx, z: nz }] });
      }
    }
  }

  return null;
}
