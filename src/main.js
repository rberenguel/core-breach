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
container.addEventListener('contextmenu', e => { if (e.button !== 2) e.preventDefault(); });
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

// --- Pinch to zoom (touch) ---
let lastPinchDist = null;

container.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    cancelDrag();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastPinchDist = Math.hypot(dx, dy);
    e.preventDefault();
  }
}, { passive: false });

container.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && lastPinchDist !== null) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    camState.radius = Math.max(22, Math.min(65, camState.radius + (lastPinchDist - dist) * 0.12));
    updateCameraFromAngles();
    lastPinchDist = dist;
    e.preventDefault();
  }
}, { passive: false });

container.addEventListener('touchend', () => { lastPinchDist = null; }, { passive: true });

// --- Pan knob (mobile only) ---
if (navigator.maxTouchPoints > 0) {
  const knob = document.createElement('div');
  knob.id = 'pan-knob';
  knob.className = 'pan-knob';
  knob.textContent = '✥';
  const footer = document.getElementById('game-footer');
  footer.insertBefore(knob, footer.firstChild);

  let knobActive = false;
  let knobPrev = { x: 0, y: 0 };

  knob.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    knob.setPointerCapture(e.pointerId);
    knobActive = true;
    knobPrev = { x: e.clientX, y: e.clientY };
  });

  knob.addEventListener('pointermove', (e) => {
    if (!knobActive) return;
    const dx = e.clientX - knobPrev.x;
    const dy = e.clientY - knobPrev.y;
    const spd = camState.radius * 0.002;
    camTarget.x += dx * spd * (-Math.sin(camState.theta)) + dy * spd * (-Math.cos(camState.theta));
    camTarget.z += dx * spd * Math.cos(camState.theta) + dy * spd * (-Math.sin(camState.theta));
    updateCameraFromAngles();
    knobPrev = { x: e.clientX, y: e.clientY };
  });

  knob.addEventListener('pointerup', () => { knobActive = false; });
  knob.addEventListener('pointercancel', () => { knobActive = false; });
}

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

document.getElementById('btn-copy-link').addEventListener('click', () => {
  const code = seedToCode(gameState.seed);
  const url = new URL(window.location.href);
  url.searchParams.set('lvl', code);
  navigator.clipboard.writeText(url.toString());
  const btn = document.getElementById('btn-copy-link');
  btn.textContent = 'COPIED!';
  setTimeout(() => { btn.textContent = 'COPY LINK'; }, 1500);
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
}

function newSeed() {
  applySeed((Math.random() * 0xFFFFFFFF) >>> 0);
  generateProceduralLevel();
}

const isMobile = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const needsStandalone = () => {
  const standaloneiOS = window.navigator.standalone === true;
  const standaloneAndroid = window.matchMedia('(display-mode: standalone)').matches;
  return isMobile() && !standaloneiOS && !standaloneAndroid;
};

window.onload = function () {
  if (needsStandalone()) {
    const panel = document.querySelector('#startup-modal .cyber-panel');
    panel.innerHTML =
      '<div class="flex items-center gap-4 mb-5">' +
        '<img src="./icon.jpeg" alt="" class="w-12 h-12 shrink-0 object-cover">' +
        '<div>' +
          '<h1 class="text-2xl font-orbitron font-black text-white text-glow-blue leading-tight">CORE BREACH</h1>' +
          '<div class="text-xs font-mono-tech text-yellow-400 tracking-widest mt-0.5">INSTALL REQUIRED</div>' +
        '</div>' +
      '</div>' +
      '<div class="mb-5 bg-black/40 border border-yellow-500/50 p-4">' +
        '<div class="text-[10px] font-mono-tech text-yellow-400 uppercase tracking-widest font-bold mb-2">Play as installed app</div>' +
        '<p class="text-slate-300 font-mono-tech text-sm leading-relaxed">This game works best when installed. On iOS: tap <strong class="text-white">Share → Add to Home Screen</strong>. On Android: tap the browser menu and choose <strong class="text-white">Install App</strong>.</p>' +
      '</div>' +
      '<p class="text-slate-500 font-mono-tech text-xs text-center">Open in Safari (iOS) or Chrome (Android) if the install option is missing.</p>' +
      '<button id="btn-skip-install" class="w-full py-2 mt-3 border border-slate-600 text-slate-500 text-xs">play anyway</button>';

    document.getElementById('btn-skip-install').addEventListener('click', () => {
      document.getElementById('startup-modal').style.display = 'none';
      applySeed(parseSeedFromUrl());
      generateProceduralLevel();
      animate();
    });
    return;
  }

  applySeed(parseSeedFromUrl());
  generateProceduralLevel();
  animate();
};
