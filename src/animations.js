import { gridToWorld } from './state.js';
import { scene } from './scene.js';

export function moveUnitMeshSmooth(unit, destGx, destGz, onComplete, path) {
  const waypoints = path && path.length > 1
    ? path.map(p => gridToWorld(p.x, p.z))
    : [unit.mesh.position.clone(), gridToWorld(destGx, destGz)];

  // Build cumulative distances along the polyline
  const dists = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dz = waypoints[i].z - waypoints[i - 1].z;
    dists.push(dists[i - 1] + Math.hypot(dx, dz));
  }
  const totalDist = dists[dists.length - 1];
  const msPerTile = 240;
  const totalSteps = waypoints.length - 1;
  const duration = totalSteps * msPerTile;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const tRaw = Math.min(1, elapsed / duration);
    const ease = tRaw;
    const travelled = totalDist * ease;

    // Find which segment we're on
    let seg = 0;
    for (let i = 1; i < dists.length; i++) {
      if (travelled <= dists[i]) {
        seg = i - 1;
        break;
      }
    }
    const segStart = dists[seg];
    const segEnd = dists[seg + 1];
    const segLen = segEnd - segStart;
    const segT = segLen > 0 ? (travelled - segStart) / segLen : 0;

    const from = waypoints[seg];
    const to = waypoints[seg + 1];

    unit.mesh.position.x = from.x + (to.x - from.x) * segT;
    unit.mesh.position.z = from.z + (to.z - from.z) * segT;
    unit.mesh.position.y = path && path.length > 1 ? 0 : Math.sin(tRaw * Math.PI) * 0.4;

    // Face current velocity direction
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (dx !== 0 || dz !== 0) {
      unit.mesh.rotation.y = Math.atan2(dx, dz);
    }

    if (tRaw >= 1) {
      const final = waypoints[waypoints.length - 1];
      unit.mesh.position.x = final.x;
      unit.mesh.position.z = final.z;
      unit.mesh.position.y = 0;
      if (onComplete) onComplete();
      return;
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function animatePunchMesh(mesh, color = 0xff0033) {
  // Clean hemisphere: top half, bulges toward +Y by default
  const geo = new THREE.SphereGeometry(1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  // Rotate so flat edge is vertical and dome bulges toward +Z (the attack direction)
  geo.rotateX(Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const burst = new THREE.Mesh(geo, mat);
  burst.position.copy(mesh.position);
  burst.rotation.y = mesh.rotation.y;
  burst.scale.setScalar(0.1);
  scene.add(burst);

  // Wireframe edge ring
  const wireGeo = new THREE.SphereGeometry(1.05, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  wireGeo.rotateX(Math.PI / 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
    depthWrite: false,
  });
  const wireBurst = new THREE.Mesh(wireGeo, wireMat);
  wireBurst.position.copy(mesh.position);
  wireBurst.rotation.y = mesh.rotation.y;
  wireBurst.scale.setScalar(0.1);
  scene.add(wireBurst);

  const startTime = performance.now();
  const duration = 350;

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const ease = t * (2 - t);

    const s = 0.1 + ease * 1.8;
    burst.scale.setScalar(s);
    wireBurst.scale.setScalar(s);
    mat.opacity = 0.85 * (1 - ease);
    wireMat.opacity = 0.5 * (1 - ease);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      scene.remove(burst);
      scene.remove(wireBurst);
      geo.dispose(); mat.dispose();
      wireGeo.dispose(); wireMat.dispose();
    }
  }
  requestAnimationFrame(step);
}

export function flashMeshColor(mesh, hexColor) {
  mesh.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive) {
      child.material.emissive.setHex(hexColor);
      setTimeout(() => {
        if (child.material && child.material.emissive) child.material.emissive.setHex(0);
      }, 150);
    }
  });
}

export function scaleDownAndRemove(mesh, callback) {
  const startTime = performance.now();
  const duration = 300;
  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const s = 1 - t;
    mesh.scale.set(s, s, s);
    if (t < 1) requestAnimationFrame(step);
    else if (callback) callback();
  }
  requestAnimationFrame(step);
}
