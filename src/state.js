import { GRID_SIZE, TILE_SIZE } from './config.js';

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
