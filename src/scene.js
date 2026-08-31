import { GRID_SIZE, TILE_SIZE } from './config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a101f);
scene.fog = new THREE.FogExp2(0x0a101f, 0.004);

const aspect = window.innerWidth / window.innerHeight;
export const camera = new THREE.PerspectiveCamera(28, aspect, 1, 1000);

export const camTarget = new THREE.Vector3(
  ((GRID_SIZE - 1) * TILE_SIZE) / 2,
  0,
  ((GRID_SIZE - 1) * TILE_SIZE) / 2
);

export const camState = { radius: 45, theta: Math.PI / 4, phi: Math.PI / 3.8 };

export function updateCameraFromAngles() {
  camera.position.x = camTarget.x + camState.radius * Math.sin(camState.phi) * Math.cos(camState.theta);
  camera.position.y = camTarget.y + camState.radius * Math.cos(camState.phi);
  camera.position.z = camTarget.z + camState.radius * Math.sin(camState.phi) * Math.sin(camState.theta);
  camera.lookAt(camTarget.x, 0, camTarget.z);
}

export function resetCamera() {
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  camState.radius = isMobile ? 58 : 45;
  camState.theta = Math.PI / 4;
  camState.phi = Math.PI / 3.8;
  camTarget.set(
    ((GRID_SIZE - 1) * TILE_SIZE) / 2,
    0,
    ((GRID_SIZE - 1) * TILE_SIZE) / 2
  );
  updateCameraFromAngles();
}

resetCamera();

export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Low hemisphere — just enough to tint the ground bounce, not flood everything
const hemiLight = new THREE.HemisphereLight(0x888888, 0x333333, 0.9);
scene.add(hemiLight);

// Very low ambient — shadows must actually be dark for shape to read
const ambientLight = new THREE.AmbientLight(0x333333, 1.0);
scene.add(ambientLight);

// Key light from upper-LEFT of the camera view (camera sits in +X+Y+Z octant).
// Direction from board centre (7,0,7): (-18, 38, 8) → normalised ≈ (-0.42, 0.89, 0.19).
// Dot products for the three camera-visible faces:
//   +Y top  → 0.89  (bright)
//   +X right → -0.42 (shadow — filled by blue rim below)
//   +Z front → 0.19  (dim)
// Three clearly distinct values — cube reads in 3D.
const dirLight = new THREE.DirectionalLight(0xffffff, 2.6);
dirLight.position.set(-11, 38, 15);
dirLight.target.position.set(7, 0, 7);
scene.add(dirLight.target);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 130;
dirLight.shadow.camera.left = -22;
dirLight.shadow.camera.right = 22;
dirLight.shadow.camera.top = 22;
dirLight.shadow.camera.bottom = -22;
scene.add(dirLight);

// Blue fill from camera-right (+X side) — lifts the key-shadow face with faction colour
const blueRimLight = new THREE.DirectionalLight(0x0055ff, 0.25);
blueRimLight.position.set(28, 12, -8);
scene.add(blueRimLight);

// Red rim from enemy direction — wraps back faces of enemy units
const redRimLight = new THREE.DirectionalLight(0xff0033, 0.75);
redRimLight.position.set(-12, 10, -28);
scene.add(redRimLight);

const bgGridHelper = new THREE.GridHelper(140, 70, 0x0066ff, 0x162238);
bgGridHelper.position.set(camTarget.x, -0.2, camTarget.z);
scene.add(bgGridHelper);

export const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
