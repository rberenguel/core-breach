import { scene, camera, renderer, camState, camTarget, updateCameraFromAngles, resetCamera, mouse } from './scene.js';
import { audio } from './audio.js';
import { gameState } from './state.js';
import { generateProceduralLevel } from './map.js';
import { rng } from './rng.js';
import { handlePreciseGridClick, executeEnemyPhase, undoPlayerMove, executePlayerRepair, executePlayerAttack } from './input.js';
import { showAttackHighlights, clearAttackPreview } from './highlights.js';
import { updateParticles } from './vfx.js';
import { FACTION, GRID_SIZE, TILE_SIZE } from './config.js';

// --- Pan overlay ---
const _hw = (GRID_SIZE * TILE_SIZE) / 2 + 0.5;
const panOverlayPoints = new Float32Array([
  -_hw, 0, -_hw,  _hw, 0, -_hw,
   _hw, 0, -_hw,  _hw, 0,  _hw,
   _hw, 0,  _hw, -_hw, 0,  _hw,
  -_hw, 0,  _hw, -_hw, 0, -_hw,
]);
const panOverlayGeo = new THREE.BufferGeometry();
panOverlayGeo.setAttribute('position', new THREE.BufferAttribute(panOverlayPoints, 3));
const panOverlay = new THREE.LineSegments(panOverlayGeo, new THREE.LineBasicMaterial({ color: 0xffff00 }));
panOverlay.position.set(camTarget.x, 0.1, camTarget.z);
panOverlay.visible = false;
scene.add(panOverlay);

// --- Camera orbit state ---
let isDragging = false;
let isPointerDown = false;
let mouseDownPos = { x: 0, y: 0 };
let prevMousePos = { x: 0, y: 0 };
let camTargetAtDown = { x: 0, z: 0 };
let panReadyTimeout = null;
let panReady = false;

const container = document.getElementById('canvas-container');

container.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  container.setPointerCapture(e.pointerId);
  isPointerDown = true;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  prevMousePos = { x: e.clientX, y: e.clientY };
  isDragging = false;
  camTargetAtDown = { x: camTarget.x, z: camTarget.z };
  panReady = false;
  panReadyTimeout = setTimeout(() => { panOverlay.visible = true; panReady = true; }, 500);
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (e.buttons !== 1 && isPointerDown) { cancelDrag(); }
  if (e.buttons === 1) {
    const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
    if (dist > 20 && panReady) {
      isDragging = true;
    }
    if (isDragging) {
      const dx = e.clientX - prevMousePos.x;
      const dy = e.clientY - prevMousePos.y;
      const speed = camState.radius * 0.0008;
      camTarget.x += dx * speed * (-Math.sin(camState.theta)) + dy * speed * (-Math.cos(camState.theta));
      camTarget.z += dx * speed * Math.cos(camState.theta) + dy * speed * (-Math.sin(camState.theta));
      updateCameraFromAngles();
    }
    prevMousePos = { x: e.clientX, y: e.clientY };
  }
});

function cancelDrag() {
  if (isPointerDown) {
    camTarget.x = camTargetAtDown.x;
    camTarget.z = camTargetAtDown.z;
    updateCameraFromAngles();
  }
  isDragging = false;
  isPointerDown = false;
  panReady = false;
  panOverlay.visible = false;
  clearTimeout(panReadyTimeout);
}

container.addEventListener('pointercancel', cancelDrag);
container.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); });

window.addEventListener('pointerup', (e) => {
  if (e.button === 0 && isPointerDown) {
    if (!isDragging) {
      camTarget.x = camTargetAtDown.x;
      camTarget.z = camTargetAtDown.z;
      updateCameraFromAngles();
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      handlePreciseGridClick();
    }
    isDragging = false;
    isPointerDown = false;
    panOverlay.visible = false;
    clearTimeout(panReadyTimeout);
  }
});


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
  const unit = gameState.selectedUnit;
  if (!unit || unit.faction !== FACTION.PLAYER || unit.hasActed) return;
  if (gameState.attackPreview) {
    const prev = gameState.attackPreview;
    clearAttackPreview();
    executePlayerAttack(unit, prev.targetX, prev.targetZ, prev.dx, prev.dz);
  } else {
    gameState.selectedAction = 'PRIMARY';
    showAttackHighlights(unit);
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

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameState.phase === 'PLAYER_TURN') {
    e.preventDefault();
    executeEnemyPhase();
  }
});

document.getElementById('btn-cam-reset').addEventListener('click', () => {
  resetCamera();
  audio.playSelect();
});

document.getElementById('btn-new-sim').addEventListener('click', () => {
  newSeed();
  document.getElementById('settings-panel').classList.add('hidden');
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

document.getElementById('btn-settings').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('settings-panel').classList.toggle('hidden');
});

document.addEventListener('click', () => {
  document.getElementById('settings-panel').classList.add('hidden');
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
    if (u.alive && u.mesh && u.type === 'FLIER') {
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
    if (s.mesh) {
      const pulse = 0.72 + Math.sin(elapsed * 2.8 + s.x + s.z) * 0.28;
      s.mesh.scale.setScalar(pulse);
    }
  });

  const staticFrame = Math.floor(elapsed * 8);
  gameState.pools.forEach(p => {
    if (p.lastStaticFrame === staticFrame) return;
    p.lastStaticFrame = staticFrame;
    const ctx = p.mesh && p.mesh.userData.staticCtx;
    if (!ctx) return;
    const RES = 16;
    const img = ctx.createImageData(RES, RES);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.82
        ? Math.floor(Math.random() * 45)
        : Math.floor(60 + Math.random() * 140);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    p.mesh.userData.staticTexture.needsUpdate = true;
  });

  updateParticles();

  renderer.render(scene, camera);
}

const SEED_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SEED_BASE = SEED_CHARS.length; // 52
const SEED_LEN = 6;

function seedToCode(seed) {
  seed = seed >>> 0;
  let code = '';
  for (let i = 0; i < SEED_LEN; i++) {
    code = SEED_CHARS[seed % SEED_BASE] + code;
    seed = Math.floor(seed / SEED_BASE);
  }
  return code;
}

function codeToSeed(code) {
  let n = 0;
  for (const ch of code) {
    const idx = SEED_CHARS.indexOf(ch);
    if (idx === -1) return null;
    n = n * SEED_BASE + idx;
  }
  return n >>> 0;
}

function parseSeedFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('lvl');
  if (raw !== null) {
    if (/^[a-zA-Z]{6}$/.test(raw)) {
      const n = codeToSeed(raw);
      if (n !== null) return n;
    }
    // legacy numeric seeds
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return n >>> 0;
  }
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

function applySeed(seed) {
  gameState.seed = seed;
  const code = seedToCode(seed);
  document.getElementById('seed-display').innerText = code;
  const url = new URL(window.location.href);
  url.searchParams.set('lvl', code);
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
