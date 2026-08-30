import { FACTION, MAX_ROUNDS } from './config.js';
import { gameState } from './state.js';

function formatOutcomes(outcomes) {
  if (!outcomes || outcomes.length === 0) return 'NO TARGETS';
  return outcomes.map(o => {
    const killWord = o.fate === 'FALL' ? 'FALL→KILL' : 'KILL';
    let s = o.dies ? `${killWord} ${o.unit.name}` : `-${o.damage} ${o.unit.name}`;
    if (!o.dies && o.push) {
      if (o.push.fate === 'OVERLOAD') s += ' →OVERLOAD';
      else if (o.push.fate === 'EDGE' || o.push.fate === 'BLOCKED') s += ' →BUMP';
      else if (o.push.fate === 'PUSH') s += ' →PUSH';
    }
    return s;
  }).join(' | ');
}

export function updateHUD() {
  document.getElementById('round-num').innerText = gameState.round;

  const card = document.getElementById('unit-card');
  const unit = gameState.selectedUnit;

  const knob = document.getElementById('pan-knob');

  if (unit && unit.alive) {
    gameState.selectedTile = null;
    card.classList.remove('hidden', 'pointer-events-none');
    if (knob) knob.classList.add('hidden');

    document.getElementById('unit-faction').innerText = (unit.faction === FACTION.PLAYER) ? 'BLUE FACTION' : 'RED SWARM';
    document.getElementById('unit-faction').className = (unit.faction === FACTION.PLAYER)
      ? 'text-[10px] uppercase font-mono-tech text-blue-400 tracking-wider font-bold'
      : 'text-[10px] uppercase font-mono-tech text-red-400 tracking-wider font-bold';
    document.getElementById('unit-name').innerText = unit.name;
    document.getElementById('unit-hp-val').innerText = `${unit.hp}/${unit.maxHp}`;
    document.getElementById('unit-move-val').innerText = `${unit.move} TILES`;

    const actStatus = document.getElementById('unit-action-status');
    if (unit.faction === FACTION.PLAYER) {
      if (gameState.attackPreview) {
        actStatus.innerText = 'CONFIRM FIRE?';
        actStatus.className = 'text-yellow-300 font-bold';
      } else if (unit.dataOverload) {
        actStatus.innerText = 'DATA OVERLOAD';
        actStatus.className = 'text-cyan-400 font-bold';
      } else {
        actStatus.innerText = unit.hasActed ? 'DONE' : (unit.hasMoved ? 'MOVE LOCKED' : 'READY');
        actStatus.className = unit.hasActed ? 'text-slate-400 font-bold' : 'text-blue-300 font-bold';
      }
    } else {
      actStatus.innerText = unit.intent ? `TARGET (${unit.intent.targetX}, ${unit.intent.targetZ})` : 'IDLE';
      actStatus.className = 'text-red-400 font-bold';
    }

    const actContainer = document.getElementById('action-container');
    const btnPrimary = document.getElementById('btn-act-primary');
    const btnUndo = document.getElementById('btn-undo-move');

    if (unit.faction === FACTION.PLAYER) {
      actContainer.classList.remove('hidden');
      if (gameState.attackPreview) {
        btnPrimary.children[0].innerText = 'CONFIRM FIRE';
        btnPrimary.children[1].innerText = formatOutcomes(gameState.attackPreview.outcomes);
        btnPrimary.disabled = false;
        btnPrimary.style.opacity = '';
      } else {
        btnPrimary.children[0].innerText = unit.actName;
        btnPrimary.children[1].innerText = unit.dataOverload ? 'DATA OVERLOAD — MOVE ONLY' : unit.actDesc;
        btnPrimary.disabled = !!unit.dataOverload;
        btnPrimary.style.opacity = unit.dataOverload ? '0.4' : '';
      }

      if (gameState.moveHistory && gameState.moveHistory.unit === unit && !unit.hasActed) {
        btnUndo.classList.remove('hidden');
      } else {
        btnUndo.classList.add('hidden');
      }
    } else {
      actContainer.classList.add('hidden');
      btnUndo.classList.add('hidden');
    }

  } else if (gameState.selectedTile) {
    const tile = gameState.selectedTile;
    card.classList.remove('hidden', 'pointer-events-none');
    if (knob) knob.classList.add('hidden');

    document.getElementById('unit-faction').innerText = tile.category;
    document.getElementById('unit-faction').className = 'text-[10px] uppercase font-mono-tech text-emerald-400 tracking-wider font-bold';
    document.getElementById('unit-name').innerText = tile.name;
    document.getElementById('unit-hp-val').innerText = tile.hp != null ? `${tile.hp}/${tile.maxHp}` : '—';
    document.getElementById('unit-move-val').innerText = tile.detail || '—';

    const actStatus = document.getElementById('unit-action-status');
    actStatus.innerText = tile.status;
    actStatus.className = tile.statusClass || 'text-emerald-300 font-bold';

    document.getElementById('action-container').classList.add('hidden');
    document.getElementById('btn-undo-move').classList.add('hidden');
  } else {
    card.classList.add('hidden', 'pointer-events-none');
    if (knob) knob.classList.remove('hidden');
  }

  const btnEndTurn = document.getElementById('btn-end-turn');
  btnEndTurn.disabled = (gameState.phase !== 'PLAYER_TURN');
  btnEndTurn.style.opacity = (gameState.phase === 'PLAYER_TURN') ? '1' : '0.5';
}
