const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const healthValue = document.getElementById('healthValue');
const oxygenValue = document.getElementById('oxygenValue');
const staminaValue = document.getElementById('staminaValue');
const roomValue = document.getElementById('roomValue');
const objectiveValue = document.getElementById('objectiveValue');
const messageBox = document.getElementById('messageBox');

const TILE = 32;
const keys = {};
const roomOrder = ['100', '101', '200', '300', '400', 'final'];

const roomLayouts = {
  '100': [
    '##################',
    '#................#',
    '#......#.........#',
    '#......#.........#',
    '#................#',
    '#......#.........#',
    '#................#',
    '#......##........#',
    '#...............##',
    '#................#',
    '#................#',
    '##################'
  ],
  '101': [
    '##################',
    '#................#',
    '#....###.........#',
    '#................#',
    '#................#',
    '#......##........#',
    '#................#',
    '#......###.......#',
    '#................#',
    '#....##..........#',
    '#................#',
    '##################'
  ],
  '200': [
    '##################',
    '#................#',
    '#....###.........#',
    '#................#',
    '#.........##.....#',
    '#................#',
    '#....####........#',
    '#................#',
    '#........###.....#',
    '#................#',
    '#................#',
    '##################'
  ],
  '300': [
    '##################',
    '#................#',
    '#.....##.........#',
    '#................#',
    '#.......#........#',
    '#................#',
    '#.......##.......#',
    '#................#',
    '#......###.......#',
    '#................#',
    '#................#',
    '##################'
  ],
  '400': [
    '##################',
    '#................#',
    '#....##..........#',
    '#................#',
    '#......###.......#',
    '#................#',
    '#.....####.......#',
    '#................#',
    '#.........##.....#',
    '#................#',
    '#................#',
    '##################'
  ],
  'final': [
    '##################',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '##################'
  ]
};

const roomDefs = {
  '100': {
    name: 'Room 100',
    spawn: { x: 120, y: 420 },
    exit: { x: 820, y: 440, w: 30, h: 50 },
    lever: { x: 560, y: 260, r: 16 },
    objective: 'Find the lever',
    next: '101'
  },
  '101': {
    name: 'Room 101',
    spawn: { x: 110, y: 220 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    enemy: { x: 650, y: 280, r: 20, speed: 78 },
    objective: 'Escape the shadow',
    next: '200'
  },
  '200': {
    name: 'Room 200',
    spawn: { x: 110, y: 260 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    curtain: { x: 450, y: 210, r: 18 },
    objective: 'Touch the time curtain',
    next: '300'
  },
  '300': {
    name: 'Room 300',
    spawn: { x: 110, y: 310 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    eye: { x: 490, y: 250, r: 18 },
    objective: 'Press the glowing eye',
    next: '400'
  },
  '400': {
    name: 'Room 400',
    spawn: { x: 110, y: 300 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    books: { x: 470, y: 250, r: 18 },
    objective: 'Collect the memory code',
    next: 'final'
  },
  'final': {
    name: 'Final Chamber',
    spawn: { x: 160, y: 260 },
    exit: { x: 820, y: 430, w: 30, h: 50 },
    objective: 'Reforge the wormhole',
    next: null
  }
};

const state = {
  room: '100',
  health: 100,
  oxygen: 100,
  stamina: 100,
  memory: 0,
  crew: 5,
  inventory: [],
  canMove: true,
  progress: {
    '100': false,
    '101': false,
    '200': false,
    '300': false,
    '400': false,
    'final': false
  },
  player: {
    x: 120,
    y: 420,
    radius: 12,
    speed: 140,
    sprint: 220,
    dirX: 1,
    dirY: 0
  },
  enemy: null,
  lastMessage: '',
  finalCodeFound: false,
  flashTimer: 0,
  currentRoomDef: roomDefs['100'],
  roomTimer: 0
};

const roomText = {
  '100': 'Find the lever',
  '101': 'Escape the shadow',
  '200': 'Touch the time curtain',
  '300': 'Press the glowing eye',
  '400': 'Collect the memory code',
  'final': 'Reforge the wormhole'
};

function showMessage(text) {
  state.lastMessage = text;
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => messageBox.classList.add('hidden'), 1800);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isWall(x, y) {
  const room = roomLayouts[state.room];
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || ty >= room.length || tx >= room[0].length) return true;
  return room[ty][tx] === '#';
}

function movePlayer(dt) {
  if (!state.canMove) return;

  let moveX = 0;
  let moveY = 0;

  if (keys['w'] || keys['W']) moveY -= 1;
  if (keys['s'] || keys['S']) moveY += 1;
  if (keys['a'] || keys['A']) moveX -= 1;
  if (keys['d'] || keys['D']) moveX += 1;

  const magnitude = Math.hypot(moveX, moveY) || 1;
  if (moveX || moveY) {
    moveX /= magnitude;
    moveY /= magnitude;
  }

  const sprinting = keys['shift'] || keys['Shift'];
  const currentSpeed = sprinting ? state.player.sprint : state.player.speed;
  const nextX = state.player.x + moveX * currentSpeed * dt;
  const nextY = state.player.y + moveY * currentSpeed * dt;

  if (!isWall(nextX, state.player.y)) state.player.x = nextX;
  if (!isWall(state.player.x, nextY)) state.player.y = nextY;

  if (moveX || moveY) {
    state.player.dirX = moveX;
    state.player.dirY = moveY;
  }

  if (sprinting && (moveX || moveY)) {
    state.stamina = clamp(state.stamina - 18 * dt, 0, 100);
  } else {
    state.stamina = clamp(state.stamina + 12 * dt, 0, 100);
  }

  state.oxygen = clamp(state.oxygen - 0.75 * dt, 0, 100);
  if (state.oxygen <= 0) {
    state.health = clamp(state.health - 12 * dt, 0, 100);
  }

  if (state.health <= 0) {
    resetMission();
  }
}

function resetMission() {
  state.health = 100;
  state.oxygen = 100;
  state.stamina = 100;
  state.memory = 0;
  state.inventory = [];
  state.progress = {
    '100': false,
    '101': false,
    '200': false,
    '300': false,
    '400': false,
    'final': false
  };
  state.room = '100';
  loadRoom('100');
  showMessage('You were dragged back to the first room.');
}

function loadRoom(roomKey) {
  state.room = roomKey;
  const def = roomDefs[roomKey];
  state.currentRoomDef = def;
  state.roomTimer = 0;

  state.player.x = def.spawn.x;
  state.player.y = def.spawn.y;
  state.player.dirX = 1;
  state.player.dirY = 0;

  if (def.enemy) {
    state.enemy = { ...def.enemy };
  } else {
    state.enemy = null;
  }

  objectiveValue.textContent = roomText[roomKey];
  roomValue.textContent = def.name.replace('Room ', '').replace('Final Chamber', 'Final');
}

function updateEnemy(dt) {
  if (!state.enemy) return;

  const dx = state.player.x - state.enemy.x;
  const dy = state.player.y - state.enemy.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 180) {
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const nextX = state.enemy.x + nx * state.enemy.speed * dt;
    const nextY = state.enemy.y + ny * state.enemy.speed * dt;
    if (!isWall(nextX, state.enemy.y)) state.enemy.x = nextX;
    if (!isWall(state.enemy.x, nextY)) state.enemy.y = nextY;

    if (dist < state.player.radius + state.enemy.r + 4) {
      state.health = clamp(state.health - 22 * dt, 0, 100);
      if (state.health <= 0) resetMission();
    }
  }
}

function interact() {
  const def = state.currentRoomDef;

  if (state.room === '100') {
    const leverDist = Math.hypot(state.player.x - def.lever.x, state.player.y - def.lever.y);
    if (leverDist < 26) {
      state.progress['100'] = true;
      state.inventory.push('lever');
      showMessage('Lever pulled. The screeching fades.');
      return;
    }
  }

  if (state.room === '101') {
    const exitDist = Math.hypot(state.player.x - def.exit.x, state.player.y - def.exit.y);
    if (exitDist < 60 && state.progress['101']) {
      showMessage('Door unlocked. Moving deeper.');
      state.room = '200';
      loadRoom('200');
      return;
    }
  }

  if (state.room === '200') {
    const curtainDist = Math.hypot(state.player.x - def.curtain.x, state.player.y - def.curtain.y);
    if (curtainDist < 30) {
      state.progress['200'] = true;
      state.inventory.push('curtain shard');
      showMessage('You touched the time curtain.');
      return;
    }
  }

  if (state.room === '300') {
    const eyeDist = Math.hypot(state.player.x - def.eye.x, state.player.y - def.eye.y);
    if (eyeDist < 30) {
      state.progress['300'] = true;
      state.inventory.push('black eye key');
      showMessage('The eye opened a hidden door.');
      return;
    }
  }

  if (state.room === '400') {
    const booksDist = Math.hypot(state.player.x - def.books.x, state.player.y - def.books.y);
    if (booksDist < 30) {
      state.progress['400'] = true;
      state.inventory.push('worm code');
      state.finalCodeFound = true;
      showMessage('You found the memory code: WORM-9');
      return;
    }
  }

  if (state.room === 'final') {
    if (state.finalCodeFound) {
      showMessage('The wormhole is reassembled. You are alive.');
      state.progress['final'] = true;
      state.canMove = false;
      setTimeout(() => {
        // Restart after a moment for the ending feel.
        resetMission();
      }, 2600);
    } else {
      showMessage('The wormhole refuses to wake.');
    }
  }

  const exitDist = Math.hypot(state.player.x - def.exit.x, state.player.y - def.exit.y);
  if (exitDist < 60 && state.progress[state.room]) {
    const nextRoom = def.next;
    if (nextRoom) {
      state.room = nextRoom;
      loadRoom(nextRoom);
      showMessage('Exit opened. Moving on.');
    }
  }
}

function updateRoomState(dt) {
  const room = state.room;

  if (room === '100') {
    if (state.progress['100']) {
      objectiveValue.textContent = 'Leave the room';
    }
  }

  if (room === '101') {
    state.roomTimer += dt;
    if (state.roomTimer > 8) {
      state.progress['101'] = true;
      objectiveValue.textContent = 'Reach the exit';
    }
    if (state.enemy && state.roomTimer > 2 && Math.random() < 0.012) {
      showMessage('The shadow is closing in.');
    }
  }

  if (room === '200') {
    if (state.progress['200']) {
      objectiveValue.textContent = 'Reach the next exit';
    }
  }

  if (room === '300') {
    if (state.progress['300']) {
      objectiveValue.textContent = 'Reach the next exit';
    }
  }

  if (room === '400') {
    if (state.progress['400']) {
      objectiveValue.textContent = 'Go to the final chamber';
    }
  }

  if (room === 'final') {
    objectiveValue.textContent = 'Reforge the wormhole';
  }
}

function drawFloor() {
  const room = roomLayouts[state.room];
  const cols = room[0].length;
  const rows = room.length;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0d1a25' : '#0a1520';
      ctx.fillRect(px, py, TILE, TILE);
    }
  }

  ctx.strokeStyle = 'rgba(127,233,255,0.1)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(canvas.width, y * TILE);
    ctx.stroke();
  }
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, canvas.height);
    ctx.stroke();
  }
}

function drawWalls() {
  const room = roomLayouts[state.room];
  ctx.fillStyle = '#1d2d3a';
  for (let y = 0; y < room.length; y++) {
    for (let x = 0; x < room[y].length; x++) {
      if (room[y][x] === '#') {
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
}

function drawExit() {
  const def = state.currentRoomDef;
  const { x, y, w, h } = def.exit;
  const active = state.progress[state.room] || state.room === 'final';
  ctx.fillStyle = active ? '#66ffb0' : '#4d5d6a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = active ? '#b7ffe6' : '#7e91a0';
  ctx.strokeRect(x, y, w, h);
}

function drawObject(x, y, color, label) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dff8ff';
  ctx.font = '12px Segoe UI';
  ctx.fillText(label, x + 18, y - 12);
}

function drawRoomObjects() {
  const def = state.currentRoomDef;

  if (state.room === '100' && !state.progress['100']) {
    drawObject(def.lever.x, def.lever.y, '#ffd166', 'lever');
  }

  if (state.room === '101') {
    if (state.enemy) {
      ctx.beginPath();
      ctx.fillStyle = '#ff5d73';
      ctx.arc(state.enemy.x, state.enemy.y, state.enemy.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (state.room === '200' && !state.progress['200']) {
    drawObject(def.curtain.x, def.curtain.y, '#c084fc', 'curtain');
  }

  if (state.room === '300' && !state.progress['300']) {
    drawObject(def.eye.x, def.eye.y, '#7fe9ff', 'eye');
  }

  if (state.room === '400' && !state.progress['400']) {
    drawObject(def.books.x, def.books.y, '#d0d8ff', 'books');
  }
}

function drawPlayer() {
  const { x, y, radius } = state.player;
  ctx.beginPath();
  ctx.fillStyle = '#7fe9ff';
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  const dirX = state.player.dirX || 1;
  const dirY = state.player.dirY || 0;
  ctx.beginPath();
  ctx.strokeStyle = '#dffaff';
  ctx.lineWidth = 2;
  ctx.moveTo(x, y);
  ctx.lineTo(x + dirX * 18, y + dirY * 18);
  ctx.stroke();
}

function drawHud() {
  healthValue.textContent = Math.round(state.health);
  oxygenValue.textContent = Math.round(state.oxygen);
  staminaValue.textContent = Math.round(state.stamina);
  roomValue.textContent = state.room;
  objectiveValue.textContent = roomText[state.room];
}

function update(dt) {
  movePlayer(dt);
  updateEnemy(dt);
  updateRoomState(dt);
  drawHud();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFloor();
  drawWalls();
  drawRoomObjects();
  drawExit();
  drawPlayer();
}

let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.032);
  lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  keys[event.key] = true;
  if (event.key === 'e' || event.key === 'E') interact();
});

window.addEventListener('keyup', (event) => {
  keys[event.key] = false;
});

loadRoom('100');
showMessage('You are the mission specialist. Walk with WASD and press E to interact.');
requestAnimationFrame(gameLoop);
