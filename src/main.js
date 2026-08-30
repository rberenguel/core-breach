import { scene, camera, renderer, camState, updateCameraFromAngles, resetCamera, mouse } from './scene.js';
import { audio } from './audio.js';
import { gameState } from './state.js';
import { generateProceduralLevel } from './map.js';
import { rng } from './rng.js';
import { handlePreciseGridClick, executeEnemyPhase, undoPlayerMove, executePlayerRepair } from './input.js';
import { showAttackHighlights } from './highlights.js';
import { updateParticles } from './vfx.js';
import { FACTION } from './config.js';

// --- Camera orbit state ---
let isDragging = false;
let mouseDownPos = { x: 0, y: 0 };
let prevMousePos = { x: 0, y: 0 };

const container = document.getElementById('canvas-container');

container.addEventListener('pointerdown', (e) => {
  mouseDownPos = { x: e.clientX, y: e.clientY };
  prevMousePos = { x: e.clientX, y: e.clientY };
  if (e.button === 2 || e.button === 1 || e.shiftKey) {
    isDragging = true;
  }
});

window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
  if (dist > 6 && (e.buttons === 2 || e.buttons === 4 || (e.buttons === 1 && e.shiftKey))) {
    isDragging = true;
  }

  if (isDragging) {
    const dx = e.clientX - prevMousePos.x;
    const dy = e.clientY - prevMousePos.y;
    camState.theta -= dx * 0.008;
    camState.phi = Math.max(0.3, Math.min(Math.PI / 2.2, camState.phi - dy * 0.008));
    updateCameraFromAngles();
    prevMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('pointerup', (e) => {
  const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
  if (dist < 6 && e.button === 0 && !e.shiftKey) {
    handlePreciseGridClick();
  }
  isDragging = false;
});

container.addEventListener('contextmenu', (e) => e.preventDefault());

container.addEventListener('wheel', (e) => {
  camState.radius = Math.max(22, Math.min(65, camState.radius + e.deltaY * 0.03));
  updateCameraFromAngles();
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Button event listeners ---
document.getElementById('btn-act-primary').addEventListener('click', () => {
  if (gameState.selectedUnit && gameState.selectedUnit.faction === FACTION.PLAYER && !gameState.selectedUnit.hasActed) {
    gameState.selectedAction = 'PRIMARY';
    showAttackHighlights(gameState.selectedUnit);
    audio.playSelect();
  }
});

document.getElementById('btn-act-repair').addEventListener('click', () => {
  if (gameState.selectedUnit && gameState.selectedUnit.faction === FACTION.PLAYER && !gameState.selectedUnit.hasActed) {
    executePlayerRepair(gameState.selectedUnit);
  }
});

document.getElementById('btn-undo-move').addEventListener('click', undoPlayerMove);
document.getElementById('btn-end-turn').addEventListener('click', executeEnemyPhase);

document.getElementById('btn-cam-reset').addEventListener('click', () => {
  resetCamera();
  audio.playSelect();
});

document.getElementById('btn-new-sim').addEventListener('click', () => {
  newSeed();
});

document.getElementById('btn-modal-restart').addEventListener('click', () => {
  document.getElementById('modal-screen').classList.add('opacity-0', 'pointer-events-none');
  generateProceduralLevel();
});

document.getElementById('btn-audio').addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  document.getElementById('audio-state').innerText = audio.enabled ? 'ON' : 'OFF';
  if (audio.enabled) audio.playSelect();
});

// --- Render loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  gameState.cores.forEach(coreCell => {
    if (coreCell.hp > 0 && coreCell.featureMesh) {
      const m = coreCell.featureMesh;
      if (m.userData.dodecahedron) {
        m.userData.dodecahedron.rotation.x += delta * 0.5;
        m.userData.dodecahedron.rotation.y += delta * 0.8;
      }
      if (m.userData.wire && m.userData.wire.visible) {
        m.userData.wire.rotation.x += delta * 0.5;
        m.userData.wire.rotation.y += delta * 0.8;
      }
    }
  });

  gameState.units.forEach(u => {
    if (u.alive && u.mesh && u.type === 'HORNET') {
      u.mesh.position.y = Math.sin(elapsed * 4 + u.x) * 0.15;
      if (u.mesh.userData.diamond) {
        u.mesh.userData.diamond.rotation.y += delta * 2.0;
      }
    }
  });

  gameState.telegraphMarkers.forEach(m => {
    if (m.isMesh && m.material) {
      m.material.opacity = 0.45 + Math.sin(elapsed * 6) * 0.22;
    }
  });

  gameState.spawners.forEach(s => {
    if (s.mesh) s.mesh.rotation.z += delta * 1.4;
  });

  updateParticles();

  renderer.render(scene, camera);
}

function parseSeedFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('lvl');
  if (raw !== null) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return n >>> 0;
  }
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

function applySeed(seed) {
  gameState.seed = seed;
  document.getElementById('seed-display').innerText = seed;
  const url = new URL(window.location.href);
  url.searchParams.set('lvl', seed);
  history.replaceState(null, '', url.toString());
}

function newSeed() {
  applySeed((Math.random() * 0xFFFFFFFF) >>> 0);
  generateProceduralLevel();
}

window.onload = function () {
  applySeed(parseSeedFromUrl());
  generateProceduralLevel();
  animate();
};
