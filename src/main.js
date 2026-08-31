import { scene, camera, renderer, camState, camTarget, updateCameraFromAngles, resetCamera, mouse } from './scene.js';
import { audio } from './audio.js';
import { gameState } from './state.js';
import { generateProceduralLevel } from './map.js';
import { rng } from './rng.js';
import { handlePreciseGridClick, executeEnemyPhase, undoPlayerMove, executePlayerRepair, executePlayerAttack } from './input.js';
import { showAttackHighlights, clearAttackPreview } from './highlights.js';
import { updateParticles } from './vfx.js';
import { FACTION, GRID_SIZE, TILE_SIZE } from './config.js';

// --- Camera pan, pinch, and tap with interact.js ---
const container = document.getElementById('canvas-container');
const DRAG_THRESHOLD = 8; // px — dead zone to distinguish taps from drags

let isPanning = false;
let dragAccumX = 0;
let dragAccumY = 0;
let pinchStartRadius = camState.radius;

// Keep mouse vector updated for raycasting
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

interact(document.body)
  .draggable({
    ignoreFrom: 'button, a, input, select, textarea, .cyber-btn, .cyber-panel, #unit-card, #game-footer, header, footer, #settings-panel, #modal-screen, #startup-modal',
    listeners: {
      start(event) {
        isPanning = false;
        dragAccumX = 0;
        dragAccumY = 0;
      },
      move(event) {
        dragAccumX += event.dx;
        dragAccumY += event.dy;

        const dist = Math.hypot(dragAccumX, dragAccumY);
        if (!isPanning && dist > DRAG_THRESHOLD) {
          isPanning = true;
        }

        if (isPanning) {
          event.preventDefault();
          const speed = camState.radius * 0.0008;
          camTarget.x += event.dx * speed * (-Math.sin(camState.theta)) + event.dy * speed * (-Math.cos(camState.theta));
          camTarget.z += event.dx * speed * Math.cos(camState.theta) + event.dy * speed * (-Math.sin(camState.theta));
          updateCameraFromAngles();
        }
      },
      end(event) {
        isPanning = false;
      }
    }
  })
  .on('tap', (event) => {
    if (event.target.closest('#canvas-container')) {
      const cx = event.clientX ?? event.pageX ?? 0;
      const cy = event.clientY ?? event.pageY ?? 0;
      mouse.x = (cx / window.innerWidth) * 2 - 1;
      mouse.y = -(cy / window.innerHeight) * 2 + 1;
      console.log('[TAP] raw=', cx, cy, 'mouse=', mouse.x.toFixed(3), mouse.y.toFixed(3), 'target=', event.target.id || event.target.tagName);
      handlePreciseGridClick();
    }
  })
  .gesturable({
    listeners: {
      start(event) {
        pinchStartRadius = camState.radius;
      },
      move(event) {
        event.preventDefault();
        camState.radius = Math.max(22, Math.min(65, pinchStartRadius / event.scale));
        updateCameraFromAngles();
      }
    }
  });

container.addEventListener('contextmenu', e => { if (e.button !== 2) e.preventDefault(); });

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
['btn-act-primary','btn-act-repair','btn-undo-move','btn-end-turn'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => {
    console.log('[CLICKLOG] pointerdown on', id, 'target=', e.target.tagName, 'class=', e.target.className);
  });
  el.addEventListener('click', e => {
    console.log('[CLICKLOG] click on', id);
  });
});

document.getElementById('btn-act-primary').addEventListener('click', () => {
  console.log('[CLICKLOG] btn-act-primary handler fired');
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
  console.log('[CLICKLOG] btn-act-repair handler fired');
  if (gameState.selectedUnit && gameState.selectedUnit.faction === FACTION.PLAYER && !gameState.selectedUnit.hasActed) {
    executePlayerRepair(gameState.selectedUnit);
  }
});

document.getElementById('btn-undo-move').addEventListener('click', () => {
  console.log('[CLICKLOG] btn-undo-move handler fired');
  undoPlayerMove();
});
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
  gameState.battleCount++;
  newSeed();
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
