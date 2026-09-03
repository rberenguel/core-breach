import { UNIT_TYPES, FACTION } from './config.js';
import { gameState } from './state.js';
import { rng } from './rng.js';

let _currentDraftCards = [];
let _selectedDraftIndex = -1;

export function generateDraftCards(count) {
  const playerUnits = gameState.units.filter(u => u.alive && u.faction === FACTION.PLAYER);
  const usedTypes = new Set(playerUnits.map(u => u.type));
  const availableTypes = ['STRIKER', 'ARTILLERY', 'RAILGUN', 'ROCKET'].filter(t => !usedTypes.has(t));

  const pool = [];

  // Global stat upgrades
  pool.push({ id: 'hp_all', type: 'global', stat: 'maxHp', value: 1, label: '+1 MAX HP', desc: 'All units gain +1 max HP and heal +1', icon: 'ph-heart' });
  pool.push({ id: 'move_all', type: 'global', stat: 'move', value: 1, label: '+1 MOVE', desc: 'All units gain +1 movement', icon: 'ph-arrows-out-cardinal' });
  pool.push({ id: 'dmg_all', type: 'global', stat: 'dmg', value: 1, label: '+1 DAMAGE', desc: 'All units deal +1 damage', icon: 'ph-sword' });

  // Unit-specific stat upgrades
  for (const unit of playerUnits) {
    pool.push({ id: `hp_${unit.id}`, type: 'unit', stat: 'maxHp', value: 1, label: '+1 MAX HP', desc: `${unit.name} gains +1 max HP and heals +1`, icon: 'ph-heart', targetUnit: unit });
    pool.push({ id: `move_${unit.id}`, type: 'unit', stat: 'move', value: 1, label: '+1 MOVE', desc: `${unit.name} gains +1 movement`, icon: 'ph-arrows-out-cardinal', targetUnit: unit });
    pool.push({ id: `dmg_${unit.id}`, type: 'unit', stat: 'dmg', value: 1, label: '+1 DAMAGE', desc: `${unit.name} deals +1 damage`, icon: 'ph-sword', targetUnit: unit });
  }

  // Utility upgrades
  pool.push({ id: 'repair_full', type: 'utility', action: 'repair_full', label: 'FULL REPAIR', desc: 'Restore most damaged unit to full HP', icon: 'ph-wrench' });

  if (playerUnits.length < 3 && availableTypes.length > 0 && rng.random() < 0.25) {
    const recruitType = availableTypes[Math.floor(rng.random() * availableTypes.length)];
    const typeConfig = Object.values(UNIT_TYPES).find(u => u.id === recruitType);
    pool.push({ id: 'recruit', type: 'utility', action: 'recruit', recruitType, label: 'NEW RECRUIT', desc: `Add ${typeConfig.name} to squad`, icon: 'ph-user-plus' });
  }

  // Shuffle and pick
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  _currentDraftCards = shuffled.slice(0, count);
  _selectedDraftIndex = _currentDraftCards.length === 1 ? 0 : -1;
  return _currentDraftCards;
}

export function renderDraftCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  _currentDraftCards.forEach((card, idx) => {
    const el = document.createElement('div');
    el.className = 'draft-card' + (idx === 0 && _currentDraftCards.length === 1 ? ' selected' : '');
    el.dataset.index = idx;
    el.innerHTML = `
      <div class="draft-card-icon"><i class="ph-light ${card.icon}"></i></div>
      <div class="draft-card-label">${card.label}</div>
      <div class="draft-card-desc">${card.desc}</div>
    `;
    el.addEventListener('click', () => {
      container.querySelectorAll('.draft-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      _selectedDraftIndex = idx;
      const deployBtn = document.getElementById('btn-modal-restart');
      if (deployBtn) {
        deployBtn.disabled = false;
        deployBtn.style.opacity = '1';
      }
    });
    container.appendChild(el);
  });
}

export function hasDraftSelection() {
  return _selectedDraftIndex >= 0 && _selectedDraftIndex < _currentDraftCards.length;
}

export function getSelectedDraftCard() {
  if (_selectedDraftIndex >= 0 && _selectedDraftIndex < _currentDraftCards.length) {
    return _currentDraftCards[_selectedDraftIndex];
  }
  return null;
}

export function clearDraft() {
  _currentDraftCards = [];
  _selectedDraftIndex = -1;
  const container = document.getElementById('draft-cards');
  if (container) container.innerHTML = '';
}

export function applyUpgrade(card) {
  if (!card) return;
  const playerUnits = gameState.units.filter(u => u.alive && u.faction === FACTION.PLAYER);

  if (card.type === 'global') {
    for (const unit of playerUnits) {
      if (card.stat === 'maxHp') {
        unit.maxHp += card.value;
        unit.hp = Math.min(unit.maxHp, unit.hp + card.value);
      } else if (card.stat === 'move') {
        unit.move += card.value;
      } else if (card.stat === 'dmg') {
        unit.dmg = (unit.dmg || 1) + card.value;
      }
    }
  } else if (card.type === 'unit' && card.targetUnit) {
    const unit = card.targetUnit;
    if (card.stat === 'maxHp') {
      unit.maxHp += card.value;
      unit.hp = Math.min(unit.maxHp, unit.hp + card.value);
    } else if (card.stat === 'move') {
      unit.move += card.value;
    } else if (card.stat === 'dmg') {
      unit.dmg = (unit.dmg || 1) + card.value;
    }
  } else if (card.type === 'utility') {
    if (card.action === 'repair_full') {
      let target = playerUnits[0];
      let maxGap = target ? target.maxHp - target.hp : 0;
      for (const u of playerUnits) {
        const gap = u.maxHp - u.hp;
        if (gap > maxGap) { maxGap = gap; target = u; }
      }
      if (target) target.hp = target.maxHp;
    } else if (card.action === 'recruit') {
      gameState.pendingRecruit = card.recruitType;
    }
  }
}
