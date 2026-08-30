import { rng } from './rng.js';

export const Materials = {
  tileBase: new THREE.MeshStandardMaterial({
    color: 0x181520,
    roughness: 0.85,
    metalness: 0.05
  }),
  tileChasm: new THREE.MeshBasicMaterial({ color: 0x020407 }),
  tileBorder: new THREE.LineBasicMaterial({
    color: 0x00ccff,
    linewidth: 2,
    transparent: true,
    opacity: 0.7
  }),

  mountain: new THREE.MeshStandardMaterial({
    color: 0x181520,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true
  }),
  mountainEdge: new THREE.LineBasicMaterial({
    color: 0x00ccff,
    transparent: true,
    opacity: 0.55
  }),
  mountainGlow: new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true }),

  coreGreen: new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00aa55,
    emissiveIntensity: 0.32,
    roughness: 0.25,
    metalness: 0.3,
    flatShading: false
  }),
  coreDamagedFaceted: new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff66,
    emissiveIntensity: 1.1,
    roughness: 0.2,
    metalness: 0.5,
    flatShading: true
  }),
  coreDamagedWire: new THREE.MeshBasicMaterial({
    color: 0xffe600,
    wireframe: true
  }),

  playerBlue: new THREE.MeshStandardMaterial({
    color: 0x0066ff,
    emissive: 0x0033aa,
    emissiveIntensity: 0.65,
    roughness: 0.7,
    metalness: 0.15
  }),

  enemyRed: new THREE.MeshStandardMaterial({
    color: 0xff0033,
    emissive: 0xb7001a,
    emissiveIntensity: 0.75,
    roughness: 0.7,
    metalness: 0.15
  }),

  spawnerRing: new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true })
};

export function createQuantumCoreMesh() {
  const group = new THREE.Group();

  const dodecaGeo = new THREE.DodecahedronGeometry(0.75, 0);
  dodecaGeo.computeVertexNormals();

  const dodeca = new THREE.Mesh(dodecaGeo, Materials.coreGreen.clone());
  dodeca.position.y = 0.95;
  dodeca.castShadow = true;
  group.add(dodeca);

  const wire = new THREE.Mesh(dodecaGeo, Materials.coreDamagedWire);
  wire.position.copy(dodeca.position);
  wire.scale.set(1.04, 1.04, 1.04);
  wire.visible = false;
  group.add(wire);

  group.userData.dodecahedron = dodeca;
  group.userData.wire = wire;
  return group;
}

function positionHash(wx, wz) {
  return Math.abs((Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453) % 1);
}

function dirFalloff(n, adjNeg, adjPos) {
  if (adjNeg && adjPos) return 1.0;
  if (adjNeg) return Math.max(0, 1 - Math.max(0, n));
  if (adjPos) return Math.max(0, 1 - Math.max(0, -n));
  return Math.max(0, 1 - Math.abs(n));
}

// cellInfos: [{wx, wz}] world positions. Bakes positions into geometry; mesh sits at (0,0,0).
export function createMountainMesh(cellInfos, heightScale = 1.0) {
  const TS = 2.0;
  const segs = 8;
  const half = TS / 2;
  const posSet = new Set(cellInfos.map(c => `${c.wx},${c.wz}`));

  const geoList = [];
  for (const { wx, wz } of cellInfos) {
    const adjLeft  = posSet.has(`${wx - TS},${wz}`);
    const adjRight = posSet.has(`${wx + TS},${wz}`);
    const adjFront = posSet.has(`${wx},${wz - TS}`);
    const adjBack  = posSet.has(`${wx},${wz + TS}`);

    const geo = new THREE.PlaneGeometry(TS, TS, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const falloff = dirFalloff(lx / half, adjLeft, adjRight) *
                      dirFalloff(lz / half, adjFront, adjBack);
      pos.setY(i, falloff * heightScale * (1.2 + positionHash(wx + lx, wz + lz) * 0.8));
      pos.setX(i, lx + wx);
      pos.setZ(i, lz + wz);
    }
    geoList.push(geo);
  }

  let vCount = 0, iCount = 0;
  for (const g of geoList) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const positions = new Float32Array(vCount * 3);
  const indices = new Uint32Array(iCount);
  let vOff = 0, iOff = 0;
  for (const g of geoList) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      positions[(vOff + i) * 3]     = p.getX(i);
      positions[(vOff + i) * 3 + 1] = p.getY(i);
      positions[(vOff + i) * 3 + 2] = p.getZ(i);
    }
    const idx = g.index;
    for (let i = 0; i < idx.count; i++) indices[iOff + i] = idx.getX(i) + vOff;
    vOff += p.count;
    iOff += idx.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();

  const mesh = new THREE.Mesh(merged, Materials.mountain);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(merged, 15);
  const lines = new THREE.LineSegments(edges, Materials.mountainEdge);

  const group = new THREE.Group();
  group.add(mesh);
  group.add(lines);
  return group;
}

export function createRubbleMesh(wx, wz) {
  const TS = 2.0;
  const verts = [];
  for (let i = 0; i < 4; i++) {
    const cx = wx + (rng.random() - 0.5) * TS * 0.8;
    const cz = wz + (rng.random() - 0.5) * TS * 0.8;
    const r = 0.15 + rng.random() * 0.25;
    const ang = rng.random() * Math.PI * 2;
    for (let j = 0; j < 3; j++) {
      const a = ang + j * (Math.PI * 2 / 3);
      verts.push(cx + Math.cos(a) * r, rng.random() * 0.06, cz + Math.sin(a) * r);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, Materials.mountain);
}

export function createStrikerMesh() {
  const group = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const cube = new THREE.Mesh(cubeGeo, Materials.playerBlue);
  cube.position.y = 0.43;
  cube.castShadow = true;
  group.add(cube);
  return group;
}

export function createArtilleryMesh() {
  const group = new THREE.Group();

  const baseGeo = new THREE.BoxGeometry(0.8, 0.58, 0.8);
  const base = new THREE.Mesh(baseGeo, Materials.playerBlue);
  base.position.y = 0.29;
  base.castShadow = true;
  group.add(base);

  const postGeo = new THREE.BoxGeometry(0.22, 0.31, 0.22);
  const offsets = [
    [-0.29, -0.29], [0.29, -0.29],
    [-0.29, 0.29], [0.29, 0.29]
  ];
  offsets.forEach(([cx, cz]) => {
    const post = new THREE.Mesh(postGeo, Materials.playerBlue);
    post.position.set(cx, 0.71, cz);
    post.castShadow = true;
    group.add(post);
  });

  return group;
}

export function createLaserTankMesh() {
  const group = new THREE.Group();

  // Isosceles tetrahedron: ground face is a long isosceles triangle (apex forward = fire dir).
  // The short back edge rises into a near-vertical fin, slightly leaning toward the barycenter.
  // v0: front apex on ground (pointing toward enemy after π rotation)
  // v1: back-left on ground   } short edge — the "thin side" of the isosceles triangle
  // v2: back-right on ground  }
  // v3: top of back fin — nearly perpendicular above v1-v2, tilted ~11° toward barycenter
  const verts = new Float32Array([
     0.00, 0.00,  0.84,   // v0 front apex (ground)
    -0.39, 0.00, -0.71,   // v1 back-left (ground)
     0.39, 0.00, -0.71,   // v2 back-right (ground)
     0.00, 0.99, -0.52,   // v3 top fin (above back edge, leaning forward ~11°)
  ]);

  // Face winding CCW from outside for correct outward normals
  const idx = new Uint16Array([
    0, 1, 2,  // bottom (ground, normal -Y)
    0, 3, 1,  // left sweep face
    0, 2, 3,  // right sweep face
    1, 3, 2,  // back fin face (near-vertical)
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  const mat = Materials.playerBlue.clone();
  mat.flatShading = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  group.add(mesh);

  return group;
}

export function createScarabMesh() {
  const group = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.75, 1.2, 4);
  geo.rotateX(Math.PI / 2);
  geo.center();

  const wedge = new THREE.Mesh(geo, Materials.enemyRed);
  wedge.position.y = 0.45;
  wedge.castShadow = true;
  group.add(wedge);

  return group;
}

export function createHornetMesh() {
  const group = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.6, 0);

  const diamond = new THREE.Mesh(geo, Materials.enemyRed);
  diamond.position.y = 1.0;
  diamond.castShadow = true;
  group.add(diamond);

  group.userData.diamond = diamond;
  return group;
}

export function createSpitterMesh() {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.6, 0.5, 0.35, 6);

  const puck = new THREE.Mesh(geo, Materials.enemyRed);
  puck.position.y = 0.35;
  puck.castShadow = true;
  group.add(puck);

  return group;
}

export function createUnitMeshByType(typeId) {
  switch (typeId) {
    case 'STRIKER':   return createStrikerMesh();
    case 'ARTILLERY': return createArtilleryMesh();
    case 'RAILGUN':   return createLaserTankMesh();
    case 'TANK':      return createScarabMesh();
    case 'FLIER':     return createHornetMesh();
    case 'MORTAR':    return createSpitterMesh();
    default:          return createStrikerMesh();
  }
}
