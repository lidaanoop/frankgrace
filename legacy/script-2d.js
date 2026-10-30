const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const healthValue = document.getElementById('healthValue');
const oxygenValue = document.getElementById('oxygenValue');
const staminaValue = document.getElementById('staminaValue');
const roomValue = document.getElementById('roomValue');
const objectiveValue = document.getElementById('objectiveValue');
const messageBox = document.getElementById('messageBox');
const hudEl = document.querySelector('.hud');
const healthBar = document.getElementById('healthBar');
const oxygenBar = document.getElementById('oxygenBar');
const staminaBar = document.getElementById('staminaBar');

/* Visual state: screen shake, colour flash, particles and walk cycle. */
const fx = { shake: 0, flash: 0, flashColor: '255, 93, 115' };
const particles = [];
const motes = [];
const playerAnim = { phase: 0, stepTimer: 0, trailTimer: 0 };
let elapsed = 0;

const TILE = 32;
const keys = {};
const roomOrder = ['100', '101', '200', '300', '400', 'final'];

/* Build a 30 x 17 tile room: solid border plus interior wall blocks. */
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
        if (y > 0 && y < rows - 1 && x > 0 && x < cols - 1) {
          grid[y][x] = '#';
        }
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
  moving: false,
  sprinting: false,
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

  const moving = Boolean(moveX || moveY);
  state.moving = moving;
  state.sprinting = sprinting && moving;

  // Advance the walk cycle and kick up footstep sparks.
  if (moving) {
    playerAnim.phase += dt * (sprinting ? 17 : 11);
    playerAnim.stepTimer -= dt * (sprinting ? 1.7 : 1);
    if (playerAnim.stepTimer <= 0) {
      playerAnim.stepTimer = 0.24;
      spawnParticles(
        state.player.x - state.player.dirX * 8 + rand(-4, 4),
        state.player.y - state.player.dirY * 8 + rand(-4, 4),
        sprinting ? 6 : 3,
        {
          color: sprinting ? '167, 108, 255' : '127, 233, 255',
          speed: 46,
          life: 0.5,
          size: 2.6,
          gravity: 24
        }
      );
    }
  }

  if (sprinting && moving) {
    state.stamina = clamp(state.stamina - 18 * dt, 0, 100);
  } else {
    state.stamina = clamp(state.stamina + 12 * dt, 0, 100);
  }

  // Sprint afterimage
  if (state.sprinting) {
    playerAnim.trailTimer -= dt;
    if (playerAnim.trailTimer <= 0) {
      playerAnim.trailTimer = 0.05;
      spawnParticles(state.player.x, state.player.y, 1, {
        color: '167, 108, 255',
        speed: 10,
        life: 0.34,
        size: 7
      });
    }
  }

  state.oxygen = clamp(state.oxygen - 0.75 * dt, 0, 100);
  if (state.oxygen <= 0) {
    state.health = clamp(state.health - 12 * dt, 0, 100);
    fx.flash = Math.max(fx.flash, 0.2);
    fx.flashColor = '255, 93, 115';
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

  fx.flash = 0.6;
  fx.flashColor = '127, 233, 255';
  spawnParticles(def.spawn.x, def.spawn.y, 22, {
    color: '127, 233, 255',
    speed: 150,
    life: 0.7,
    size: 3.4
  });
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
      fx.flash = Math.max(fx.flash, 0.45);
      fx.flashColor = '255, 93, 115';
      fx.shake = Math.max(fx.shake, 4);
      if (Math.random() < 0.4) {
        spawnParticles(state.player.x, state.player.y, 4, {
          color: '255, 93, 115',
          speed: 120,
          life: 0.4,
          size: 3
        });
      }
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
      burst(def.lever.x, def.lever.y, '248, 215, 127', 26);
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
      burst(def.curtain.x, def.curtain.y, '167, 108, 255', 30);
      showMessage('You touched the time curtain.');
      return;
    }
  }

  if (state.room === '300') {
    const eyeDist = Math.hypot(state.player.x - def.eye.x, state.player.y - def.eye.y);
    if (eyeDist < 30) {
      state.progress['300'] = true;
      state.inventory.push('black eye key');
      burst(def.eye.x, def.eye.y, '127, 233, 255', 28);
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
      burst(def.books.x, def.books.y, '223, 248, 255', 30);
      showMessage('You found the memory code: WORM-9');
      return;
    }
  }

  if (state.room === 'final') {
    if (state.finalCodeFound) {
      showMessage('The wormhole is reassembled. You are alive.');
      state.progress['final'] = true;
      state.canMove = false;
      fx.flash = 1;
      fx.flashColor = '223, 248, 255';
      fx.shake = 8;
      burst(300, 190, '167, 108, 255', 60);
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
      burst(def.exit.x + def.exit.w / 2, def.exit.y + def.exit.h / 2, '102, 255, 176', 28);
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

/* ------------------------------------------------------------------ */
/* FX: particles, ambient motes, helpers                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  cyan: '127, 233, 255',
  purple: '167, 108, 255',
  gold: '248, 215, 127',
  green: '102, 255, 176',
  red: '255, 93, 115',
  white: '223, 248, 255'
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnParticles(x, y, count, options = {}) {
  const {
    color = PALETTE.cyan,
    speed = 90,
    life = 0.6,
    size = 3,
    gravity = 0,
    spread = Math.PI * 2,
    angle = 0
  } = options;

  for (let i = 0; i < count; i++) {
    const a = angle + rand(-spread / 2, spread / 2);
    const v = rand(speed * 0.35, speed);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life,
      maxLife: life,
      size: rand(size * 0.5, size),
      color,
      gravity
    });
  }
}

function burst(x, y, color = PALETTE.cyan, count = 22) {
  spawnParticles(x, y, count, { color, speed: 200, life: 0.75, size: 4 });
  fx.shake = Math.max(fx.shake, 5);
  fx.flash = Math.max(fx.flash, 0.18);
  fx.flashColor = color;
}

function initMotes() {
  motes.length = 0;
  for (let i = 0; i < 70; i++) {
    motes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: rand(0.6, 2.1),
      sp: rand(8, 28),
      drift: rand(-10, 10),
      a: rand(0.12, 0.45)
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
  }
}

function updateMotes(dt) {
  for (const m of motes) {
    m.y -= m.sp * dt;
    m.x += Math.sin((elapsed + m.y) * 0.02) * m.drift * dt;
    if (m.y < -4) {
      m.y = canvas.height + 4;
      m.x = Math.random() * canvas.width;
    }
    if (m.x < -4) m.x = canvas.width + 4;
    if (m.x > canvas.width + 4) m.x = -4;
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = `rgba(${p.color},${a * 0.95})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMotes() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of motes) {
    ctx.fillStyle = `rgba(${PALETTE.cyan},${m.a})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roomHasWall(room, x, y) {
  if (y < 0 || y >= room.length || x < 0 || x >= room[0].length) return true;
  return room[y][x] === '#';
}

/* ------------------------------------------------------------------ */
/* Drawing: floor, walls, props, character, lighting                   */
/* ------------------------------------------------------------------ */

function drawFloor(t) {
  const room = roomLayouts[state.room];
  const cols = room[0].length;
  const rows = room.length;
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (room[y][x] === '#') continue;
      const px = x * TILE;
      const py = y * TILE;
      const light = (x + y) % 2 === 0 ? 1 : 0.68;
      const r = Math.round(6 + 6 * light);
      const g = Math.round(16 + 13 * light);
      const b = Math.round(26 + 18 * light);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(px, py, TILE, TILE);

      if ((x * 7 + y * 13) % 11 === 0) {
        ctx.fillStyle = `rgba(127, 233, 255, ${0.05 + pulse * 0.08})`;
        ctx.fillRect(px + TILE / 2 - 3, py + TILE / 2 - 3, 6, 6);
      }
    }
  }

  ctx.strokeStyle = `rgba(127, 233, 255, ${0.08 + pulse * 0.05})`;
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

  // Slow energy band rolling across the floor.
  const bandY = (t * 110) % (canvas.height + 160) - 80;
  const band = ctx.createLinearGradient(0, bandY - 90, 0, bandY);
  band.addColorStop(0, 'rgba(127, 233, 255, 0)');
  band.addColorStop(1, 'rgba(127, 233, 255, 0.07)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - 90, canvas.width, 90);
}

function drawWalls(t) {
  const room = roomLayouts[state.room];
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);

  for (let y = 0; y < room.length; y++) {
    for (let x = 0; x < room[y].length; x++) {
      if (room[y][x] !== '#') continue;
      const px = x * TILE;
      const py = y * TILE;

      const wall = ctx.createLinearGradient(px, py, px, py + TILE);
      wall.addColorStop(0, '#25404f');
      wall.addColorStop(0.55, '#16232f');
      wall.addColorStop(1, '#0d1823');
      ctx.fillStyle = wall;
      ctx.fillRect(px, py, TILE, TILE);

      ctx.fillStyle = 'rgba(127, 233, 255, 0.18)';
      ctx.fillRect(px + TILE / 2 - 1.5, py + TILE / 2 - 1.5, 3, 3);

      const edges = [
        !roomHasWall(room, x, y - 1) && [px, py, px + TILE, py],
        !roomHasWall(room, x, y + 1) && [px, py + TILE, px + TILE, py + TILE],
        !roomHasWall(room, x - 1, y) && [px, py, px, py + TILE],
        !roomHasWall(room, x + 1, y) && [px + TILE, py, px + TILE, py + TILE]
      ];

      ctx.save();
      ctx.strokeStyle = `rgba(127, 233, 255, ${0.22 + pulse * 0.35})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(127, 233, 255, 0.9)';
      ctx.shadowBlur = 12;
      for (const edge of edges) {
        if (!edge) continue;
        ctx.beginPath();
        ctx.moveTo(edge[0], edge[1]);
        ctx.lineTo(edge[2], edge[3]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawExit(t) {
  const def = state.currentRoomDef;
  const { x, y, w, h } = def.exit;
  const active = state.progress[state.room] || state.room === 'final';
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);

  ctx.save();
  if (active) {
    ctx.shadowColor = 'rgba(102, 255, 176, 0.95)';
    ctx.shadowBlur = 18 + pulse * 16;
    ctx.fillStyle = `rgba(102, 255, 176, ${0.35 + pulse * 0.3})`;
  } else {
    ctx.fillStyle = 'rgba(77, 93, 106, 0.65)';
  }
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.strokeStyle = active
    ? `rgba(183, 255, 230, ${0.5 + pulse * 0.45})`
    : 'rgba(126, 145, 160, 0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (h / 4) * i);
    ctx.lineTo(x + w, y + (h / 4) * i);
    ctx.stroke();
  }
  ctx.strokeRect(x, y, w, h);

  if (active) {
    const bob = Math.sin(t * 5) * 3;
    ctx.fillStyle = 'rgba(223, 255, 240, 0.95)';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 8 + bob, y + h / 2 - 7);
    ctx.lineTo(x + w / 2 - 8 + bob, y + h / 2 + 7);
    ctx.lineTo(x + w / 2 + 2 + bob, y + h / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBeacon(x, y, rgb, label, t, shape = 'orb') {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + x * 0.01);

  // Soft halo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, 2, x, y, 46 + pulse * 12);
  halo.addColorStop(0, `rgba(${rgb}, 0.5)`);
  halo.addColorStop(0.45, `rgba(${rgb}, 0.14)`);
  halo.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 46 + pulse * 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rotating dashed ring
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 1.3);
  ctx.strokeStyle = `rgba(${rgb}, ${0.45 + pulse * 0.45})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 23, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Glowing core
  const size = 11 + pulse * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = `rgba(${rgb}, 0.95)`;
  ctx.shadowBlur = 16 + pulse * 14;
  ctx.fillStyle = `rgba(${rgb}, ${0.85 + pulse * 0.15})`;
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, size, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  drawLabel(x, y - 34, label);
}

function drawWormhole(x, y, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const r = 26 + i * 16 + Math.sin(t * 2 + i) * 4;
    ctx.strokeStyle = `rgba(${i % 2 ? PALETTE.purple : PALETTE.cyan}, ${0.5 - i * 0.09})`;
    ctx.lineWidth = 3 - i * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, t * (1 + i * 0.4), t * (1 + i * 0.4) + Math.PI * 1.4);
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(x, y, 2, x, y, 44);
  core.addColorStop(0, 'rgba(223, 248, 255, 0.9)');
  core.addColorStop(0.4, 'rgba(127, 233, 255, 0.32)');
  core.addColorStop(1, 'rgba(167, 108, 255, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(t) {
  const e = state.enemy;
  if (!e) return;

  const wobble = Math.sin(t * 6) * 3;
  const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r * 3);
  halo.addColorStop(0, 'rgba(255, 60, 90, 0.5)');
  halo.addColorStop(1, 'rgba(255, 60, 90, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 93, 115, 0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.9;
    const len = e.r + 10 + Math.sin(t * 5 + i) * 7;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(a) * e.r * 0.7, e.y + Math.sin(a) * e.r * 0.7);
    ctx.quadraticCurveTo(
      e.x + Math.cos(a + 0.4) * len,
      e.y + Math.sin(a + 0.4) * len,
      e.x + Math.cos(a) * (len + 6),
      e.y + Math.sin(a) * (len + 6)
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  const body = ctx.createRadialGradient(e.x - wobble, e.y - wobble, 2, e.x, e.y, e.r);
  body.addColorStop(0, '#2b0a12');
  body.addColorStop(1, '#080105');
  ctx.fillStyle = body;
  ctx.shadowColor = 'rgba(255, 60, 90, 0.75)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r + wobble * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ex = e.x + Math.cos(angle) * 5;
  const ey = e.y + Math.sin(angle) * 5;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 240, 240, 0.95)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fff4f4';
  ctx.beginPath();
  ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoomObjects(t) {
  const def = state.currentRoomDef;

  if (state.room === '100' && !state.progress['100']) {
    drawBeacon(def.lever.x, def.lever.y, PALETTE.gold, 'LEVER', t, 'diamond');
  }

  if (state.room === '101') {
    drawEnemy(t);
  }

  if (state.room === '200' && !state.progress['200']) {
    drawBeacon(def.curtain.x, def.curtain.y, PALETTE.purple, 'CURTAIN', t, 'orb');
  }

  if (state.room === '300' && !state.progress['300']) {
    drawBeacon(def.eye.x, def.eye.y, PALETTE.cyan, 'EYE', t, 'orb');
  }

  if (state.room === '400' && !state.progress['400']) {
    drawBeacon(def.books.x, def.books.y, PALETTE.white, 'MEMORY CODE', t, 'diamond');
  }

  if (state.room === 'final') {
    drawWormhole(300, 190, t);
  }
}

function drawLabel(x, y, text) {
  ctx.save();
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(223, 248, 255, 0.85)';
  ctx.shadowColor = 'rgba(127, 233, 255, 0.9)';
  ctx.shadowBlur = 10;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPlayer(t) {
  const p = state.player;
  const moving = state.moving;
  const sprint = state.sprinting;
  const phase = playerAnim.phase;
  const swing = moving ? Math.sin(phase) * (sprint ? 1.5 : 1.05) : 0;
  const bob = moving ? Math.abs(Math.sin(phase)) * (sprint ? 3 : 2) : Math.sin(t * 2) * 0.7;
  const angle = Math.atan2(p.dirY, p.dirX) || 0;

  // Ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 13, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Aura
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 44);
  aura.addColorStop(0, sprint ? 'rgba(167, 108, 255, 0.42)' : 'rgba(127, 233, 255, 0.3)');
  aura.addColorStop(1, 'rgba(127, 233, 255, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y - bob);
  ctx.rotate(angle);
  ctx.lineCap = 'round';

  // Limbs (drawn behind the body)
  for (const side of [-1, 1]) {
    const legOffset = swing * side * 5;
    const armOffset = -swing * side * 5;

    ctx.strokeStyle = '#4a93b5';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-2, side * 5);
    ctx.lineTo(-9 + legOffset, side * 6.5);
    ctx.stroke();

    ctx.fillStyle = `rgba(127, 233, 255, ${0.45 + Math.abs(swing) * 0.45})`;
    ctx.beginPath();
    ctx.arc(-9 + legOffset, side * 6.5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#35708c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(1, side * 8);
    ctx.lineTo(8 + armOffset, side * 10.5);
    ctx.stroke();

    ctx.fillStyle = `rgba(223, 248, 255, ${0.4 + Math.abs(swing) * 0.35})`;
    ctx.beginPath();
    ctx.arc(8 + armOffset, side * 10.5, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Backpack
  ctx.fillStyle = '#132635';
  roundRect(-15, -7, 9, 14, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127, 233, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Suit body
  const body = ctx.createRadialGradient(-2, -2, 1, 0, 0, 12);
  body.addColorStop(0, '#cdf6ff');
  body.addColorStop(0.45, '#5ec8e8');
  body.addColorStop(1, '#1d6a8c');
  ctx.fillStyle = body;
  ctx.shadowColor = 'rgba(127, 233, 255, 0.85)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Visor
  const visor = ctx.createLinearGradient(2, -6, 11, 6);
  visor.addColorStop(0, '#eafcff');
  visor.addColorStop(1, '#4fd2ff');
  ctx.fillStyle = visor;
  ctx.beginPath();
  ctx.ellipse(5, 0, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function findInteractTarget() {
  const def = state.currentRoomDef;
  if (!def) return null;

  const list = [];
  if (state.room === '100' && !state.progress['100']) {
    list.push({ x: def.lever.x, y: def.lever.y, r: 26, label: 'PULL LEVER' });
  }
  if (state.room === '200' && !state.progress['200']) {
    list.push({ x: def.curtain.x, y: def.curtain.y, r: 30, label: 'TOUCH CURTAIN' });
  }
  if (state.room === '300' && !state.progress['300']) {
    list.push({ x: def.eye.x, y: def.eye.y, r: 30, label: 'PRESS THE EYE' });
  }
  if (state.room === '400' && !state.progress['400']) {
    list.push({ x: def.books.x, y: def.books.y, r: 30, label: 'TAKE THE CODE' });
  }
  if (state.room === 'final') {
    list.push({ x: 300, y: 190, r: 60, label: 'REFORGE WORMHOLE' });
  } else if (def.next) {
    list.push({
      x: def.exit.x + def.exit.w / 2,
      y: def.exit.y + def.exit.h / 2,
      r: 60,
      label: state.progress[state.room] ? 'LEAVE ROOM' : 'LOCKED'
    });
  }

  const p = state.player;
  let best = null;
  for (const target of list) {
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d <= target.r && (!best || d < best.d)) best = { ...target, d };
  }
  return best;
}

function drawPrompt(t) {
  const target = findInteractTarget();
  if (!target) return;

  const p = state.player;
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const y = p.y - 32;
  const locked = target.label === 'LOCKED';
  const accent = locked ? PALETTE.red : PALETTE.cyan;

  ctx.save();
  ctx.font = '600 10px "Segoe UI", sans-serif';
  const w = ctx.measureText(target.label).width + 46;
  const x = p.x - w / 2;

  ctx.fillStyle = 'rgba(6, 18, 28, 0.9)';
  ctx.strokeStyle = `rgba(${accent}, ${0.5 + pulse * 0.4})`;
  ctx.lineWidth = 1.5;
  roundRect(x, y - 12, w, 24, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = `rgba(${accent}, 0.92)`;
  roundRect(x + 5, y - 8, 16, 16, 5);
  ctx.fill();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#04121b';
  ctx.font = '700 10px "Segoe UI", sans-serif';
  ctx.fillText('E', x + 13, y + 0.5);

  ctx.textAlign = 'left';
  ctx.font = '600 10px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(223, 248, 255, 0.95)';
  ctx.fillText(target.label, x + 27, y + 0.5);
  ctx.restore();
}

function drawLighting(t) {  const p = state.player;
  const angle = Math.atan2(p.dirY, p.dirX) || 0;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const cone = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 260);
  cone.addColorStop(0, 'rgba(127, 233, 255, 0.18)');
  cone.addColorStop(0.55, 'rgba(127, 233, 255, 0.06)');
  cone.addColorStop(1, 'rgba(127, 233, 255, 0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.arc(p.x, p.y, 260, angle - 0.48, angle + 0.48);
  ctx.closePath();
  ctx.fill();

  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 130);
  glow.addColorStop(0, 'rgba(127, 233, 255, 0.16)');
  glow.addColorStop(1, 'rgba(127, 233, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const vig = ctx.createRadialGradient(p.x, p.y, 130, p.x, p.y, 540);
  vig.addColorStop(0, 'rgba(2, 6, 12, 0)');
  vig.addColorStop(1, 'rgba(2, 6, 12, 0.8)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawOverlay(t) {
  // CRT scanlines
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = PALETTE.cyan;
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.restore();

  // Rolling scanlet
  const scan = (t * 170) % (canvas.height + 140) - 70;
  const g = ctx.createLinearGradient(0, scan - 60, 0, scan + 60);
  g.addColorStop(0, 'rgba(127, 233, 255, 0)');
  g.addColorStop(0.5, 'rgba(127, 233, 255, 0.07)');
  g.addColorStop(1, 'rgba(127, 233, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, scan - 60, canvas.width, 120);

  // Full-screen colour flash
  if (fx.flash > 0.001) {
    ctx.fillStyle = `rgba(${fx.flashColor}, ${fx.flash * 0.45})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawHud() {
  healthValue.textContent = Math.round(state.health);
  oxygenValue.textContent = Math.round(state.oxygen);
  staminaValue.textContent = Math.round(state.stamina);
  roomValue.textContent = state.room;
  objectiveValue.textContent = roomText[state.room];

  healthBar.style.width = `${clamp(state.health, 0, 100)}%`;
  oxygenBar.style.width = `${clamp(state.oxygen, 0, 100)}%`;
  staminaBar.style.width = `${clamp(state.stamina, 0, 100)}%`;

  if (hudEl) hudEl.classList.toggle('danger', state.health < 35);
}

function update(dt) {
  movePlayer(dt);
  updateEnemy(dt);
  updateRoomState(dt);
  updateParticles(dt);
  updateMotes(dt);

  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt * 26);
  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 2.2);

  drawHud();
}

function draw(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (fx.shake > 0.2) {
    ctx.translate(rand(-fx.shake, fx.shake), rand(-fx.shake, fx.shake));
  }
  drawFloor(t);
  drawWalls(t);
  drawRoomObjects(t);
  drawExit(t);
  drawParticles();
  drawPlayer(t);
  drawPrompt(t);
  drawMotes();
  ctx.restore();

  drawLighting(t);
  drawOverlay(t);
}

let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.032);
  lastTime = timestamp;
  elapsed += dt;
  update(dt);
  draw(elapsed);
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  keys[event.key] = true;
  if (event.key === 'e' || event.key === 'E') interact();
});

window.addEventListener('keyup', (event) => {
  keys[event.key] = false;
});

initMotes();
loadRoom('100');
showMessage('You are the mission specialist. Walk with WASD and press E to interact.');
requestAnimationFrame(gameLoop);
