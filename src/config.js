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
  CHASM: 3
};

export const UNIT_TYPES = {
  STRIKER: {
    id: 'STRIKER',
    name: 'STRIKER CUBE',
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
    name: 'CROWNED ARTILLERY',
    faction: FACTION.PLAYER,
    hp: 2,
    maxHp: 2,
    move: 3,
    actName: 'BEAM MORTAR',
    actDesc: '1 DMG + 4-WAY SHOCKWAVE',
    rangeType: 'MORTAR'
  },
  LASER: {
    id: 'LASER',
    name: 'PRISM RAILGUN',
    faction: FACTION.PLAYER,
    hp: 3,
    maxHp: 3,
    move: 4,
    actName: 'RAIL CANNON',
    actDesc: '1 DMG LINE + PUSH TARGET',
    rangeType: 'LINE'
  },
  SCARAB: {
    id: 'SCARAB',
    name: 'RED SCARAB',
    faction: FACTION.ENEMY,
    hp: 3,
    maxHp: 3,
    move: 2,
    dmg: 2,
    pattern: 'MELEE_PUSH'
  },
  HORNET: {
    id: 'HORNET',
    name: 'RED HORNET',
    faction: FACTION.ENEMY,
    hp: 2,
    maxHp: 2,
    move: 4,
    dmg: 1,
    pattern: 'STAB'
  },
  SPITTER: {
    id: 'SPITTER',
    name: 'RED SPITTER',
    faction: FACTION.ENEMY,
    hp: 2,
    maxHp: 2,
    move: 2,
    dmg: 1,
    pattern: 'RANGED_LOB'
  }
};
