import * as THREE from './vendor/three.module.js';

/* ================================================================== */
/* DOM                                                                 */
/* ================================================================== */

const canvas = document.getElementById('gameCanvas');
const healthValue = document.getElementById('healthValue');
const oxygenValue = document.getElementById('oxygenValue');
const staminaValue = document.getElementById('staminaValue');
const roomValue = document.getElementById('roomValue');
const objectiveValue = document.getElementById('objectiveValue');
const healthBar = document.getElementById('healthBar');
const oxygenBar = document.getElementById('oxygenBar');
const staminaBar = document.getElementById('staminaBar');
const hudEl = document.querySelector('.hud');
const messageBox = document.getElementById('messageBox');
const promptEl = document.getElementById('prompt');
const promptText = document.getElementById('promptText');
const flashEl = document.getElementById('flash');
const lockOverlay = document.getElementById('lockOverlay');

/* ================================================================== */
/* World constants (layout is authored in pixels, rendered in units)   */
/* ================================================================== */

const U = 0.0625;            // 1 layout px -> world units
const TILE_PX = 32;
const TILE = TILE_PX * U;    // 2 units per tile
const WALL_H = 3.2;
const EYE = 1.62;
const RADIUS = 0.55;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.6;

const roomOrder = ['100', '101', '200', '300', '400', 'final'];

function makeRoom(cols, rows, blocks) {
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const line = [];
    for (let x = 0; x < cols; x++) {
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      line.push(border ? '#' : '.');
    }
    grid.push(line);
  }
  for (const [bx, by, bw, bh] of blocks) {
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (y > 0 && y < rows - 1 && x > 0 && x < cols - 1) grid[y][x] = '#';
      }
    }
  }
  return grid.map((row) => row.join(''));
}

const roomLayouts = {
  '100': makeRoom(30, 17, [
    [5, 2, 3, 2], [22, 2, 3, 2],
    [13, 4, 4, 2],
    [5, 10, 3, 2], [22, 10, 3, 2],
    [11, 14, 2, 2], [17, 14, 2, 2]
  ]),
  '101': makeRoom(30, 17, [
    [6, 3, 3, 1], [13, 2, 2, 2],
    [19, 4, 3, 2], [9, 8, 2, 2],
    [16, 11, 2, 2], [22, 13, 3, 1]
  ]),
  '200': makeRoom(30, 17, [
    [8, 2, 3, 2], [15, 3, 2, 2],
    [20, 6, 3, 2], [6, 10, 2, 2],
    [12, 12, 3, 2], [21, 11, 3, 2]
  ]),
  '300': makeRoom(30, 17, [
    [7, 4, 2, 3], [14, 2, 3, 2],
    [21, 5, 2, 3], [9, 11, 2, 2],
    [17, 12, 3, 2], [23, 9, 2, 2]
  ]),
  '400': makeRoom(30, 17, [
    [6, 3, 2, 2], [12, 2, 3, 2],
    [19, 4, 2, 3], [7, 9, 3, 2],
    [16, 10, 2, 2], [22, 8, 3, 2]
  ]),
  'final': makeRoom(30, 17, [])
};

const roomDefs = {
  '100': {
    name: 'Room 100',
    spawn: { x: 120, y: 420 },
    exit: { x: 820, y: 440, w: 30, h: 50 },
    lever: { x: 560, y: 260 },
    next: '101'
  },
  '101': {
    name: 'Room 101',
    spawn: { x: 110, y: 220 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    enemy: { x: 650, y: 280, speed: 78 },
    next: '200'
  },
  '200': {
    name: 'Room 200',
    spawn: { x: 110, y: 260 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    curtain: { x: 450, y: 210 },
    next: '300'
  },
  '300': {
    name: 'Room 300',
    spawn: { x: 110, y: 310 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    eye: { x: 490, y: 250 },
    next: '400'
  },
  '400': {
    name: 'Room 400',
    spawn: { x: 110, y: 300 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    books: { x: 470, y: 250 },
    next: 'final'
  },
  'final': {
    name: 'Final Chamber',
    spawn: { x: 160, y: 260 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    next: null
  }
};

const roomText = {
  '100': 'Find the lever',
  '101': 'Escape the shadow',
  '200': 'Touch the time curtain',
  '300': 'Press the glowing eye',
  '400': 'Collect the memory code',
  'final': 'Reforge the wormhole'
};

const WORMHOLE = { x: 300 * U, z: 190 * U };

/* ================================================================== */
/* State                                                               */
/* ================================================================== */

const state = {
  room: '100',
  health: 100,
  oxygen: 100,
  stamina: 100,
  inventory: [],
  canMove: true,
  memory: 0,
  progress: { '100': false, '101': false, '200': false, '300': false, '400': false, 'final': false },
  player: { x: 0, z: 0, yaw: 0, pitch: 0 },
  moving: false,
  sprinting: false,
  enemy: null,
  roomTimer: 0,
  finalCodeFound: false
};

const fx = { shake: 0, flash: 0, flashColor: '255, 93, 115' };
const playerAnim = { phase: 0, stepTimer: 0 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/* ================================================================== */
/* Renderer / scene                                                    */
/* ================================================================== */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03070d);
scene.fog = new THREE.FogExp2(0x04090f, 0.05);

const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.AmbientLight(0x4f8299, 1.25));
const hemi = new THREE.HemisphereLight(0x8ee6ff, 0x0a1a22, 0.85);
scene.add(hemi);

/* Flashlight + helmet glow, both parented to the camera. */
const torch = new THREE.SpotLight(0xd6f4ff, 260, 30, Math.PI / 6.2, 0.5, 1.4);
torch.position.set(0.22, -0.16, -0.05);
torch.target.position.set(0.06, -0.06, -3);
camera.add(torch);
camera.add(torch.target);

const helmetGlow = new THREE.PointLight(0x61dcff, 14, 12, 2);
helmetGlow.position.set(0, 0.05, -0.2);
camera.add(helmetGlow);

function resize() {
  const w = Math.max(320, canvas.clientWidth);
  const h = Math.max(240, canvas.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ================================================================== */
/* Procedural textures                                                 */
/* ================================================================== */

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function createFloorTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const g = c.getContext('2d');

  g.fillStyle = '#0a1721';
  g.fillRect(0, 0, size, size);

  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(38, 90, 112, 0.55)');
  grad.addColorStop(1, 'rgba(10, 26, 36, 0.4)');
  g.fillStyle = grad;
  g.fillRect(6, 6, size - 12, size - 12);

  g.strokeStyle = 'rgba(127, 233, 255, 0.5)';
  g.lineWidth = 3;
  g.strokeRect(4, 4, size - 8, size - 8);

  g.strokeStyle = 'rgba(127, 233, 255, 0.14)';
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo((size / 4) * i, 10); g.lineTo((size / 4) * i, size - 10); g.stroke();
    g.beginPath(); g.moveTo(10, (size / 4) * i); g.lineTo(size - 10, (size / 4) * i); g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createWallTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#255263');
  grad.addColorStop(0.4, '#16313d');
  grad.addColorStop(1, '#0a1720');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // glowing crown strip at the top edge
  g.fillStyle = '#9ff2ff';
  g.fillRect(0, 0, size, 9);
  const glow = g.createLinearGradient(0, 9, 0, 56);
  glow.addColorStop(0, 'rgba(127, 233, 255, 0.55)');
  glow.addColorStop(1, 'rgba(127, 233, 255, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 9, size, 47);

  g.strokeStyle = 'rgba(127, 233, 255, 0.22)';
  g.lineWidth = 3;
  g.strokeRect(12, 62, size - 24, size - 78);

  g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(size / 2, 62); g.lineTo(size / 2, size - 16); g.stroke();

  g.fillStyle = 'rgba(200, 248, 255, 0.55)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(24 + i * ((size - 48) / 3), size - 28, 2.4, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createCeilingTexture() {
  const size = 128;
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#0a161d';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(127, 233, 255, 0.22)';
  g.lineWidth = 2;
  g.strokeRect(6, 6, size - 12, size - 12);
  g.fillStyle = 'rgba(127, 233, 255, 0.35)';
  g.fillRect(size / 2 - 10, size / 2 - 2, 20, 4);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowSprite(color, size = 1.6, opacity = 0.85) {
  const c = makeCanvas(128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

/* ================================================================== */
/* Room construction                                                   */
/* ================================================================== */

let roomGroup = null;
const props = { lever: null, curtain: null, eye: null, books: null, portal: null, wormhole: null, enemy: null };
const animated = [];

function clearRoom() {
  animated.length = 0;
  props.lever = props.curtain = props.eye = props.books = props.portal = props.wormhole = props.enemy = null;
  if (!roomGroup) return;
  scene.remove(roomGroup);
  roomGroup.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
  roomGroup = null;
}

function addTick(object, fn) {
  object.userData.tick = fn;
  animated.push(object);
  return object;
}

function buildPortal(def) {
  const group = new THREE.Group();
  const w = def.exit.w * U;
  const d = def.exit.h * U;
  group.position.set((def.exit.x + def.exit.w / 2) * U, 0, (def.exit.y + def.exit.h / 2) * U);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x66ffb0,
    emissive: 0x66ffb0,
    emissiveIntensity: 1.5,
    metalness: 0.4,
    roughness: 0.3
  });

  const postGeo = new THREE.BoxGeometry(0.09, 2, 0.09);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(side * (w / 2 - 0.05), 1, 0);
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.09), frameMat);
  lintel.position.set(0, 2, 0);
  group.add(lintel);

  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x66ffb0,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.9), panelMat);
  panel.position.set(0, 0.95, 0);
  group.add(panel);

  const glow = makeGlowSprite(0x66ffb0, 1.4, 0.5);
  glow.position.set(0, 1.1, 0);
  group.add(glow);

  const light = new THREE.PointLight(0x66ffb0, 6, 9, 2);
  light.position.set(0, 1.2, 0);
  group.add(light);

  addTick(group, (t) => {
    const active = Boolean(state.progress[state.room]);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    frameMat.emissiveIntensity = active ? 1.4 + pulse * 1.6 : 0.15;
    frameMat.color.setHex(active ? 0x66ffb0 : 0x37474f);
    panelMat.opacity = active ? 0.12 + pulse * 0.16 : 0.03;
    light.intensity = active ? 4 + pulse * 6 : 0.4;
    glow.material.opacity = active ? 0.35 + pulse * 0.35 : 0.08;
  });

  return group;
}

function buildLever(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.6, 0.18, 20),
    new THREE.MeshStandardMaterial({ color: 0x26424f, metalness: 0.85, roughness: 0.3 })
  );
  base.position.y = 0.09;
  group.add(base);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.95, 14),
    new THREE.MeshStandardMaterial({ color: 0x2f5364, metalness: 0.9, roughness: 0.25 })
  );
  column.position.y = 0.58;
  group.add(column);

  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xf8d77f,
    emissive: 0xf8d77f,
    emissiveIntensity: 1.8,
    metalness: 0.6,
    roughness: 0.25
  });
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.46, 6, 12), handleMat);
  handle.position.set(0, 1.12, 0);
  handle.rotation.z = -0.45;
  group.add(handle);

  const glow = makeGlowSprite(0xf8d77f, 1.9, 0.75);
  glow.position.set(0, 1.1, 0);
  group.add(glow);

  const light = new THREE.PointLight(0xffcf6b, 8, 8, 2);
  light.position.set(0, 1.25, 0);
  group.add(light);

  addTick(group, (t) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    handle.rotation.z = -0.45 + Math.sin(t * 1.6) * 0.12;
    handleMat.emissiveIntensity = 1.4 + pulse * 1.2;
    glow.scale.setScalar(1.7 + pulse * 0.5);
    light.intensity = 5 + pulse * 5;
  });

  return group;
}

function buildCurtain(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const geo = new THREE.PlaneGeometry(2.4, 2.5, 18, 18);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xa76cff,
    emissive: 0x6a2bd0,
    emissiveIntensity: 1.3,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.25
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 1.35;
  group.add(mesh);

  const base = Float32Array.from(geo.attributes.position.array);

  const glow = makeGlowSprite(0xa76cff, 2.6, 0.5);
  glow.position.set(0, 1.35, 0);
  group.add(glow);

  const light = new THREE.PointLight(0xa76cff, 8, 10, 2);
  light.position.set(0, 1.4, 0.4);
  group.add(light);

  addTick(group, (t) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = base[i * 3];
      const py = base[i * 3 + 1];
      pos.setZ(i, Math.sin(px * 2 + t * 2.4) * 0.16 + Math.cos(py * 1.7 + t * 1.8) * 0.09);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    glow.scale.setScalar(2.3 + Math.sin(t * 2) * 0.3);
  });

  return group;
}

function buildEye(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xdffcff,
    emissive: 0x7fe9ff,
    emissiveIntensity: 2,
    roughness: 0.2,
    metalness: 0.3
  });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), eyeMat);
  eye.position.y = 1.5;
  group.add(eye);

  const irisMat = new THREE.MeshBasicMaterial({ color: 0x0a2a35 });
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), irisMat);
  iris.position.set(0, 1.5, 0.28);
  group.add(iris);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.85 });
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.16, 0.014, 8, 64), ringMat);
    ring.position.y = 1.5;
    group.add(ring);
    rings.push(ring);
  }

  const glow = makeGlowSprite(0x7fe9ff, 2.4, 0.7);
  glow.position.y = 1.5;
  group.add(glow);

  const light = new THREE.PointLight(0x7fe9ff, 9, 11, 2);
  light.position.y = 1.6;
  group.add(light);

  addTick(group, (t) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.4);
    eye.scale.setScalar(1 + pulse * 0.08);
    eyeMat.emissiveIntensity = 1.6 + pulse * 1.6;
    rings.forEach((ring, i) => {
      ring.rotation.x = t * (0.7 + i * 0.35);
      ring.rotation.y = t * (0.5 + i * 0.22);
      ring.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.05);
    });
    glow.scale.setScalar(2.1 + pulse * 0.6);
    light.intensity = 6 + pulse * 7;
  });

  return group;
}

function buildBooks(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x21323d, metalness: 0.7, roughness: 0.4 });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.9), shelfMat);
  shelf.position.y = 0.9;
  group.add(shelf);

  const bookMats = [0xd0d8ff, 0x7fe9ff, 0xa76cff].map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 1.1,
        roughness: 0.35,
        metalness: 0.2
      })
  );

  const books = [];
  for (let i = 0; i < 3; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.5), bookMats[i]);
    book.position.set(-0.45 + i * 0.45, 1.3, 0);
    book.rotation.y = i * 0.35;
    group.add(book);
    books.push(book);
  }

  const glow = makeGlowSprite(0xd0d8ff, 2.2, 0.6);
  glow.position.y = 1.35;
  group.add(glow);

  const light = new THREE.PointLight(0xc9d6ff, 7, 9, 2);
  light.position.y = 1.5;
  group.add(light);

  addTick(group, (t) => {
    books.forEach((book, i) => {
      book.rotation.y = t * 0.8 + i * 1.2;
      book.position.y = 1.3 + Math.sin(t * 2 + i) * 0.06;
    });
    glow.scale.setScalar(2 + Math.sin(t * 2.2) * 0.4);
  });

  return group;
}

function buildWormhole() {
  const group = new THREE.Group();
  group.position.set(WORMHOLE.x, 1.5, WORMHOLE.z);

  const rings = [];
  for (let i = 0; i < 5; i++) {
    const color = i % 2 === 0 ? 0x7fe9ff : 0xa76cff;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6 + i * 0.28, 0.05 - i * 0.006, 10, 72), mat);
    ring.rotation.x = rand(0, Math.PI);
    group.add(ring);
    rings.push(ring);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xcfefff,
    emissiveIntensity: 3,
    roughness: 0.1
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), coreMat);
  group.add(core);

  const glow = makeGlowSprite(0xcfefff, 4.4, 0.85);
  group.add(glow);

  const light = new THREE.PointLight(0xa76cff, 16, 22, 2);
  group.add(light);

  addTick(group, (t) => {
    rings.forEach((ring, i) => {
      ring.rotation.z += 0.01 * (i + 1);
      ring.rotation.y += 0.006 * (i + 1);
      ring.material.opacity = 0.45 + Math.sin(t * 3 + i) * 0.3;
    });
    core.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
    glow.scale.setScalar(4.2 + Math.sin(t * 2) * 0.6);
    light.intensity = 12 + Math.sin(t * 3) * 8;
  });

  return group;
}

function buildEnemy(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 1.2, z);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x14030a,
    emissive: 0x5c0012,
    emissiveIntensity: 1.4,
    roughness: 0.55
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 18), bodyMat);
  group.add(body);

  const tendrilMat = new THREE.MeshStandardMaterial({
    color: 0x2a0510,
    emissive: 0xff2a4d,
    emissiveIntensity: 1.1,
    roughness: 0.7
  });
  const tendrils = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 8), tendrilMat);
    tendril.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0);
    tendril.rotation.z = angle - Math.PI / 2;
    group.add(tendril);
    tendrils.push(tendril);
  }

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2f2 })
  );
  eye.position.set(0, 0, 0.68);
  group.add(eye);

  const glow = makeGlowSprite(0xff2a4d, 3.2, 0.7);
  group.add(glow);

  const light = new THREE.PointLight(0xff2a4d, 10, 14, 2);
  group.add(light);

  addTick(group, (t) => {
    tendrils.forEach((tendril, i) => {
      const wobble = Math.sin(t * 4 + i) * 0.22;
      tendril.scale.set(1, 0.8 + wobble * 0.5, 1);
      tendril.rotation.z = (i / 8) * Math.PI * 2 - Math.PI / 2 + wobble * 0.5;
    });
    body.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    glow.scale.setScalar(3 + Math.sin(t * 4) * 0.5);
    light.intensity = 8 + Math.sin(t * 6) * 5;
  });

  return group;
}

function buildRoom(key) {
  clearRoom();

  const layout = roomLayouts[key];
  const rows = layout.length;
  const cols = layout[0].length;
  const width = cols * TILE;
  const depth = rows * TILE;

  roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const floorTex = createFloorTexture();
  floorTex.repeat.set(cols, rows);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x6f97ab, roughness: 0.7, metalness: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(width / 2, 0, depth / 2);
  roomGroup.add(floor);

  const ceilTex = createCeilingTexture();
  ceilTex.repeat.set(cols / 2, rows / 2);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: ceilTex, color: 0x2b4655, roughness: 1, metalness: 0.1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(width / 2, WALL_H, depth / 2);
  roomGroup.add(ceiling);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (layout[r][c] === '#') cells.push([c, r]);
    }
  }

  const wallTex = createWallTexture();
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: 0x6d94a8,
    roughness: 0.68,
    metalness: 0.3,
    emissive: 0x07202c,
    emissiveIntensity: 0.7
  });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, WALL_H, TILE), wallMat, cells.length);
  const mtx = new THREE.Matrix4();
  cells.forEach(([c, r], i) => {
    mtx.makeTranslation(c * TILE + TILE / 2, WALL_H / 2, r * TILE + TILE / 2);
    walls.setMatrixAt(i, mtx);
  });
  walls.instanceMatrix.needsUpdate = true;
  roomGroup.add(walls);

  const stripMat = new THREE.MeshBasicMaterial({ color: 0x9ff2ff });
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 0.06, TILE), stripMat, cells.length);
  cells.forEach(([c, r], i) => {
    mtx.makeTranslation(c * TILE + TILE / 2, WALL_H - 0.03, r * TILE + TILE / 2);
    strips.setMatrixAt(i, mtx);
  });
  strips.instanceMatrix.needsUpdate = true;
  roomGroup.add(strips);

  const roomLight = new THREE.PointLight(0x5fc9ff, 170, 60, 2);
  roomLight.position.set(width / 2, WALL_H - 0.45, depth / 2);
  roomGroup.add(roomLight);

  const fill = new THREE.PointLight(0x2a6b8a, 70, 50, 2);
  fill.position.set(width * 0.2, 1.7, depth * 0.78);
  roomGroup.add(fill);

  const def = roomDefs[key];

  if (def.lever) {
    props.lever = buildLever(def.lever.x * U, def.lever.y * U);
    roomGroup.add(props.lever);
  }
  if (def.curtain) {
    props.curtain = buildCurtain(def.curtain.x * U, def.curtain.y * U);
    roomGroup.add(props.curtain);
  }
  if (def.eye) {
    props.eye = buildEye(def.eye.x * U, def.eye.y * U);
    roomGroup.add(props.eye);
  }
  if (def.books) {
    props.books = buildBooks(def.books.x * U, def.books.y * U);
    roomGroup.add(props.books);
  }
  if (def.enemy) {
    props.enemy = buildEnemy(def.enemy.x * U, def.enemy.y * U);
    roomGroup.add(props.enemy);
  }
  if (key === 'final') {
    props.wormhole = buildWormhole();
    roomGroup.add(props.wormhole);
  }

  if (def.exit) {
    props.portal = buildPortal(def);
    roomGroup.add(props.portal);
  }

  resize();
}

/* ================================================================== */
/* First-person body (you are inside the suit)                          */
/* ================================================================== */

function buildHands() {
  const group = new THREE.Group();

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1b3b4c,
    roughness: 0.6,
    metalness: 0.4,
    emissive: 0x082330,
    emissiveIntensity: 0.7
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x7fe9ff,
    emissive: 0x7fe9ff,
    emissiveIntensity: 1.6
  });

  // Right arm holding the torch
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 10), gloveMat);
  armR.position.set(0.3, -0.42, -0.42);
  armR.rotation.set(-1.15, 0.16, -0.28);
  group.add(armR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.24), gloveMat);
  handR.position.set(0.3, -0.3, -0.72);
  handR.rotation.set(-0.25, -0.22, 0);
  group.add(handR);

  const torchBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.34, 14),
    new THREE.MeshStandardMaterial({ color: 0x2b3a44, metalness: 0.85, roughness: 0.25 })
  );
  torchBody.rotation.x = Math.PI / 2;
  torchBody.position.set(0.3, -0.29, -0.92);
  group.add(torchBody);

  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 18), trimMat);
  lens.position.set(0.3, -0.29, -1.09);
  group.add(lens);

  const lensGlow = makeGlowSprite(0xc7f4ff, 0.3, 0.5);
  lensGlow.position.copy(lens.position);
  group.add(lensGlow);

  // Left arm
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 4, 10), gloveMat);
  armL.position.set(-0.3, -0.44, -0.34);
  armL.rotation.set(-1.05, -0.14, 0.3);
  group.add(armL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), gloveMat);
  handL.position.set(-0.26, -0.32, -0.62);
  handL.rotation.set(-0.2, 0.25, 0);
  group.add(handL);

  // Wrist accent
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20), trimMat);
  cuff.position.set(0.3, -0.33, -0.6);
  cuff.rotation.x = Math.PI / 2;
  group.add(cuff);

  group.userData.lensGlow = lensGlow;
  return group;
}

function buildLegs() {
  const group = new THREE.Group();
  const trouser = new THREE.MeshStandardMaterial({ color: 0x17303f, roughness: 0.75, metalness: 0.2 });
  const boot = new THREE.MeshStandardMaterial({
    color: 0x0d1f29,
    emissive: 0x2a7f9e,
    emissiveIntensity: 1.3,
    roughness: 0.5,
    metalness: 0.4
  });

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.34, 4, 10), trouser);
    thigh.position.y = -0.24;
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 10), trouser);
    shin.position.y = -0.62;
    leg.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.34), boot);
    foot.position.set(0, -0.86, -0.08);
    leg.add(foot);

    leg.position.set(side * 0.17, 0.92, 0.02);
    group.add(leg);
    legs.push(leg);
  }

  group.userData.legs = legs;
  return group;
}

const hands = buildHands();
hands.scale.setScalar(0.82);
hands.position.set(0, -0.03, -0.1);
camera.add(hands);

/* The body lives in world space so you can look down at your own legs. */
const bodyGroup = new THREE.Group();
scene.add(bodyGroup);
const legRig = buildLegs();
const legParts = legRig.userData.legs;
bodyGroup.add(legRig);

/* ================================================================== */
/* Particles                                                           */
/* ================================================================== */

const MAX_PARTICLES = 700;
const pPositions = new Float32Array(MAX_PARTICLES * 3);
const pColors = new Float32Array(MAX_PARTICLES * 3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
pGeo.setDrawRange(0, 0);

const pPoints = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
pPoints.frustumCulled = false;
scene.add(pPoints);

const particles = [];

function spawnBurst(x, y, z, color, count = 24, speed = 4.5) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.15, 1), rand(-1, 1)).normalize();
    const v = speed * rand(0.35, 1);
    particles.push({
      x, y, z,
      vx: dir.x * v,
      vy: dir.y * v,
      vz: dir.z * v,
      life: rand(0.45, 0.95),
      maxLife: 0.95,
      color: c
    });
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  fx.shake = Math.max(fx.shake, 1.2);
  triggerFlash(color, 0.28);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy -= 4 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.y < 0.06) {
      p.y = 0.06;
      p.vy *= -0.32;
    }
    p.vx *= 0.97;
    p.vz *= 0.97;
  }

  let n = 0;
  for (let i = 0; i < particles.length && n < MAX_PARTICLES; i++, n++) {
    const p = particles[i];
    pPositions[n * 3] = p.x;
    pPositions[n * 3 + 1] = p.y;
    pPositions[n * 3 + 2] = p.z;
    const fade = clamp(p.life / p.maxLife, 0, 1);
    pColors[n * 3] = p.color.r * fade;
    pColors[n * 3 + 1] = p.color.g * fade;
    pColors[n * 3 + 2] = p.color.b * fade;
  }

  pGeo.setDrawRange(0, n);
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

/* Floating dust inside the room. */
const DUST_COUNT = 220;
const dustPositions = new Float32Array(DUST_COUNT * 3);
for (let i = 0; i < DUST_COUNT; i++) {
  dustPositions[i * 3] = rand(1, 58);
  dustPositions[i * 3 + 1] = rand(0.2, WALL_H);
  dustPositions[i * 3 + 2] = rand(1, 32);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    color: 0x8fe6ff,
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
dust.frustumCulled = false;
scene.add(dust);

function updateDust(t, dt) {
  const arr = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST_COUNT; i++) {
    arr[i * 3 + 1] += dt * 0.16;
    if (arr[i * 3 + 1] > WALL_H) arr[i * 3 + 1] = 0.15;
    arr[i * 3] += Math.sin(t + i) * dt * 0.06;
  }
  dustGeo.attributes.position.needsUpdate = true;
}

/* ================================================================== */
/* Input                                                               */
/* ================================================================== */

const keys = Object.create(null);
let pointerLocked = false;

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (key === 'e') interact();
  if (['w', 'a', 's', 'd', ' '].includes(key)) event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

function requestLook() {
  if (canvas.requestPointerLock) canvas.requestPointerLock();
}

canvas.addEventListener('click', requestLook);
lockOverlay.addEventListener('click', requestLook);

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  lockOverlay.classList.toggle('hidden', pointerLocked);
  canvas.style.cursor = pointerLocked ? 'none' : 'crosshair';
});

document.addEventListener('mousemove', (event) => {
  if (!pointerLocked) return;
  state.player.yaw -= event.movementX * 0.0022;
  state.player.pitch = clamp(state.player.pitch - event.movementY * 0.0022, -1.25, 1.25);
});

/* ================================================================== */
/* Collision                                                           */
/* ================================================================== */

function tileBlockedAt(x, z, radius) {
  const layout = roomLayouts[state.room];
  const samples = [
    [radius, 0], [-radius, 0], [0, radius], [0, -radius],
    [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius]
  ];
  for (const [ox, oz] of samples) {
    const col = Math.floor((x + ox) / TILE);
    const row = Math.floor((z + oz) / TILE);
    if (row < 0 || row >= layout.length || col < 0 || col >= layout[0].length) return true;
    if (layout[row][col] === '#') return true;
  }
  return false;
}

function blocked(x, z) {
  return tileBlockedAt(x, z, RADIUS);
}

/* ================================================================== */
/* Game flow                                                           */
/* ================================================================== */

function showMessage(text) {
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => messageBox.classList.add('hidden'), 2200);
}

function triggerFlash(cssColor, strength = 0.35) {
  flashEl.style.background = `rgba(${cssColor}, 0.6)`;
  flashEl.style.opacity = String(strength);
  clearTimeout(triggerFlash.timer);
  triggerFlash.timer = setTimeout(() => {
    flashEl.style.opacity = '0';
  }, 90);
}

function loadRoom(key) {
  state.room = key;
  state.roomTimer = 0;

  buildRoom(key);

  const def = roomDefs[key];
  const layout = roomLayouts[key];
  const p = state.player;

  p.x = def.spawn.x * U;
  p.z = def.spawn.y * U;
  p.pitch = 0;

  const centerX = (layout[0].length * TILE) / 2;
  const centerZ = (layout.length * TILE) / 2;
  p.yaw = Math.atan2(-(centerX - p.x), -(centerZ - p.z));

  state.enemy = def.enemy
    ? { x: def.enemy.x * U, z: def.enemy.y * U, speed: def.enemy.speed * U }
    : null;

  objectiveValue.textContent = roomText[key];
  roomValue.textContent = def.name.replace('Room ', '').replace('Final Chamber', 'Final');

  triggerFlash('127, 233, 255', 0.3);
  spawnBurst(p.x, 1.1, p.z, 0x7fe9ff, 22, 3.4);
}

function resetMission() {
  state.health = 100;
  state.oxygen = 100;
  state.stamina = 100;
  state.inventory = [];
  state.progress = { '100': false, '101': false, '200': false, '300': false, '400': false, 'final': false };
  state.finalCodeFound = false;
  state.canMove = true;
  loadRoom('100');
  showMessage('You were dragged back to the first room.');
}

function findTarget() {
  const def = roomDefs[state.room];
  if (!def) return null;

  const p = state.player;
  const list = [];

  if (state.room === '100' && !state.progress['100']) {
    list.push({ type: 'lever', x: def.lever.x * U, z: def.lever.y * U, r: 2.2, label: 'PULL LEVER' });
  }
  if (state.room === '200' && !state.progress['200']) {
    list.push({ type: 'curtain', x: def.curtain.x * U, z: def.curtain.y * U, r: 2.4, label: 'TOUCH CURTAIN' });
  }
  if (state.room === '300' && !state.progress['300']) {
    list.push({ type: 'eye', x: def.eye.x * U, z: def.eye.y * U, r: 2.4, label: 'PRESS THE EYE' });
  }
  if (state.room === '400' && !state.progress['400']) {
    list.push({ type: 'books', x: def.books.x * U, z: def.books.y * U, r: 2.4, label: 'TAKE THE CODE' });
  }
  if (state.room === 'final') {
    list.push({ type: 'wormhole', x: WORMHOLE.x, z: WORMHOLE.z, r: 3, label: 'REFORGE WORMHOLE' });
  }
  if (def.next) {
    const active = Boolean(state.progress[state.room]);
    list.push({
      type: 'exit',
      x: (def.exit.x + def.exit.w / 2) * U,
      z: (def.exit.y + def.exit.h / 2) * U,
      r: 3,
      label: active ? 'LEAVE ROOM' : 'LOCKED'
    });
  }

  let best = null;
  for (const target of list) {
    const d = Math.hypot(p.x - target.x, p.z - target.z);
    if (d <= target.r && (!best || d < best.d)) best = { ...target, d };
  }
  return best;
}

function interact() {
  if (!state.canMove) return;
  const target = findTarget();
  if (!target) return;

  if (target.type === 'lever') {
    state.progress['100'] = true;
    state.inventory.push('lever');
    spawnBurst(target.x, 1.3, target.z, 0xf8d77f, 40, 5);
    showMessage('Lever pulled. The screeching fades.');
    return;
  }

  if (target.type === 'curtain') {
    state.progress['200'] = true;
    state.inventory.push('curtain shard');
    spawnBurst(target.x, 1.4, target.z, 0xa76cff, 40, 5);
    showMessage('You touched the time curtain.');
    return;
  }

  if (target.type === 'eye') {
    state.progress['300'] = true;
    state.inventory.push('black eye key');
    spawnBurst(target.x, 1.5, target.z, 0x7fe9ff, 40, 5);
    showMessage('The eye opened a hidden door.');
    return;
  }

  if (target.type === 'books') {
    state.progress['400'] = true;
    state.inventory.push('worm code');
    state.finalCodeFound = true;
    spawnBurst(target.x, 1.4, target.z, 0xd0d8ff, 40, 5);
    showMessage('You found the memory code: WORM-9');
    return;
  }

  if (target.type === 'wormhole') {
    if (!state.finalCodeFound) {
      showMessage('The wormhole refuses to wake.');
      return;
    }
    state.progress['final'] = true;
    state.canMove = false;
    spawnBurst(WORMHOLE.x, 1.6, WORMHOLE.z, 0xcfefff, 120, 8);
    triggerFlash('223, 248, 255', 0.75);
    fx.shake = 4;
    showMessage('The wormhole is reassembled. You are alive.');
    setTimeout(resetMission, 3200);
    return;
  }

  if (target.type === 'exit') {
    if (target.label === 'LOCKED') {
      showMessage('The exit is sealed. Finish the objective first.');
      return;
    }
    const def = roomDefs[state.room];
    if (def.next) {
      spawnBurst(target.x, 1.2, target.z, 0x66ffb0, 30, 4);
      loadRoom(def.next);
      showMessage('Exit opened. Moving on.');
    }
  }
}

/* ================================================================== */
/* Update                                                              */
/* ================================================================== */

function updatePlayer(dt) {
  const p = state.player;

  let forward = 0;
  let strafe = 0;
  if (state.canMove) {
    if (keys['w'] || keys['arrowup']) forward += 1;
    if (keys['s'] || keys['arrowdown']) forward -= 1;
    if (keys['d'] || keys['arrowright']) strafe += 1;
    if (keys['a'] || keys['arrowleft']) strafe -= 1;
  }

  const sprinting = Boolean((keys['shift']) && (forward || strafe));
  const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;

  const magnitude = Math.hypot(forward, strafe) || 1;
  const f = forward / magnitude;
  const s = strafe / magnitude;

  const yaw = p.yaw;
  const moveX = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * dt;
  const moveZ = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed * dt;

  if (!blocked(p.x + moveX, p.z)) p.x += moveX;
  if (!blocked(p.x, p.z + moveZ)) p.z += moveZ;

  state.moving = Boolean(forward || strafe);
  state.sprinting = sprinting && state.moving;

  if (state.moving) {
    playerAnim.phase += dt * (sprinting ? 13.5 : 9);
    playerAnim.stepTimer -= dt * (sprinting ? 1.8 : 1);
    if (playerAnim.stepTimer <= 0) {
      playerAnim.stepTimer = 0.32;
      spawnBurst(p.x, 0.12, p.z, sprinting ? 0xa76cff : 0x7fe9ff, 6, 1.6);
    }
  }

  if (sprinting) {
    state.stamina = clamp(state.stamina - 18 * dt, 0, 100);
  } else {
    state.stamina = clamp(state.stamina + 12 * dt, 0, 100);
  }

  state.oxygen = clamp(state.oxygen - 0.7 * dt, 0, 100);
  if (state.oxygen <= 0) {
    state.health = clamp(state.health - 12 * dt, 0, 100);
    if (Math.random() < 0.08) triggerFlash('255, 93, 115', 0.25);
  }

  if (state.health <= 0) resetMission();
}

function updateEnemy(dt, t) {
  const e = state.enemy;
  const mesh = props.enemy;
  if (!e || !mesh) return;

  const p = state.player;
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 17 && dist > 0.001) {
    const nx = dx / dist;
    const nz = dz / dist;
    const targetX = e.x + nx * e.speed * dt;
    const targetZ = e.z + nz * e.speed * dt;
    if (!tileBlockedAt(targetX, e.z, 0.7)) e.x = targetX;
    if (!tileBlockedAt(e.x, targetZ, 0.7)) e.z = targetZ;
  }

  mesh.position.set(e.x, 1.15 + Math.sin(t * 2.4) * 0.09, e.z);
  mesh.lookAt(p.x, mesh.position.y, p.z);

  if (dist < 1.35) {
    state.health = clamp(state.health - 22 * dt, 0, 100);
    fx.shake = Math.max(fx.shake, 2.4);
    if (Math.random() < 0.12) triggerFlash('255, 93, 115', 0.4);
    if (Math.random() < 0.25) spawnBurst(p.x, 1.2, p.z, 0xff2a4d, 4, 2);
    if (state.health <= 0) resetMission();
  }
}

function updateRoomState(dt) {
  if (state.room === '101') {
    state.roomTimer += dt;
    if (state.roomTimer > 8 && !state.progress['101']) {
      state.progress['101'] = true;
      objectiveValue.textContent = 'Reach the exit';
      showMessage('The exit unseals. Run!');
    }
  }
}

function updateCamera(t, dt) {
  const p = state.player;
  const bob = state.moving
    ? Math.sin(playerAnim.phase * 2) * (state.sprinting ? 0.075 : 0.05)
    : Math.sin(t * 1.6) * 0.012;
  const sway = state.moving ? Math.sin(playerAnim.phase) * (state.sprinting ? 0.05 : 0.03) : 0;

  camera.position.set(p.x, EYE + bob, p.z);

  if (fx.shake > 0.001) {
    camera.position.x += rand(-fx.shake, fx.shake) * 0.05;
    camera.position.y += rand(-fx.shake, fx.shake) * 0.05;
    camera.position.z += rand(-fx.shake, fx.shake) * 0.05;
  }

  camera.rotation.x = p.pitch;
  camera.rotation.y = p.yaw;
  camera.rotation.z = sway * 0.45;

  // Sprint widens the view for a speed rush.
  const targetFov = state.sprinting ? 82 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();
  }

  // Hands sway with the stride.
  hands.position.set(sway * 0.05, Math.sin(playerAnim.phase * 2) * 0.014, 0);
  hands.rotation.z = sway * 0.1;

  // Body follows the player on the ground plane (yaw only) so the legs swing below you.
  bodyGroup.position.set(p.x - Math.sin(p.yaw) * 0.3, 0, p.z - Math.cos(p.yaw) * 0.3);
  bodyGroup.rotation.y = p.yaw;

  const swing = state.moving ? Math.sin(playerAnim.phase) * (state.sprinting ? 0.95 : 0.6) : 0;
  if (legParts) {
    legParts[0].rotation.x = swing;
    legParts[1].rotation.x = -swing;
  }
}

function updateHud() {
  healthValue.textContent = Math.round(state.health);
  oxygenValue.textContent = Math.round(state.oxygen);
  staminaValue.textContent = Math.round(state.stamina);
  roomValue.textContent = state.room === 'final' ? 'Final' : state.room;
  objectiveValue.textContent = roomText[state.room];

  healthBar.style.width = `${clamp(state.health, 0, 100)}%`;
  oxygenBar.style.width = `${clamp(state.oxygen, 0, 100)}%`;
  staminaBar.style.width = `${clamp(state.stamina, 0, 100)}%`;

  hudEl.classList.toggle('danger', state.health < 35);

  const target = findTarget();
  if (target) {
    promptText.textContent = target.label;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }
}

let elapsed = 0;

function update(dt, t) {
  updatePlayer(dt);
  updateEnemy(dt, t);
  updateRoomState(dt);
  updateParticles(dt);
  updateDust(t, dt);

  for (const object of animated) {
    if (object.userData.tick) object.userData.tick(t, dt);
  }

  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt * 4.5);

  updateCamera(t, dt);
  updateHud();
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.05);
  lastTime = now;
  elapsed += dt;
  update(dt, elapsed);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ================================================================== */
/* Boot                                                                */
/* ================================================================== */

resize();
loadRoom('100');
showMessage('You are inside the suit. Walk with WASD, look with the mouse.');
requestAnimationFrame(frame);

/* Handy for debugging from the console. */
window.__game = { state, scene, camera, renderer, loadRoom, props, spawnBurst, bodyGroup, hands };
