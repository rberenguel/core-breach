import { gridToWorld } from './state.js';

export function moveUnitMeshSmooth(unit, destGx, destGz, onComplete) {
  const destWorld = gridToWorld(destGx, destGz);
  const startX = unit.mesh.position.x;
  const startZ = unit.mesh.position.z;
  const startTime = performance.now();
  const duration = 220;

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const ease = t * (2 - t);

    unit.mesh.position.x = startX + (destWorld.x - startX) * ease;
    unit.mesh.position.z = startZ + (destWorld.z - startZ) * ease;
    unit.mesh.position.y = Math.sin(t * Math.PI) * 0.4;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      unit.mesh.position.x = destWorld.x;
      unit.mesh.position.z = destWorld.z;
      unit.mesh.position.y = 0;
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

export function animatePunchMesh(mesh) {
  const fwd = new THREE.Vector3(0, 0, 0.4).applyEuler(mesh.rotation);
  mesh.position.add(fwd);
  setTimeout(() => {
    mesh.position.sub(fwd);
  }, 120);
}

export function flashMeshColor(mesh, hexColor) {
  mesh.traverse(child => {
    if (child.isMesh && child.material) {
      const orig = child.material.emissive ? child.material.emissive.getHex() : 0;
      if (child.material.emissive) child.material.emissive.setHex(hexColor);
      setTimeout(() => {
        if (child.material && child.material.emissive) child.material.emissive.setHex(orig);
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
