import { GRID_SIZE, TILE_SIZE } from './config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a101f);
scene.fog = new THREE.FogExp2(0x0a101f, 0.015);

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
  camState.radius = 45;
  camState.theta = Math.PI / 4;
  camState.phi = Math.PI / 3.8;
  camera.position.set(camTarget.x + 28, 32, camTarget.z + 28);
  camera.lookAt(camTarget.x, 0, camTarget.z);
}

resetCamera();

export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0x8bc34a, 0x1a237e, 1.8);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0x405075, 1.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(22, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 5;
dirLight.shadow.camera.far = 90;
dirLight.shadow.camera.left = -16;
dirLight.shadow.camera.right = 16;
dirLight.shadow.camera.top = 16;
dirLight.shadow.camera.bottom = -16;
scene.add(dirLight);

const blueRimLight = new THREE.DirectionalLight(0x0066ff, 1.5);
blueRimLight.position.set(-20, 24, -20);
scene.add(blueRimLight);

const redRimLight = new THREE.DirectionalLight(0xff0033, 1.2);
redRimLight.position.set(20, 15, -20);
scene.add(redRimLight);

const bgGridHelper = new THREE.GridHelper(140, 70, 0x0066ff, 0x162238);
bgGridHelper.position.set(camTarget.x, -0.2, camTarget.z);
scene.add(bgGridHelper);

export const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
