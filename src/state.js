import { GRID_SIZE, TILE_SIZE } from './config.js';

export function gridToWorld(gx, gz) {
  return { x: gx * TILE_SIZE, z: gz * TILE_SIZE };
}

export function isValidTile(gx, gz) {
  return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
}

export const gameState = {
  round: 1,
  maxRounds: 5,
  phase: 'PLAYER_TURN',
  board: [],
  units: [],
  cores: [],
  spawners: [],
  selectedUnit: null,
  selectedAction: 'MOVE',
  moveHistory: null,
  tileHighlights: [],
  telegraphMarkers: [],
  particles: [],
  boardGroup: null
};

export function getCell(gx, gz) {
  if (!isValidTile(gx, gz)) return null;
  return gameState.board[gz][gx];
}

export function getUnitAt(gx, gz) {
  return gameState.units.find(u => u.x === gx && u.z === gz && u.alive);
}
