import { scene, camera } from './scene.js';
import { gameState } from './state.js';

const fireGeo = new THREE.PlaneGeometry(0.35, 0.35);

export function spawnFireEffect(x, y, z, count = 20) {
  for (let i = 0; i < count; i++) {
    const fireMat = new THREE.MeshBasicMaterial({
      color: (Math.random() > 0.4) ? 0xff3b00 : 0xffaa00,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const pMesh = new THREE.Mesh(fireGeo, fireMat);
    pMesh.position.set(
      x + (Math.random() - 0.5) * 0.6,
      y + (Math.random() - 0.5) * 0.4,
      z + (Math.random() - 0.5) * 0.6
    );
    pMesh.rotation.z = Math.random() * Math.PI;

    const particle = {
      mesh: pMesh,
      vx: (Math.random() - 0.5) * 0.05,
      vy: 0.03 + Math.random() * 0.06,
      vz: (Math.random() - 0.5) * 0.05,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      scale: 0.5 + Math.random() * 0.8,
      life: 1.0,
      decay: 0.010 + Math.random() * 0.015
    };

    scene.add(pMesh);
    gameState.particles.push(particle);
  }
}

export function updateParticles() {
  for (let i = gameState.particles.length - 1; i >= 0; i--) {
    const p = gameState.particles[i];
    p.life -= p.decay;

    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.mesh.rotation.z += p.rotSpeed;

    const curScale = p.scale * p.life;
    p.mesh.scale.set(curScale, curScale, curScale);
    p.mesh.material.opacity = Math.max(0, p.life * 0.9);

    p.mesh.quaternion.copy(camera.quaternion);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      gameState.particles.splice(i, 1);
    }
  }
}

export function spawnFloatingText(text, pos, color = '#ffffff') {
  const layer = document.getElementById('floating-layer');
  const el = document.createElement('div');
  el.className = 'floating-text text-xs md:text-sm';
  el.style.color = color;
  el.style.textShadow = `0 0 10px ${color}`;
  el.innerText = text;

  const tempVec = new THREE.Vector3(pos.x, (pos.y || 0) + 1.6, pos.z);
  tempVec.project(camera);

  const screenX = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-(tempVec.y * 0.5) + 0.5) * window.innerHeight;

  el.style.left = `${screenX}px`;
  el.style.top = `${screenY}px`;
  layer.appendChild(el);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1300);
}

export function spawnExplosionEffect(wx, wz) {
  // Outer wireframe shockwave
  const geo = new THREE.SphereGeometry(1.2, 12, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff5500, wireframe: true, transparent: true, opacity: 1.0,
    depthWrite: false
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.position.set(wx, 0.5, wz);
  scene.add(sphere);

  // Inner solid glow
  const innerGeo = new THREE.SphereGeometry(0.8, 10, 10);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  sphere.add(inner);

  const DURATION = 780;
  const startTime = performance.now();

  function expand() {
    const t = Math.min(1, (performance.now() - startTime) / DURATION);
    // Ease out: fast start, slow end
    const eased = 1 - Math.pow(1 - t, 2.5);

    const scale = 0.15 + eased * 2.8;
    sphere.scale.set(scale, scale, scale);
    mat.opacity = Math.max(0, 1 - eased);
    innerMat.opacity = Math.max(0, 0.75 * (1 - t * 1.4));

    if (t < 1) {
      requestAnimationFrame(expand);
    } else {
      scene.remove(sphere);
      geo.dispose(); mat.dispose();
      innerGeo.dispose(); innerMat.dispose();
    }
  }

  expand();
}

export function spawnLaserBeamEffect(startPos, endPos) {
  const s = new THREE.Vector3(startPos.x, 0.55, startPos.z);
  const e = new THREE.Vector3(endPos.x, 0.55, endPos.z);
  const dir = new THREE.Vector3().subVectors(e, s);
  const length = dir.length();
  const angle = Math.atan2(dir.x, dir.z);
  const mid = s.clone().add(e).multiplyScalar(0.5);

  // Wide glow beam
  const glowGeo = new THREE.BoxGeometry(0.22, 0.08, length);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glowBeam = new THREE.Mesh(glowGeo, glowMat);
  glowBeam.position.copy(mid);
  glowBeam.rotation.y = angle;
  scene.add(glowBeam);

  // Bright white core
  const coreGeo = new THREE.BoxGeometry(0.05, 0.05, length);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const coreBeam = new THREE.Mesh(coreGeo, coreMat);
  coreBeam.position.copy(mid);
  coreBeam.rotation.y = angle;
  scene.add(coreBeam);

  // Traveling slug (the rail "projectile")
  const slugGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const slugMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const slug = new THREE.Mesh(slugGeo, slugMat);
  slug.position.copy(s);
  scene.add(slug);

  const SLUG_MS = 400;
  const BEAM_MS = 650;
  const startTime = performance.now();
  let slugRemoved = false;

  function animate() {
    const elapsed = performance.now() - startTime;
    const tSlug = Math.min(1, elapsed / SLUG_MS);
    const tBeam = Math.min(1, elapsed / BEAM_MS);

    // Slug sweeps from start to end
    slug.position.x = s.x + (e.x - s.x) * tSlug;
    slug.position.z = s.z + (e.z - s.z) * tSlug;
    slugMat.opacity = 1 - tSlug * 0.25;

    if (tSlug >= 1 && !slugRemoved) {
      scene.remove(slug);
      slugRemoved = true;
    }

    // Beam sustains then fades
    const beamFade = 1 - tBeam;
    glowMat.opacity = 0.65 * beamFade;
    coreMat.opacity = 0.95 * beamFade;
    // Glow widens slightly as it dissipates
    glowBeam.scale.x = 1 + tBeam * 2.5;

    if (tBeam < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(glowBeam);
      scene.remove(coreBeam);
      if (!slugRemoved) scene.remove(slug);
      glowGeo.dispose(); glowMat.dispose();
      coreGeo.dispose(); coreMat.dispose();
      slugGeo.dispose(); slugMat.dispose();
    }
  }

  requestAnimationFrame(animate);
}

export function spawnArcProjectile(startPos, endPos, onImpact) {
  const projGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const projMat = new THREE.MeshBasicMaterial({
    color: 0xff8800, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const proj = new THREE.Mesh(projGeo, projMat);
  proj.position.set(startPos.x, 0.5, startPos.z);
  scene.add(proj);

  // Outer halo glow
  const haloGeo = new THREE.SphereGeometry(0.38, 8, 8);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff5500, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  proj.add(halo);

  const DURATION = 560;
  const ARC_HEIGHT = 5.5;
  const startTime = performance.now();

  function fly() {
    const t = Math.min(1, (performance.now() - startTime) / DURATION);

    proj.position.x = startPos.x + (endPos.x - startPos.x) * t;
    proj.position.z = startPos.z + (endPos.z - startPos.z) * t;
    proj.position.y = 0.5 + ARC_HEIGHT * 4 * t * (1 - t);

    // Grow slightly on ascent, shrink on descent
    const s = 1 + Math.sin(t * Math.PI) * 0.4;
    proj.scale.setScalar(s);

    if (t < 1) {
      requestAnimationFrame(fly);
    } else {
      scene.remove(proj);
      projGeo.dispose(); projMat.dispose();
      haloGeo.dispose(); haloMat.dispose();
      if (onImpact) onImpact();
    }
  }

  requestAnimationFrame(fly);
}

export function spawnEnemyBolt(startPos, endPos, onImpact) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.45, 6);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0xff2244, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff0033, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  const dir = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z);
  dir.normalize();

  group.position.set(startPos.x, 0.7, startPos.z);
  group.rotation.y = Math.atan2(dir.x, dir.z);
  scene.add(group);

  const DURATION = 180;
  const startTime = performance.now();

  function fly() {
    const t = Math.min(1, (performance.now() - startTime) / DURATION);
    group.position.x = startPos.x + (endPos.x - startPos.x) * t;
    group.position.z = startPos.z + (endPos.z - startPos.z) * t;

    if (t < 1) {
      for (let i = 0; i < 2; i++) {
        const pGeo = new THREE.PlaneGeometry(0.07, 0.07);
        const pMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xff4466 : 0xff0022,
          transparent: true, opacity: 0.7,
          depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        const p = new THREE.Mesh(pGeo, pMat);
        const back = dir.clone().multiplyScalar(-(0.15 + Math.random() * 0.12));
        p.position.copy(group.position).add(back);
        p.position.y = 0.7 + (Math.random() - 0.5) * 0.08;
        p.rotation.z = Math.random() * Math.PI;
        scene.add(p);

        const pStart = performance.now();
        const pDur = 200 + Math.random() * 120;
        function fade() {
          const pt = Math.min(1, (performance.now() - pStart) / pDur);
          p.scale.setScalar(1 - pt * 0.7);
          pMat.opacity = 0.7 * (1 - pt);
          if (pt < 1) requestAnimationFrame(fade);
          else { scene.remove(p); pGeo.dispose(); pMat.dispose(); }
        }
        requestAnimationFrame(fade);
      }
    }

    if (t < 1) {
      requestAnimationFrame(fly);
    } else {
      scene.remove(group);
      bodyGeo.dispose(); bodyMat.dispose();
      glowGeo.dispose(); glowMat.dispose();
      if (onImpact) onImpact();
    }
  }

  requestAnimationFrame(fly);
}

export function spawnRocketProjectile(startPos, endPos, onImpact) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0xffdd44, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  const noseGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
  noseGeo.rotateX(Math.PI / 2);
  const noseMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.z = 0.35;
  group.add(nose);

  const glowGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff8800, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  const dir = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z);
  dir.normalize();

  group.position.set(startPos.x, 0.7, startPos.z);
  group.rotation.y = Math.atan2(dir.x, dir.z);
  scene.add(group);

  const DURATION = 220;
  const startTime = performance.now();

  function fly() {
    const t = Math.min(1, (performance.now() - startTime) / DURATION);

    group.position.x = startPos.x + (endPos.x - startPos.x) * t;
    group.position.z = startPos.z + (endPos.z - startPos.z) * t;

    if (t < 1) {
      for (let i = 0; i < 2; i++) {
        const pGeo = new THREE.PlaneGeometry(0.08, 0.08);
        const pMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xffaa00 : 0xff4400,
          transparent: true, opacity: 0.7,
          depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        const p = new THREE.Mesh(pGeo, pMat);
        const back = dir.clone().multiplyScalar(-(0.2 + Math.random() * 0.15));
        p.position.copy(group.position).add(back);
        p.position.y = 0.7 + (Math.random() - 0.5) * 0.1;
        p.rotation.z = Math.random() * Math.PI;
        scene.add(p);

        const pStart = performance.now();
        const pDur = 250 + Math.random() * 150;
        function fade() {
          const pt = Math.min(1, (performance.now() - pStart) / pDur);
          p.scale.setScalar(1 - pt * 0.7);
          pMat.opacity = 0.7 * (1 - pt);
          if (pt < 1) requestAnimationFrame(fade);
          else { scene.remove(p); pGeo.dispose(); pMat.dispose(); }
        }
        requestAnimationFrame(fade);
      }
    }

    if (t < 1) {
      requestAnimationFrame(fly);
    } else {
      scene.remove(group);
      bodyGeo.dispose(); bodyMat.dispose();
      noseGeo.dispose(); noseMat.dispose();
      glowGeo.dispose(); glowMat.dispose();
      if (onImpact) onImpact();
    }
  }

  requestAnimationFrame(fly);
}
