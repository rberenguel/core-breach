export const GRID_SIZE = 8;
export const TILE_SIZE = 2.0;
export const MAX_ROUNDS = 5;

export const FACTION = {
  PLAYER: 'PLAYER',
  ENEMY: 'ENEMY'
};

export const CELL_TYPE = {
  EMPTY: 0,
  MOUNTAIN: 1,
  CORE: 2,
  CHASM: 3,
  POOL: 4
};

export const UNIT_TYPES = {
  STRIKER: {
    id: 'STRIKER',
    name: 'STRIKER',
    faction: FACTION.PLAYER,
    hp: 3,
    maxHp: 3,
    move: 3,
    actName: 'TITAN PUNCH',
    actDesc: '2 DMG + 1 KNOCKBACK',
    rangeType: 'MELEE'
  },
  ARTILLERY: {
    id: 'ARTILLERY',
    name: 'ARTILLERY',
    faction: FACTION.PLAYER,
    hp: 2,
    maxHp: 2,
    move: 3,
    actName: 'BEAM MORTAR',
    actDesc: '1 DMG + 4-WAY SHOCKWAVE',
    rangeType: 'MORTAR'
  },
  RAILGUN: {
    id: 'RAILGUN',
    name: 'RAIL GUN',
    faction: FACTION.PLAYER,
    hp: 3,
    maxHp: 3,
    move: 4,
    actName: 'RAIL CANNON',
    actDesc: '1 DMG LINE + PUSH TARGET',
    rangeType: 'LINE'
  },
  TANK: {
    id: 'TANK',
    name: 'TANK',
    faction: FACTION.ENEMY,
    hp: 3,
    maxHp: 3,
    move: 2,
    dmg: 2,
    pattern: 'MELEE_PUSH'
  },
  FLIER: {
    id: 'FLIER',
    name: 'FLIER',
    faction: FACTION.ENEMY,
    hp: 2,
    maxHp: 2,
    move: 4,
    dmg: 1,
    pattern: 'STAB'
  },
  MORTAR: {
    id: 'MORTAR',
    name: 'MORTAR',
    faction: FACTION.ENEMY,
    hp: 2,
    maxHp: 2,
    move: 2,
    dmg: 1,
    pattern: 'RANGED_LOB'
  }
};
