import { rng } from './rng.js';

export const Materials = {
  tileBase: new THREE.MeshStandardMaterial({
    color: 0x0e0b1a,
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
    color: 0x24334f,
    roughness: 0.5,
    metalness: 0.6,
    flatShading: true
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
    roughness: 0.25,
    metalness: 0.6
  }),

  enemyRed: new THREE.MeshStandardMaterial({
    color: 0xff0033,
    emissive: 0xb7001a,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.6
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

export function createMountainMesh() {
  const group = new THREE.Group();
  const count = 3 + Math.floor(rng.random() * 2);
  for (let i = 0; i < count; i++) {
    const height = 1.3 + rng.random() * 0.9;
    const radius = 0.4 + rng.random() * 0.2;
    const geo = new THREE.ConeGeometry(radius, height, 5);
    const mesh = new THREE.Mesh(geo, Materials.mountain);
    mesh.position.set(
      (rng.random() - 0.5) * 0.5,
      height / 2,
      (rng.random() - 0.5) * 0.5
    );
    mesh.rotation.y = rng.random() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const wire = new THREE.Mesh(geo, Materials.mountainGlow);
    wire.position.copy(mesh.position);
    wire.rotation.copy(mesh.rotation);
    wire.scale.set(1.02, 1.02, 1.02);
    group.add(wire);
  }
  return group;
}

export function createStrikerMesh() {
  const group = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const cube = new THREE.Mesh(cubeGeo, Materials.playerBlue);
  cube.position.y = 0.55;
  cube.castShadow = true;
  group.add(cube);
  return group;
}

export function createArtilleryMesh() {
  const group = new THREE.Group();

  const baseGeo = new THREE.BoxGeometry(1.05, 0.75, 1.05);
  const base = new THREE.Mesh(baseGeo, Materials.playerBlue);
  base.position.y = 0.38;
  base.castShadow = true;
  group.add(base);

  const postGeo = new THREE.BoxGeometry(0.28, 0.4, 0.28);
  const offsets = [
    [-0.38, -0.38], [0.38, -0.38],
    [-0.38, 0.38], [0.38, 0.38]
  ];
  offsets.forEach(([cx, cz]) => {
    const post = new THREE.Mesh(postGeo, Materials.playerBlue);
    post.position.set(cx, 0.92, cz);
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
     0.00, 0.00,  0.85,   // v0 front apex (ground)
    -0.35, 0.00, -0.55,   // v1 back-left (ground)
     0.35, 0.00, -0.55,   // v2 back-right (ground)
     0.00, 0.90, -0.38,   // v3 top fin (above back edge, leaning forward ~11°)
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
  geo.scale(0.85, 1.25, 0.85);

  const diamond = new THREE.Mesh(geo, Materials.enemyRed);
  diamond.position.y = 1.0;
  diamond.castShadow = true;
  group.add(diamond);

  group.userData.diamond = diamond;
  return group;
}

export function createSpitterMesh() {
  const group = new THREE.Group();

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.4, 6), Materials.enemyRed);
  bottom.position.y = 0.2;
  bottom.castShadow = true;
  group.add(bottom);

  const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), Materials.enemyRed);
  top.position.y = 0.75;
  top.castShadow = true;
  group.add(top);

  return group;
}

export function createUnitMeshByType(typeId) {
  switch (typeId) {
    case 'STRIKER':   return createStrikerMesh();
    case 'ARTILLERY': return createArtilleryMesh();
    case 'LASER':     return createLaserTankMesh();
    case 'SCARAB':    return createScarabMesh();
    case 'HORNET':    return createHornetMesh();
    case 'SPITTER':   return createSpitterMesh();
    default:          return createStrikerMesh();
  }
}
