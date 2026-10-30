const STORY_TEXT = {
  intro: [
    '<p>You are the mission specialist aboard the starship <strong>Helios</strong>, drifting through a quiet sector of deep space.</p>',
    '<p>While charting a corridor between stars, you and the crew accidentally trigger a fragile wormhole. The ship is yanked into an impossible dimension where memory, time, and matter leak out of the seams.</p>',
    '<p>When you recover, your crew is still alive but your memories are fractured. You are in sealed suit gear with a breathing mask, and the atmosphere tastes like rust and ozone.</p>',
    '<p>The first door ahead is marked with the number <span class="warning">ROOM 100</span>.</p>'
  ],
  room100: [
    '<p class="system">Room 100: Interdimensional Hall.</p>',
    '<p>The walls are alive with shifting geometry. A screeching wail tears through the dark, making your eyes sting and your thoughts blur.</p>',
    '<p>In the center of the room, a metal lever hums with unstable energy. The floor vibrates as if an impossible body is moving just beyond the walls.</p>',
    '<p class="warning">A warning light starts to pulse. The shriek rises, and a monstrous shadow ripples through the corridor toward you.</p>'
  ],
  room101: [
    '<p class="danger">Alarm breach. Shadow contact confirmed.</p>',
    '<p>The shadow lurches forward with a movement that breaks every known rule of motion. You are forced to choose between speed, courage, and the memory of what you already lost.</p>',
    '<p>The room is a maze of unstable walls and flickering lights. Every second feels like a second chance that is already running out.</p>'
  ],
  room200: [
    '<p class="system">Room 200: Time-Space Fold.</p>',
    '<p>The room is filled with shattered clocks, drifting ribbons of light, and the sensation that your body is being pinned together by invisible threads.</p>',
    '<p>Suspended in the center is a torn curtain woven from stuttering time. It flickers between past and future like a ghost that refuses to die.</p>',
    '<p>Touching it could carry you deeper into the fold — or break you apart completely.</p>'
  ],
  room300: [
    '<p class="system">Room 300: Black Hole Vestibule.</p>',
    '<p>A dark whirlpool opens in front of you. It is not empty. It pulses with countless glowing eye-like forms, each one watching you with a slow, patient intelligence.</p>',
    '<p>One glimmering eye starts to form a doorway. The gravity here is crushing, but the void seems to be waiting for your hand.</p>'
  ],
  room400: [
    '<p class="system">Room 400: Memory Rift.</p>',
    '<p>Falling books circle you like a storm. Every page is a fragment of memory: your training, your crew, your mistakes, the moment the wormhole opened.</p>',
    '<p>The pages rain down around your boots. One of them drifts into your palm and begins to burn with a blue-white glow.</p>',
    '<p>At the center of the storm, hidden in the drift, is a code left behind by your future self.</p>'
  ],
  final: [
    '<p class="system">Final chamber: The Wormhole Engine.</p>',
    '<p>You realize the truth. The wormhole was not simply a breach — it was a wound in reality itself. It destroyed a universe and left your crew trapped in a repeating memory loop.</p>',
    '<p>The only way to survive is to recreate the wormhole before the fracture spreads beyond this corridor.</p>',
    '<p class="warning">The engine answers your call. The void exhales. The door to the real ship opens.</p>'
  ],
  death: [
    '<p class="danger">The dimension closes in.</p>',
    '<p>You lose the fight against the void. The crew’s memory fractures into silence, and the room resets itself around you.</p>',
    '<p>Your number changes. You are thrown back into the first room with another chance to survive.</p>'
  ]
};

const state = {
  phase: 'intro',
  room: 100,
  health: 100,
  oxygen: 100,
  memory: 0,
  crew: 5,
  inventory: [],
  code: '',
  leverTriggered: false,
  shadowEscaped: false,
  curtainTouched: false,
  eyeOpened: false,
  finalReady: false,
  ended: false
};

const SAVE_KEY = 'frankgrace-save';
const audio = {
  enabled: true,
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  },
  beep(freq = 440, duration = 0.12, type = 'sine', volume = 0.03) {
    if (!this.enabled || !this.ctx) return;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(this.ctx.destination);
    oscillator.start();
    oscillator.stop(this.ctx.currentTime + duration);
  },
  triggerDanger() {
    this.beep(220, 0.18, 'sawtooth', 0.05);
    setTimeout(() => this.beep(120, 0.2, 'square', 0.04), 60);
  },
  triggerSuccess() {
    this.beep(660, 0.12, 'triangle', 0.04);
    setTimeout(() => this.beep(880, 0.18, 'triangle', 0.04), 90);
  }
};

const elements = {
  story: document.getElementById('story'),
  choices: document.getElementById('choices'),
  health: document.getElementById('healthLabel'),
  oxygen: document.getElementById('oxygenLabel'),
  memory: document.getElementById('memoryLabel'),
  crew: document.getElementById('crewStatus'),
  room: document.getElementById('roomLabel'),
  inventory: document.getElementById('inventoryLabel'),
  saveBtn: document.getElementById('saveBtn'),
  restartBtn: document.getElementById('restartBtn')
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateHud() {
  elements.health.textContent = state.health;
  elements.oxygen.textContent = state.oxygen;
  elements.memory.textContent = `${state.memory}%`;
  elements.crew.textContent = `${state.crew} alive`;
  elements.room.textContent = state.room;
  elements.inventory.textContent = state.inventory.length ? state.inventory.join(', ') : 'Empty';
}

function renderStory() {
  elements.story.innerHTML = STORY_TEXT[state.phase].join('');
  updateHud();
}

function renderChoices(choices) {
  elements.choices.innerHTML = '';
  choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `choice ${choice.kind || 'primary'}`;
    btn.textContent = choice.label;
    btn.addEventListener('click', () => {
      audio.init();
      audio.beep(440, 0.08, 'triangle', 0.025);
      choice.action();
    });
    elements.choices.appendChild(btn);
  });
}

function addInventory(item) {
  if (!state.inventory.includes(item)) {
    state.inventory.push(item);
  }
}

function applyDamage(amount) {
  state.health = clamp(state.health - amount, 0, 100);
  if (state.health <= 0) {
    state.health = 100;
    state.oxygen = 100;
    state.memory = Math.max(0, state.memory - 14);
    state.phase = 'death';
    state.room = 100;
    state.inventory = [];
    renderStory();
    renderChoices([
      { label: 'Wake up in the first room again', action: () => startGame(), kind: 'danger' }
    ]);
    return true;
  }
  return false;
}

function saveRun() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  elements.story.innerHTML += '<p class="system">Run saved successfully.</p>';
  audio.init();
  audio.triggerSuccess();
}

function loadRun() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    startGame();
    return;
  }

  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    renderStory();
    renderPhaseChoices();
  } catch (error) {
    console.error('Save data failed to load.', error);
    startGame();
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  startGame();
}

function startGame() {
  state.phase = 'room100';
  state.room = 100;
  state.health = 100;
  state.oxygen = 100;
  state.memory = 0;
  state.crew = 5;
  state.inventory = [];
  state.code = '';
  state.leverTriggered = false;
  state.shadowEscaped = false;
  state.curtainTouched = false;
  state.eyeOpened = false;
  state.finalReady = false;
  state.ended = false;
  renderStory();
  renderPhaseChoices();
}

function renderPhaseChoices() {
  switch (state.phase) {
    case 'intro':
      renderChoices([
        { label: 'Begin the mission', action: () => { state.phase = 'room100'; state.room = 100; renderStory(); renderPhaseChoices(); }, kind: 'primary' }
      ]);
      return;

    case 'room100':
      renderChoices([
        { label: 'Search the walls for a hidden relay', action: () => searchWall(), kind: 'primary' },
        { label: 'Pull the lever', action: () => pullLever(), kind: 'primary' },
        { label: 'Run from the shadow', action: () => runFromShadow(), kind: 'danger' }
      ]);
      return;

    case 'room101':
      renderChoices([
        { label: 'Use the relay to blind the shadow', action: () => useRelay(), kind: 'primary' },
        { label: 'Sprint toward the next door', action: () => sprintAway(), kind: 'primary' },
        { label: 'Hide and wait for the room to reset', action: () => hideAndFail(), kind: 'danger' }
      ]);
      return;

    case 'room200':
      renderChoices([
        { label: 'Search the time ribbons', action: () => searchTimeRibbon(), kind: 'primary' },
        { label: 'Touch the curtain', action: () => touchCurtain(), kind: 'primary' },
        { label: 'Use a memory shard to stabilize the room', action: () => useMemoryShard(), kind: 'primary' }
      ]);
      return;

    case 'room300':
      renderChoices([
        { label: 'Press your fingers into the glowing eye', action: () => openEyeDoor(), kind: 'primary' },
        { label: 'Back away and watch the void', action: () => watchVoid(), kind: 'primary' },
        { label: 'Use the crew medallion to signal the doorway', action: () => useMedallion(), kind: 'primary' }
      ]);
      return;

    case 'room400':
      renderChoices([
        { label: 'Read the falling books', action: () => readBooks(), kind: 'primary' },
        { label: 'Grab the hidden code pages', action: () => grabCode(), kind: 'primary' },
        { label: 'Find the crew sigil inside the storm', action: () => findCrewSigil(), kind: 'primary' }
      ]);
      return;

    case 'final':
      renderChoices([
        { label: 'Reforge the wormhole', action: () => finalizeRun(), kind: 'primary' },
        { label: 'Restart the mission', action: () => resetGame(), kind: 'danger' }
      ]);
      return;

    case 'death':
      renderChoices([
        { label: 'Wake up in the first room again', action: () => startGame(), kind: 'danger' }
      ]);
      return;

    default:
      renderChoices([
        { label: 'Start mission', action: () => startGame(), kind: 'primary' }
      ]);
  }
}

function searchWall() {
  if (state.inventory.includes('relay key')) {
    elements.story.innerHTML += '<p>You inspect the wall again, but the relay is already stabilized. The room is not trying to hide anything from you anymore.</p>';
    renderChoices([
      { label: 'Pull the lever', action: () => pullLever(), kind: 'primary' },
      { label: 'Run from the shadow', action: () => runFromShadow(), kind: 'danger' }
    ]);
    return;
  }

  addInventory('relay key');
  state.memory += 8;
  state.oxygen = clamp(state.oxygen - 5, 0, 100);
  elements.story.innerHTML = '<p>You force your gloved hand into a wall seam and uncover a hidden relay system.</p><p>The screeching falters, then spikes. The room responds to your touch.</p><p class="system">Item acquired: relay key.</p>';
  renderChoices([
    { label: 'Pull the lever', action: () => pullLever(), kind: 'primary' },
    { label: 'Run from the shadow', action: () => runFromShadow(), kind: 'danger' }
  ]);
  audio.triggerSuccess();
}

function pullLever() {
  if (state.phase !== 'room100') return;

  state.leverTriggered = true;
  state.phase = 'room101';
  state.room = 101;
  state.memory = 25;
  addInventory('suit signal');
  renderStory();
  renderPhaseChoices();
  audio.triggerSuccess();
}

function runFromShadow() {
  if (state.phase !== 'room100') return;
  state.shadowEscaped = true;
  state.phase = 'room101';
  state.room = 101;
  state.memory = 20;
  state.oxygen = clamp(state.oxygen - 8, 0, 100);
  renderStory();
  renderPhaseChoices();
  audio.triggerDanger();
}

function useRelay() {
  if (state.phase !== 'room101') return;
  if (!state.inventory.includes('relay key')) {
    elements.story.innerHTML += '<p>The shadow is already too close. You need something to distract it.</p>';
    return;
  }

  state.inventory = state.inventory.filter((item) => item !== 'relay key');
  state.phase = 'room200';
  state.room = 200;
  state.memory = 42;
  renderStory();
  renderPhaseChoices();
  audio.triggerSuccess();
}

function sprintAway() {
  if (state.phase !== 'room101') return;
  if (applyDamage(15)) return;
  state.phase = 'room200';
  state.room = 200;
  state.memory = 36;
  renderStory();
  renderPhaseChoices();
  audio.triggerDanger();
}

function hideAndFail() {
  if (state.phase !== 'room101') return;
  if (applyDamage(18)) return;
  state.phase = 'room100';
  state.room = 100;
  state.memory = 10;
  renderStory();
  renderPhaseChoices();
  audio.triggerDanger();
}

function searchTimeRibbon() {
  if (state.phase !== 'room200') return;
  addInventory('memory shard');
  state.memory += 10;
  state.oxygen = clamp(state.oxygen - 6, 0, 100);
  elements.story.innerHTML = '<p>You sift through the ribbons and uncover a fractured shard of memory.</p><p class="system">Item acquired: memory shard.</p>';
  renderChoices([
    { label: 'Touch the curtain', action: () => touchCurtain(), kind: 'primary' },
    { label: 'Use the memory shard to stabilize the room', action: () => useMemoryShard(), kind: 'primary' }
  ]);
}

function useMemoryShard() {
  if (state.phase !== 'room200') return;
  if (!state.inventory.includes('memory shard')) {
    elements.story.innerHTML += '<p>The room trembles. You need a fragment to stabilize the fold.</p>';
    return;
  }

  state.inventory = state.inventory.filter((item) => item !== 'memory shard');
  state.phase = 'room300';
  state.room = 300;
  state.memory = 60;
  renderStory();
  renderPhaseChoices();
  audio.triggerSuccess();
}

function touchCurtain() {
  if (state.phase !== 'room200') return;
  state.curtainTouched = true;
  state.phase = 'room300';
  state.room = 300;
  state.memory = 58;
  renderStory();
  renderPhaseChoices();
  audio.triggerDanger();
}

function watchVoid() {
  if (state.phase !== 'room300') return;
  state.oxygen = clamp(state.oxygen - 8, 0, 100);
  elements.story.innerHTML = '<p>You let the black hole stare back. One of the eye-lights thickens, split by a breath of static.</p><p>The door is forming. It is waiting for a decision.</p>';
  renderChoices([
    { label: 'Press your fingers into the glowing eye', action: () => openEyeDoor(), kind: 'primary' },
    { label: 'Use the crew medallion to signal the doorway', action: () => useMedallion(), kind: 'primary' }
  ]);
}

function openEyeDoor() {
  if (state.phase !== 'room300') return;
  state.eyeOpened = true;
  state.phase = 'room400';
  state.room = 400;
  state.memory = 80;
  renderStory();
  renderPhaseChoices();
  audio.triggerSuccess();
}

function useMedallion() {
  if (state.phase !== 'room300') return;
  if (!state.inventory.includes('crew sigil')) {
    elements.story.innerHTML += '<p>You only have your suit ID and a prayer. The edifice of the void needs a signal from the crew.</p>';
    return;
  }

  state.phase = 'room400';
  state.room = 400;
  state.memory = 85;
  renderStory();
  renderPhaseChoices();
  audio.triggerSuccess();
}

function readBooks() {
  if (state.phase !== 'room400') return;
  state.memory += 8;
  elements.story.innerHTML = '<p>You read the drifting pages. The words are written in your own voice, but older and louder.</p><p><span class="system">“The wormhole was fragile. It was the first wound. It was the last breach.”</span></p><p>The storm slows around you.</p>';
  renderChoices([
    { label: 'Grab the hidden code pages', action: () => grabCode(), kind: 'primary' },
    { label: 'Find the crew sigil inside the storm', action: () => findCrewSigil(), kind: 'primary' }
  ]);
}

function grabCode() {
  if (state.phase !== 'room400') return;
  state.code = 'WORM-9';
  state.memory += 10;
  addInventory('worm code');
  elements.story.innerHTML = '<p>You pull a page free from the falling memory storm.</p><p class="warning">Code acquired: WORM-9</p><p>The sequence hums in your skull like a command.</p>';
  renderChoices([
    { label: 'Find the crew sigil inside the storm', action: () => findCrewSigil(), kind: 'primary' },
    { label: 'Finish the reassembly', action: () => checkFinalRequirements(), kind: 'primary' }
  ]);
  audio.triggerSuccess();
}

function findCrewSigil() {
  if (state.phase !== 'room400') return;
  addInventory('crew sigil');
  state.memory += 8;
  elements.story.innerHTML = '<p>You uncover a brass crew sigil caught in a page fold.</p><p class="system">Item acquired: crew sigil.</p>';
  renderChoices([
    { label: 'Grab the hidden code pages', action: () => grabCode(), kind: 'primary' },
    { label: 'Finish the reassembly', action: () => checkFinalRequirements(), kind: 'primary' }
  ]);
  audio.triggerSuccess();
}

function checkFinalRequirements() {
  if (state.phase !== 'room400') return;

  const hasCode = state.inventory.includes('worm code');
  const hasSigil = state.inventory.includes('crew sigil');

  if (!hasCode || !hasSigil) {
    elements.story.innerHTML = '<p>The sequence is almost complete, but the storm keeps twisting it apart.</p><p>You need both the code and the crew sigil before the final chamber will open.</p>';
    renderChoices([
      { label: 'Read the falling books', action: () => readBooks(), kind: 'primary' },
      { label: 'Grab the hidden code pages', action: () => grabCode(), kind: 'primary' },
      { label: 'Find the crew sigil inside the storm', action: () => findCrewSigil(), kind: 'primary' }
    ]);
    return;
  }

  state.phase = 'final';
  state.room = 'Final';
  state.memory = 100;
  state.finalReady = true;
  renderStory();
  renderPhaseChoices();
  audio.triggerSuccess();
}

function finalizeRun() {
  if (!state.finalReady) {
    elements.story.innerHTML = '<p>The engine will not answer until the wormhole sequence is complete.</p>';
    return;
  }

  state.ended = true;
  state.phase = 'final';
  renderStory();
  elements.story.innerHTML = [
    '<p class="warning">The wormhole is rebuilt.</p>',
    '<p>Your hands tremble as the engine hums to life. The dimensions fold inward. The crew’s faces emerge, one by one, at the edge of the corridor.</p>',
    '<p>Through the static you hear your own voice from a future that never happened:</p>',
    '<p><span class="danger">“We were never meant to stay in the dark. We were meant to remember why we opened the door.”</span></p>',
    '<p>The ship trembles, then tears free of the alternate dimension and slips back into the stars.</p>'
  ].join('');
  renderChoices([
    { label: 'Restart the mission', action: () => resetGame(), kind: 'primary' }
  ]);
  audio.triggerSuccess();
}

function initialize() {
  elements.saveBtn.addEventListener('click', saveRun);
  elements.restartBtn.addEventListener('click', resetGame);
  renderStory();
  renderPhaseChoices();
}

initialize();

window.addEventListener('load', () => {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
      renderStory();
      renderPhaseChoices();
    } catch (error) {
      console.error('Could not read save state', error);
      startGame();
    }
  } else {
    startGame();
  }
});
