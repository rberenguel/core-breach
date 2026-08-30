import { FACTION, MAX_ROUNDS } from './config.js';
import { gameState } from './state.js';

export function updateHUD() {
  const coresContainer = document.getElementById('cores-container');
  coresContainer.innerHTML = '';

  gameState.cores.forEach((core, idx) => {
    const badge = document.createElement('div');
    const isAlive = core.hp > 0;
    badge.className = `flex flex-col items-center px-2 py-1 border rounded transition-all ${
      isAlive
        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 glow-green'
        : 'bg-red-950/40 border-red-800 text-red-500 opacity-60'
    }`;
    badge.innerHTML = `
      <span class="text-[9px] font-mono-tech font-bold">CORE ${idx + 1}</span>
      <span class="text-xs font-orbitron font-extrabold ${isAlive ? 'text-emerald-400' : 'text-red-500'}">
        ${isAlive ? `${core.hp}/${core.maxHp} HP` : 'OFFLINE'}
      </span>
    `;
    coresContainer.appendChild(badge);
  });

  document.getElementById('round-num').innerText = gameState.round;

  const turnInd = document.getElementById('turn-indicator');
  if (gameState.phase === 'PLAYER_TURN') {
    turnInd.innerText = 'PLAYER ACTION';
    turnInd.className = 'text-blue-400 text-glow-blue';
  } else if (gameState.phase === 'ENEMY_EXECUTION') {
    turnInd.innerText = 'RED SWARM ASSAULT';
    turnInd.className = 'text-red-500 text-glow-red';
  }

  const card = document.getElementById('unit-card');
  const unit = gameState.selectedUnit;

  if (unit && unit.alive) {
    card.classList.remove('opacity-0', 'translate-y-6', 'pointer-events-none');
    document.getElementById('unit-faction').innerText = (unit.faction === FACTION.PLAYER) ? 'BLUE FACTION' : 'RED SWARM';
    document.getElementById('unit-faction').className = (unit.faction === FACTION.PLAYER)
      ? 'text-[10px] uppercase font-mono-tech text-blue-400 tracking-wider font-bold'
      : 'text-[10px] uppercase font-mono-tech text-red-400 tracking-wider font-bold';
    document.getElementById('unit-name').innerText = unit.name;
    document.getElementById('unit-hp-val').innerText = `${unit.hp}/${unit.maxHp}`;
    document.getElementById('unit-move-val').innerText = `${unit.move} TILES`;

    const actStatus = document.getElementById('unit-action-status');
    if (unit.faction === FACTION.PLAYER) {
      actStatus.innerText = unit.hasActed ? 'DONE' : (unit.hasMoved ? 'MOVE LOCKED' : 'READY');
      actStatus.className = unit.hasActed ? 'text-slate-400 font-bold' : 'text-blue-300 font-bold';
    } else {
      actStatus.innerText = unit.intent ? `TARGET (${unit.intent.targetX}, ${unit.intent.targetZ})` : 'IDLE';
      actStatus.className = 'text-red-400 font-bold';
    }

    const actContainer = document.getElementById('action-container');
    const btnPrimary = document.getElementById('btn-act-primary');
    const btnUndo = document.getElementById('btn-undo-move');

    if (unit.faction === FACTION.PLAYER) {
      actContainer.classList.remove('hidden');
      btnPrimary.children[0].innerText = unit.actName;
      btnPrimary.children[1].innerText = unit.actDesc;

      if (gameState.moveHistory && gameState.moveHistory.unit === unit && !unit.hasActed) {
        btnUndo.classList.remove('hidden');
      } else {
        btnUndo.classList.add('hidden');
      }
    } else {
      actContainer.classList.add('hidden');
      btnUndo.classList.add('hidden');
    }
  } else {
    card.classList.add('opacity-0', 'translate-y-6');
  }

  const btnEndTurn = document.getElementById('btn-end-turn');
  btnEndTurn.disabled = (gameState.phase !== 'PLAYER_TURN');
  btnEndTurn.style.opacity = (gameState.phase === 'PLAYER_TURN') ? '1' : '0.5';
}
