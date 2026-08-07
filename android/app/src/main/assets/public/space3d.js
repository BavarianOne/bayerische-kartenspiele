// Early hook: log top-level execution
if (typeof window !== 'undefined') {
  if (window.__dbg) window.__dbg('space3d.js top-level executing (classic script)', 'success');
  else console.log('[space3d.js] top-level executing');
}
if (typeof window !== 'undefined' && window.__dbg) {
  window.__dbg('THREE global present: ' + (typeof THREE !== 'undefined'), 'success');
}

// ============ CONSTANTS & CONFIG ============
const CONFIG = {
  // Player
  player: {
    maxSpeed: 80,
    boostSpeed: 160,
    acceleration: 120,
    brakeForce: 80,
    strafeAccel: 80,
    verticalAccel: 80,
    pitchRate: 1.8,
    yawRate: 1.8,
    rollRate: 3.0,
    maxPitch: Math.PI * 0.45,
    hull: 100,
    shield: 100,
    shieldRegen: 5,
    shieldRegenDelay: 3,
    energy: 100,
    energyRegen: 15,
    laserCost: 2,
    missileAmmo: 8,
    empCharges: 3,
    empCooldown: 15,
    empRadius: 60,
    empDuration: 3,
  },
  // Weapons
  laser: {
    speed: 300,
    range: 400,
    damage: 15,
    fireRate: 0.12,
    spread: 0.015,
    color: 0x00ffff,
    glowColor: 0x0088ff,
  },
  missile: {
    speed: 120,
    turnRate: 3.5,
    damage: 80,
    range: 600,
    trailLength: 20,
    color: 0xff6600,
  },
  // Enemies
  enemy: {
    drone: { hull: 30, speed: 45, turnRate: 4, score: 50, color: 0x00ff88, size: 3 },
    interceptor: { hull: 60, speed: 70, turnRate: 5, score: 120, color: 0xff00ff, size: 4 },
    heavy: { hull: 180, speed: 30, turnRate: 2, score: 300, color: 0xffaa00, size: 6, shield: 50 },
    corvette: { hull: 500, speed: 18, turnRate: 1, score: 1000, color: 0xff4444, size: 12, shield: 200 },
  },
  // World
  world: {
    bounds: 2000,
    starCount: 3000,
    nebulaCount: 15,
    asteroidCount: 100,
    debrisLifetime: 8,
  },
  // Waves
  waves: {
    baseEnemies: 4,
    maxEnemies: 25,
    enemyIncrease: 2,
    typeWeights: {
      1: { drone: 1.0 },
      2: { drone: 0.7, interceptor: 0.3 },
      3: { drone: 0.5, interceptor: 0.4, heavy: 0.1 },
      4: { drone: 0.3, interceptor: 0.4, heavy: 0.2, corvette: 0.1 },
      5: { drone: 0.2, interceptor: 0.3, heavy: 0.3, corvette: 0.2 },
    },
  },
  // Power-ups
  powerup: {
    types: ['hull', 'shield', 'energy', 'missile', 'emp', 'overdrive'],
    spawnChance: 0.25,
    lifetime: 30,
    size: 2.5,
  },
};

// ============ SOUND MANAGER ============
const SFX = {
  ctx: null,
  init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  },
  _osc(type, freq, dur, vol, dest) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(dest || this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  },
  _noise(dur, vol) {
    if (!this.ctx) return;
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (vol || 0.3);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2000;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  },
  playLaser() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Primary high-frequency "pew" with sweep
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = 'square';
    o1.frequency.setValueAtTime(1800, now);
    o1.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    g1.gain.setValueAtTime(0.12, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o1.connect(g1); g1.connect(this.ctx.destination);
    o1.start(now); o1.stop(now + 0.1);
    // Secondary harmonic for richness
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(2400, now);
    o2.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    g2.gain.setValueAtTime(0.06, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    o2.connect(g2); g2.connect(this.ctx.destination);
    o2.start(now); o2.stop(now + 0.08);
    // Brief noise burst for impact
    this._noise(0.03, 0.08);
  },
  playMissile() { 
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + 0.4);
  },
  playExplosion() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Deep sub-bass rumble (low sine sweep)
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(80, now);
    o1.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    g1.gain.setValueAtTime(0.4, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    o1.connect(g1); g1.connect(this.ctx.destination);
    o1.start(now); o1.stop(now + 0.6);
    // Layer filtered noise
    this._noise(0.5, 0.3);
    // High-frequency crack at the start
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(300, now);
    o2.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    g2.gain.setValueAtTime(0.15, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    o2.connect(g2); g2.connect(this.ctx.destination);
    o2.start(now); o2.stop(now + 0.35);
  },
  playHit() { this._osc('triangle', 300, 0.1, 0.15); },
  playEMP() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(60, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.4, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + 0.6);
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'square';
    o2.frequency.setValueAtTime(30, this.ctx.currentTime);
    o2.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.4);
    g2.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    o2.connect(g2); g2.connect(this.ctx.destination);
    o2.start(); o2.stop(this.ctx.currentTime + 0.5);
  },
  playPickup() {
    if (!this.ctx) return;
    [400, 600, 800].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, this.ctx.currentTime + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.08 + 0.15);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(this.ctx.currentTime + i * 0.08); o.stop(this.ctx.currentTime + i * 0.08 + 0.15);
    });
  },
  playWaveStart() {
    if (!this.ctx) return;
    [300, 500, 700].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.12, this.ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.2);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(this.ctx.currentTime + i * 0.1); o.stop(this.ctx.currentTime + i * 0.1 + 0.2);
    });
  },
  playGameOver() { 
    [400, 350, 300, 200].forEach((f, i) => {
      this._osc('sawtooth', f, 0.3 + i * 0.1, 0.15);
    });
  },
  playBoost() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Deep sub-bass thruster rumble
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(60, now);
    o1.frequency.linearRampToValueAtTime(120, now + 0.15);
    g1.gain.setValueAtTime(0.2, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o1.connect(g1); g1.connect(this.ctx.destination);
    o1.start(now); o1.stop(now + 0.25);
    // Sci-fi harmonic layer
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(120, now);
    o2.frequency.linearRampToValueAtTime(250, now + 0.1);
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o2.connect(g2); g2.connect(this.ctx.destination);
    o2.start(now); o2.stop(now + 0.2);
    // Filtered "whoosh" noise
    if (!this.ctx) return;
    const bufSize = this.ctx.sampleRate * 0.2;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g3 = this.ctx.createGain();
    g3.gain.setValueAtTime(0.15, now);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(800, now);
    f.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    f.Q.value = 2;
    src.connect(f); f.connect(g3); g3.connect(this.ctx.destination);
    src.start(now);
  },
};

// ============ SUPPRESS CDN CORS ERRORS ============
// The "Script error." messages come from the THREE.js CDN and are harmless.
const _origOnError = window.onerror;
window.onerror = function(msg, url, line, col, err) {
  if (msg === 'Script error.' || msg === 'Script error') return true;
  if (_origOnError) return _origOnError(msg, url, line, col, err);
  return false;
};

// ============ GAME STATE ============
let scene, camera, renderer, composer, bloomPass, filmPass;
let player, playerGroup;
let enemies = [], projectiles = [], missiles = [], powerups = [], debris = [], particles = [];
let stars = null, nebulas = null, asteroids = null, gridFloor = null;
let keys = {}, pointers = {};
let joyMove = { x: 0, y: 0, active: false, id: null, up: false, down: false, rollLeft: false, rollRight: false, boost: false, fire: false, missile: false, emp: false };
let joyLook = { x: 0, y: 0, active: false, id: null };
let mouseLook = { active: false, x: 0, y: 0, sensitivity: 0.002 };
let pointerLock = false;
let gameRunning = false, gamePaused = false, gameOver = false;
let firstPerson = false, soundMuted = false;
let engineHumOsc = null, engineHumGain = null;
let score = 0, wave = 1, kills = 0, multiplier = 1, multiplierTimer = 0;
let bestScore = parseInt(localStorage.getItem('starfighterBest') || '0');
let sector = 1;
let lastTime = 0;
let shakeIntensity = 0;
let screenFlash = 0;
let spawnTimer = 0;
let enemiesRemaining = 0;
let difficulty = 1;
const flashColor = new THREE.Color();

// DOM Elements
const gi = (id) => document.getElementById(id);
const intro = gi('intro'), hud = gi('hud'), canvas = gi('cnv'), msgEl = gi('msg');

// Debug logging visible on page (persistent panel outside #intro)
const debugPanel = gi('debugPanel');
const debugLogList = gi('debugLogList');
function debugLog(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString();
  const color = type === 'error' ? '#f44' : type === 'warn' ? '#fa0' : '#0ff';
  const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✓';
  console.log(`[DEBUG ${ts}] ${msg}`);
  if (debugPanel && debugLogList) {
    debugPanel.style.display = 'block';
    const line = document.createElement('div');
    line.style.cssText = `color:${color};padding:1px 0;border-bottom:1px solid #022;font-family:'Courier New',monospace;`;
    line.textContent = `${ts} [${prefix}] ${msg}`;
    debugLogList.appendChild(line);
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }
}
debugLog('Module script executed');
debugLog(`intro=${!!intro}, hud=${!!hud}, canvas=${!!canvas}, msgEl=${!!msgEl}`);
debugLog(`debugPanel=${!!debugPanel}, debugLogList=${!!debugLogList}`);
debugLog('Import map should map three to unpkg CDN');
const hullBar = gi('hullBar'), hullVal = gi('hullVal');
const shieldBar = gi('shieldBar'), shieldVal = gi('shieldVal');
const energyBar = gi('energyBar'), energyVal = gi('energyVal');
const scoreVal = gi('scoreVal'), waveVal = gi('waveVal'), killsVal = gi('killsVal');
const multiVal = gi('multiVal'), bestVal = gi('bestVal');
const viewVal = gi('viewVal'), soundVal = gi('soundVal');
const primaryAmmo = gi('primaryAmmo'), primaryCD = gi('primaryCD');
const missileAmmo = gi('missileAmmo'), missileCD = gi('missileCD');
const empAmmo = gi('empAmmo'), empCD = gi('empCD');
const waveNum = gi('waveNum');
const wpnPrimary = gi('wpnPrimary'), wpnSecondary = gi('wpnSecondary'), wpnSpecial = gi('wpnSpecial');
const btnFire = gi('btnFire'), btnMissile = gi('btnMissile'), btnBoost = gi('btnBoost'), btnEMP = gi('btnEMP');
const btnRollL = gi('btnRollL'), btnRollR = gi('btnRollR');
const btnUp = gi('btnUp'), btnDown = gi('btnDown');

// Aim system
const crosshairEl = gi('crosshair');
const targetInfoEl = gi('targetInfo');
const rangeInfoEl = gi('rangeInfo');
const leadIndicatorEl = gi('leadIndicator');
let targetEnemy = null; // current locked / nearest enemy
let leadPos = new THREE.Vector3();
let crosshairVisible = false;

// ============ UTILITY FUNCTIONS ============
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const deg2rad = (d) => d * Math.PI / 180;

function showMsg(text, type = '') {
  msgEl.textContent = text;
  msgEl.className = 'show ' + type;
  clearTimeout(msgEl._hideTimer);
  msgEl._hideTimer = setTimeout(() => msgEl.classList.remove('show'), 2500);
}

function addScore(points) {
  score += Math.floor(points * multiplier);
  multiplier = Math.min(5, multiplier + 0.1);
  multiplierTimer = 3;
  updateHUD();
}

function updateHUD() {
  const p = player;
  hullBar.style.width = `${clamp(p.hull / p.maxHull * 100, 0, 100)}%`;
  hullVal.textContent = Math.ceil(p.hull);
  shieldBar.style.width = `${clamp(p.shield / p.maxShield * 100, 0, 100)}%`;
  shieldVal.textContent = Math.ceil(p.shield);
  energyBar.style.width = `${clamp(p.energy / p.maxEnergy * 100, 0, 100)}%`;
  energyVal.textContent = Math.ceil(p.energy);
  scoreVal.textContent = score.toLocaleString();
  waveVal.textContent = wave;
  killsVal.textContent = kills;
  multiVal.textContent = `x${multiplier.toFixed(1)}`;
  bestVal.textContent = bestScore.toLocaleString();
  missileAmmo.textContent = p.missileAmmo;
  empAmmo.textContent = p.empCharges;
  
  // Weapon slot active states
  wpnPrimary.classList.toggle('active', p.currentWeapon === 'laser');
  wpnSecondary.classList.toggle('active', p.currentWeapon === 'missile');
  wpnSpecial.classList.toggle('active', p.currentWeapon === 'emp');
  
  // Cooldown bars
  primaryCD.style.transform = `scaleX(${clamp(p.laserCooldown / CONFIG.laser.fireRate, 0, 1)})`;
  missileCD.style.transform = `scaleX(${clamp(p.missileCooldown / 0.5, 0, 1)})`;
  empCD.style.transform = `scaleX(${clamp(p.empCooldown / CONFIG.player.empCooldown, 0, 1)})`;
}

function screenShake(amount) {
  shakeIntensity = Math.max(shakeIntensity, amount);
}

function flashScreen(amount, color = 0xffffff) {
  screenFlash = Math.max(screenFlash, amount);
  flashColor.set(color);
}

// ============ THREE.JS INITIALIZATION ============
function initThree() {
  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000814, 0.0008);
  
  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, 0, 20);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  
  // Post-processing (optional — gracefully fall back if EffectComposer addons not loaded)
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2, 0.5, 0.7
    );
    composer.addPass(bloomPass);
    
    // Film pass for scanlines
    filmPass = new FilmPass(0.15, 0.02, 2048, false);
    composer.addPass(filmPass);
    
    // Chromatic aberration shader
    const chromaticShader = {
      uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        varying vec2 vUv;
        void main() {
          vec2 offset = amount * vec2(0.0015, 0.0);
          vec4 cr = texture2D(tDiffuse, vUv + offset);
          vec4 cga = texture2D(tDiffuse, vUv);
          vec4 cb = texture2D(tDiffuse, vUv - offset);
          gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
        }
      `,
    };
    const chromaticPass = new ShaderPass(chromaticShader);
    composer.addPass(chromaticPass);
    window.chromaticPass = chromaticPass;
    debugLog('Post-processing enabled (bloom + film + chromatic aberration)', 'success');
  } catch (ppErr) {
    debugLog('Post-processing not available (EffectComposer addons missing), using basic rendering: ' + ppErr.message, 'warn');
    composer = null;
    bloomPass = null;
    filmPass = null;
    window.chromaticPass = null;
  }
  
  // Lights
  const ambient = new THREE.AmbientLight(0x224466, 0.4);
  scene.add(ambient);
  
  const mainLight = new THREE.DirectionalLight(0x00ffff, 1.5);
  mainLight.position.set(100, 200, 100);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  mainLight.shadow.camera.near = 10;
  mainLight.shadow.camera.far = 500;
  mainLight.shadow.camera.left = -200;
  mainLight.shadow.camera.right = 200;
  mainLight.shadow.camera.top = 200;
  mainLight.shadow.camera.bottom = -200;
  scene.add(mainLight);
  
  const rimLight = new THREE.DirectionalLight(0xff00ff, 0.8);
  rimLight.position.set(-100, 50, -100);
  scene.add(rimLight);
  
  const fillLight = new THREE.DirectionalLight(0x0088ff, 0.5);
  fillLight.position.set(0, -100, 0);
  scene.add(fillLight);
  
  // Resize handler
  window.addEventListener('resize', onResize);
  
  // Build world
  createStarfield();
  createNebulas();
  createAsteroids();
  createGridFloor();
  createPlayer();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  if (bloomPass) {
    bloomPass.setSize(window.innerWidth, window.innerHeight);
  }
}

// ============ WORLD CREATION ============
function createStarfield() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(CONFIG.world.starCount * 3);
  const colors = new Float32Array(CONFIG.world.starCount * 3);
  const sizes = new Float32Array(CONFIG.world.starCount);
  const alphas = new Float32Array(CONFIG.world.starCount);
  const speeds = new Float32Array(CONFIG.world.starCount);
  
  for (let i = 0; i < CONFIG.world.starCount; i++) {
    const radius = rand(100, CONFIG.world.bounds * 1.5);
    const theta = rand(0, Math.PI * 2);
    const phi = Math.acos(rand(-1, 1));
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    
    // Cyberpunk colors: cyan, magenta, yellow, white
    const colorChoice = randInt(0, 3);
    if (colorChoice === 0) { colors[i*3]=0; colors[i*3+1]=1; colors[i*3+2]=1; }      // cyan
    else if (colorChoice === 1) { colors[i*3]=1; colors[i*3+1]=0; colors[i*3+2]=1; } // magenta
    else if (colorChoice === 2) { colors[i*3]=1; colors[i*3+1]=1; colors[i*3+2]=0; } // yellow
    else { colors[i*3]=1; colors[i*3+1]=1; colors[i*3+2]=1; }                        // white
    
    sizes[i] = rand(0.5, 3);
    alphas[i] = rand(0.3, 1);
    speeds[i] = rand(0.1, 1.5);
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
  
  const material = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  
  // Custom shader for twinkling
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      'void main()',
      `uniform float uTime; attribute float alpha; attribute float speed; varying float vAlpha; void main()`
    );
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      `vAlpha = alpha * (0.5 + 0.5 * sin(uTime * speed + position.x * 0.01));
       gl_PointSize = size * (1.0 + 0.3 * sin(uTime * speed + position.y * 0.01));`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main()',
      `varying float vAlpha; void main()`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );'
    );
    stars.material = material;
    stars.material.userData.shader = shader;
  };
  
  stars = new THREE.Points(geometry, material);
  stars.userData.speeds = speeds;
  scene.add(stars);
}

function createNebulas() {
  nebulas = new THREE.Group();
  
  for (let i = 0; i < CONFIG.world.nebulaCount; i++) {
    const geometry = new THREE.SphereGeometry(rand(80, 200), 16, 12);
    const positions = geometry.attributes.position.array;
    const colors = new Float32Array(positions.length);
    
    const hue = rand(0.5, 0.9); // cyan to magenta range
    for (let j = 0; j < positions.length; j += 3) {
      const noise = rand(0.3, 1);
      const sat = noise * 0.8;
      const light = 0.3 + noise * 0.4;
      const c = new THREE.Color().setHSL(hue, sat, light);
      colors[j] = c.r; colors[j+1] = c.g; colors[j+2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      rand(-CONFIG.world.bounds, CONFIG.world.bounds),
      rand(-CONFIG.world.bounds * 0.5, CONFIG.world.bounds * 0.5),
      rand(-CONFIG.world.bounds, CONFIG.world.bounds)
    );
    mesh.scale.setScalar(rand(0.5, 2));
    mesh.userData = { rotSpeed: new THREE.Vector3(rand(-0.0001, 0.0001), rand(-0.0001, 0.0001), rand(-0.0001, 0.0001)) };
    nebulas.add(mesh);
  }
  scene.add(nebulas);
}

function createAsteroids() {
  asteroids = new THREE.Group();
  const geometries = [];
  
  // Create a few base geometries
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position.array;
    for (let j = 0; j < pos.length; j += 3) {
      pos[j] *= rand(0.7, 1.3);
      pos[j+1] *= rand(0.7, 1.3);
      pos[j+2] *= rand(0.7, 1.3);
    }
    geo.computeVertexNormals();
    geometries.push(geo);
  }
  
  for (let i = 0; i < CONFIG.world.asteroidCount; i++) {
    const geo = geometries[randInt(0, geometries.length - 1)];
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.08, 0.1, rand(0.2, 0.4)),
      roughness: 0.9,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(
      rand(-CONFIG.world.bounds, CONFIG.world.bounds),
      rand(-CONFIG.world.bounds * 0.3, CONFIG.world.bounds * 0.3),
      rand(-CONFIG.world.bounds, CONFIG.world.bounds)
    );
    mesh.scale.setScalar(rand(3, 15));
    mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      rotSpeed: new THREE.Vector3(rand(-0.001, 0.001), rand(-0.001, 0.001), rand(-0.001, 0.001)),
      drift: new THREE.Vector3(rand(-0.02, 0.02), rand(-0.01, 0.01), rand(-0.02, 0.02)),
    };
    asteroids.add(mesh);
  }
  scene.add(asteroids);
}

function createGridFloor() {
  gridFloor = new THREE.Group();
  
  // Main grid
  const gridSize = CONFIG.world.bounds * 2;
  const gridDivisions = 80;
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x004466, 0x001122);
  gridHelper.position.y = -200;
  gridHelper.material.opacity = 0.3;
  gridHelper.material.transparent = true;
  gridFloor.add(gridHelper);
  
  // Glowing grid lines
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = [];
  const lineColors = [];
  const spacing = gridSize / gridDivisions;
  
  for (let i = -gridDivisions/2; i <= gridDivisions/2; i++) {
    const pos = i * spacing;
    // X lines
    linePositions.push(-gridSize/2, -200, pos, gridSize/2, -200, pos);
    lineColors.push(0, 0.6, 1, 0.1, 0, 0.3, 1, 0.1);
    // Z lines
    linePositions.push(pos, -200, -gridSize/2, pos, -200, gridSize/2);
    lineColors.push(0, 0.6, 1, 0.1, 0, 0.3, 1, 0.1);
  }
  
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  gridFloor.add(lines);
  gridFloor.userData.lines = lines;
  
  scene.add(gridFloor);
}

// ============ PLAYER SHIP CREATION ============
function createPlayer() {
  playerGroup = new THREE.Group();
  
  // Ship body - angular cyberpunk fighter
  const bodyGeo = new THREE.BufferGeometry();
  const bodyPositions = [];
  const bodyNormals = [];
  const bodyColors = [];
  
  // Fuselage (main body)
  const fuselage = createFuselage();
  mergeGeometry(bodyPositions, bodyNormals, bodyColors, fuselage.positions, fuselage.normals, fuselage.colors);
  
  // Wings
  const leftWing = createWing(-1);
  mergeGeometry(bodyPositions, bodyNormals, bodyColors, leftWing.positions, leftWing.normals, leftWing.colors);
  
  const rightWing = createWing(1);
  mergeGeometry(bodyPositions, bodyNormals, bodyColors, rightWing.positions, rightWing.normals, rightWing.colors);
  
  // Engine nacelles
  const leftEngine = createEngine(-1);
  mergeGeometry(bodyPositions, bodyNormals, bodyColors, leftEngine.positions, leftEngine.normals, leftEngine.colors);
  
  const rightEngine = createEngine(1);
  mergeGeometry(bodyPositions, bodyNormals, bodyColors, rightEngine.positions, rightEngine.normals, rightEngine.colors);
  
  // Cockpit
  const cockpit = createCockpit();
  mergeGeometry(bodyPositions, bodyNormals, bodyColors, cockpit.positions, cockpit.normals, cockpit.colors);
  
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPositions, 3));
  bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(bodyNormals, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyColors, 3));
  bodyGeo.computeBoundingSphere();
  
  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.8,
    emissive: new THREE.Color(0x002244),
    emissiveIntensity: 0.3,
  });
  
  const shipMesh = new THREE.Mesh(bodyGeo, bodyMat);
  shipMesh.castShadow = true;
  shipMesh.receiveShadow = true;
  playerGroup.add(shipMesh);
  playerGroup.userData.shipMesh = shipMesh;
  
  // Engine glow lights
  const engineLightL = new THREE.PointLight(0x00ffff, 2, 30);
  engineLightL.position.set(-6, -1, -8);
  playerGroup.add(engineLightL);
  
  const engineLightR = new THREE.PointLight(0x00ffff, 2, 30);
  engineLightR.position.set(6, -1, -8);
  playerGroup.add(engineLightR);
  
  playerGroup.userData.engineLights = [engineLightL, engineLightR];
  
  // Weapon hardpoints
  const hardpointL = new THREE.Object3D();
  hardpointL.position.set(-4.5, 0.5, 6);
  playerGroup.add(hardpointL);
  
  const hardpointR = new THREE.Object3D();
  hardpointR.position.set(4.5, 0.5, 6);
  playerGroup.add(hardpointR);
  
  playerGroup.userData.hardpoints = [hardpointL, hardpointR];
  
  // Missile bays
  const missileBayL = new THREE.Object3D();
  missileBayL.position.set(-3, -0.5, 4);
  playerGroup.add(missileBayL);
  
  const missileBayR = new THREE.Object3D();
  missileBayR.position.set(3, -0.5, 4);
  playerGroup.add(missileBayR);
  
  playerGroup.userData.missileBays = [missileBayL, missileBayR];
  
  // Engine trail particles
  createEngineTrails(playerGroup);
  
  // Player state
  player = {
    mesh: playerGroup,
    maxHull: CONFIG.player.hull,
    hull: CONFIG.player.hull,
    maxShield: CONFIG.player.shield,
    shield: CONFIG.player.shield,
    maxEnergy: CONFIG.player.energy,
    energy: CONFIG.player.energy,
    missileAmmo: CONFIG.player.missileAmmo,
    empCharges: CONFIG.player.empCharges,
    empCooldown: 0,
    laserCooldown: 0,
    missileCooldown: 0,
    currentWeapon: 'laser',
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Euler(),
    thrust: 0,
    boost: false,
    shieldRegenTimer: 0,
    invulnerable: 0,
    rollInput: 0,
    pitchInput: 0,
    yawInput: 0,
  };
  
  scene.add(playerGroup);
  camera.position.copy(playerGroup.position);
  camera.position.z += 15;
  camera.position.y += 3;
}

function createFuselage() {
  const positions = [], normals = [], colors = [];
  const length = 20, width = 4, height = 3;
  
  const v = [
    [-width/2, -height/2, -length/2],
    [width/2, -height/2, -length/2],
    [width/2, -height/2, -length/2],
    [width/2*0.5, -height/2, length/2],
    [-width/2*0.5, -height/2, length/2],
    [-width/2*0.6, height/2, -length/2],
    [width/2*0.6, height/2, -length/2],
    [width/2*0.3, height/2*0.8, length/2],
    [-width/2*0.3, height/2*0.8, length/2],
    [0, 0, length/2 + 4],
  ];
  
  const faces = [
    // Bottom
    [0, 1, 2, 3],
    // Top
    [4, 5, 6, 7],
    // Sides
    [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
    // Rear
    [0, 3, 7, 4], [1, 2, 6, 5],
    // Nose
    [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8],
    [0, 1, 8], [1, 2, 8], [2, 3, 8], [3, 0, 8],
  ];
  
  const darkColor = new THREE.Color(0x001133);
  const midColor = new THREE.Color(0x003366);
  const lightColor = new THREE.Color(0x0066aa);
  const accentColor = new THREE.Color(0x00ffff);
  
  faces.forEach((face, fi) => {
    const color = fi < 2 ? darkColor : (fi < 6 ? midColor : lightColor);
    const n = computeFaceNormal(face.map(i => v[i]));
    
    for (let i = 0; i < face.length - 2; i++) {
      const a = v[face[0]], b = v[face[i+1]], c = v[face[i+2]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
    }
  });
  
  return { positions, normals, colors };
}

function createWing(side) {
  const positions = [], normals = [], colors = [];
  const span = 12, rootChord = 6, tipChord = 2, sweep = 8, thickness = 0.5;
  const s = side;
  
  const verts = [
    [s * 1, 0, -2],
    [s * (1 + rootChord), 0, -2],
    [s * (1 + rootChord + sweep), 0, -span],
    [s * (1 + sweep), 0, -span],
    [s * 1, thickness, -2],
    [s * (1 + rootChord), thickness, -2],
    [s * (1 + rootChord + sweep), thickness, -span],
    [s * (1 + sweep), thickness, -span],
    [s * 1, -thickness, -2],
    [s * (1 + rootChord), -thickness, -2],
    [s * (1 + rootChord + sweep), -thickness, -span],
    [s * (1 + sweep), -thickness, -span],
  ];
  
  const faces = [
    [0, 1, 2, 3], [4, 7, 6, 5], [8, 11, 10, 9],
    [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
    [0, 3, 7, 4], [1, 2, 6, 5],
    [8, 9, 10, 11],
  ];
  
  const wingColor = new THREE.Color(0x002244);
  const edgeColor = new THREE.Color(0x0088ff);
  
  faces.forEach((face, fi) => {
    const color = (fi === 0 || fi === 1) ? edgeColor : wingColor;
    const n = computeFaceNormal(face.map(i => verts[i]));
    
    for (let i = 0; i < face.length - 2; i++) {
      const a = verts[face[0]], b = verts[face[i+1]], c = verts[face[i+2]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
    }
  });
  
  return { positions, normals, colors };
}

function createEngine(side) {
  const positions = [], normals = [], colors = [];
  const s = side;
  
  const radius = 1.8, length = 8;
  const segments = 6;
  
  const verts = [];
  for (let ring = 0; ring <= 1; ring++) {
    const z = ring === 0 ? -2 : -length - 2;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      verts.push([s * radius * Math.cos(angle), radius * Math.sin(angle), z]);
    }
  }
  // Exhaust center
  verts.push([0, 0, -length - 2 - 1]);
  
  const faces = [];
  // Side faces
  for (let i = 0; i < segments; i++) {
    const ni = (i + 1) % segments;
    faces.push([i, ni, ni + segments, i + segments]);
  }
  // Front cap
  for (let i = 0; i < segments - 2; i++) faces.push([0, i+1, i+2]);
  // Rear cap with exhaust
  for (let i = 0; i < segments; i++) {
    const ni = (i + 1) % segments;
    faces.push([segments + i, segments * 2, segments + ni]);
  }
  
  const engineColor = new THREE.Color(0x001133);
  const glowColor = new THREE.Color(0x00ffff);
  
  faces.forEach((face, fi) => {
    const color = fi >= segments + 1 ? glowColor : engineColor;
    const n = computeFaceNormal(face.map(i => verts[i]));
    
    if (face.length === 4) {
      for (let i = 0; i < 2; i++) {
        const a = verts[face[i===0?0:1]], b = verts[face[i===0?1:2]], c = verts[face[i===0?2:3]];
        positions.push(...a, ...b, ...c);
        normals.push(...n, ...n, ...n);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
      }
    } else {
      const a = verts[face[0]], b = verts[face[1]], c = verts[face[2]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
    }
  });
  
  return { positions, normals, colors };
}

function createCockpit() {
  const positions = [], normals = [], colors = [];
  
  const verts = [
    [-1.5, 1, 1], [1.5, 1, 1], [1, 2, -1], [-1, 2, -1],
    [-1.5, 0.5, 1], [1.5, 0.5, 1], [1, 1, -1], [-1, 1, -1],
    [0, 2.5, 0],
  ];
  
  const faces = [
    [0, 1, 2, 3], [4, 7, 6, 5],
    [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
    [0, 3, 8], [3, 2, 8], [2, 1, 8], [1, 0, 8],
  ];
  
  const glassColor = new THREE.Color(0x0088ff);
  const frameColor = new THREE.Color(0x001133);
  
  faces.forEach((face, fi) => {
    const color = fi < 2 ? glassColor : frameColor;
    const n = computeFaceNormal(face.map(i => verts[i]));
    
    if (face.length === 4) {
      for (let i = 0; i < 2; i++) {
        const a = verts[face[i===0?0:1]], b = verts[face[i===0?1:2]], c = verts[face[i===0?2:3]];
        positions.push(...a, ...b, ...c);
        normals.push(...n, ...n, ...n);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
      }
    } else {
      const a = verts[face[0]], b = verts[face[1]], c = verts[face[2]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
    }
  });
  
  return { positions, normals, colors };
}

function computeFaceNormal(verts) {
  const v0 = new THREE.Vector3(...verts[0]);
  const v1 = new THREE.Vector3(...verts[1]);
  const v2 = new THREE.Vector3(...verts[2]);
  const normal = new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(v1, v0),
    new THREE.Vector3().subVectors(v2, v0)
  ).normalize();
  return [normal.x, normal.y, normal.z];
}

function mergeGeometry(positions, normals, colors, srcPos, srcNorm, srcCol) {
  positions.push(...srcPos);
  normals.push(...srcNorm);
  colors.push(...srcCol);
}

function createEngineTrails(playerGroup) {
  const trailGeo = new THREE.BufferGeometry();
  const maxTrails = 100;
  const trailPositions = new Float32Array(maxTrails * 3);
  const trailColors = new Float32Array(maxTrails * 3);
  const trailSizes = new Float32Array(maxTrails);
  const trailAlphas = new Float32Array(maxTrails);
  const trailLifes = new Float32Array(maxTrails);
  
  for (let i = 0; i < maxTrails; i++) {
    trailAlphas[i] = 0;
    trailLifes[i] = 0;
  }
  
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
  trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));
  trailGeo.setAttribute('life', new THREE.BufferAttribute(trailLifes, 1));
  
  const trailMat = new THREE.PointsMaterial({
    size: 1,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  
  trailMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      'void main()',
      `uniform float uTime; attribute float alpha; attribute float life; varying float vAlpha; varying float vLife; void main()`
    );
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      `vAlpha = alpha; vLife = life; gl_PointSize = size * life * (1.0 + 0.5 * sin(uTime * 10.0));`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main()',
      `varying float vAlpha; varying float vLife; void main()`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha * vLife );'
    );
  };
  
  const trailLeft = new THREE.Points(trailGeo, trailMat);
  trailLeft.position.set(-6, -1, -8);
  playerGroup.add(trailLeft);
  
  const trailRight = new THREE.Points(trailGeo.clone(), trailMat);
  trailRight.position.set(6, -1, -8);
  playerGroup.add(trailRight);
  
  playerGroup.userData.trails = [trailLeft, trailRight];
  playerGroup.userData.trailData = {
    positions: [trailPositions, trailPositions.slice()],
    colors: [trailColors, trailColors.slice()],
    sizes: [trailSizes, trailSizes.slice()],
    alphas: [trailAlphas, trailAlphas.slice()],
    lifes: [trailLifes, trailLifes.slice()],
    indices: [0, 0],
  };
}

// ============ ENEMY CREATION ============
function createEnemy(type, position) {
  const config = CONFIG.enemy[type];
  const group = new THREE.Group();
  group.position.copy(position);
  
  let mesh;
  if (type === 'drone') {
    mesh = createDroneMesh(config.color, config.size);
  } else if (type === 'interceptor') {
    mesh = createInterceptorMesh(config.color, config.size);
  } else if (type === 'heavy') {
    mesh = createHeavyMesh(config.color, config.size);
  } else if (type === 'corvette') {
    mesh = createCorvetteMesh(config.color, config.size);
  }
  
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  
  // Engine glow
  const engineLight = new THREE.PointLight(config.color, 1, 20);
  engineLight.position.set(0, 0, -config.size * 1.5);
  group.add(engineLight);
  group.userData.engineLight = engineLight;
  
  // Shield effect for shielded enemies
  let shieldMesh = null;
  if (config.shield) {
    const shieldGeo = new THREE.SphereGeometry(config.size * 1.3, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    group.add(shieldMesh);
    group.userData.shieldMesh = shieldMesh;
  }
  
  const enemy = {
    mesh: group,
    type,
    hull: config.hull,
    maxHull: config.hull,
    shield: config.shield || 0,
    maxShield: config.shield || 0,
    speed: config.speed,
    turnRate: config.turnRate,
    score: config.score,
    size: config.size,
    color: config.color,
    state: 'patrol',
    target: null,
    fireCooldown: rand(0, 2),
    behaviorTimer: 0,
    lastPlayerPos: new THREE.Vector3(),
    meshRef: mesh,
    velocity: new THREE.Vector3(),
    stunned: 0,
  };
  
  group.userData.enemy = enemy;
  enemies.push(enemy);
  scene.add(group);
  
  return enemy;
}

function createDroneMesh(color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = [], normals = [], colors = [];
  
  const verts = [
    [0, size, 0], [0, -size, 0],
    [size, 0, 0], [-size, 0, 0],
    [0, 0, size], [0, 0, -size],
  ];
  
  const faces = [
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
  ];
  
  const c = new THREE.Color(color);
  const dark = c.clone().multiplyScalar(0.5);
  
  faces.forEach((face, fi) => {
    const faceColor = fi < 4 ? c : dark;
    const n = computeFaceNormal(face.map(i => verts[i]));
    const a = verts[face[0]], b = verts[face[1]], c = verts[face[2]];
    positions.push(...a, ...b, ...c);
    normals.push(...n, ...n, ...n);
    colors.push(faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b);
  });
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.7,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.3,
  });
  
  return new THREE.Mesh(geo, mat);
}

function createInterceptorMesh(color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = [], normals = [], colors = [];
  
  const length = size * 2.5, width = size * 1.5, height = size * 0.4;
  
  const verts = [
    [0, 0, length],
    [-width, 0, -length * 0.3],
    [width, 0, -length * 0.3],
    [-width * 1.5, 0, -length],
    [width * 1.5, 0, -length],
    [0, height, -length * 0.2],
    [0, -height, -length * 0.2],
  ];
  
  const faces = [
    [0, 2, 5], [0, 5, 1],
    [2, 4, 5], [1, 5, 3],
    [0, 6, 2], [0, 1, 6],
    [2, 6, 4], [1, 3, 6],
    [1, 3, 5], [2, 5, 4],
    [1, 6, 3], [2, 4, 6],
    [3, 6, 4],
  ];
  
  const c = new THREE.Color(color);
  const dark = c.clone().multiplyScalar(0.6);
  const light = c.clone().lerp(new THREE.Color(0xffffff), 0.3);
  
  faces.forEach((face, fi) => {
    let faceColor = c;
    if (fi < 2) faceColor = light;
    else if (fi < 6) faceColor = c;
    else if (fi < 10) faceColor = dark;
    else faceColor = c;
    
    const n = computeFaceNormal(face.map(i => verts[i]));
    for (let i = 0; i < face.length - 2; i++) {
      const a = verts[face[0]], b = verts[face[i+1]], c = verts[face[i+2]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b);
    }
  });
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.8,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.4,
  });
  
  return new THREE.Mesh(geo, mat);
}

function createHeavyMesh(color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = [], normals = [], colors = [];
  
  const w = size, h = size * 0.6, l = size * 1.8;
  
  const verts = [
    [-w, -h, l*0.3], [w, -h, l*0.3], [w, h, l*0.3], [-w, h, l*0.3],
    [-w*0.7, -h, -l*0.2], [w*0.7, -h, -l*0.2], [w*0.7, h, -l*0.2], [-w*0.7, h, -l*0.2],
    [-w*0.5, -h*0.8, -l*0.2], [w*0.5, -h*0.8, -l*0.2], [w*0.5, h*0.8, -l*0.2], [-w*0.5, h*0.8, -l*0.2],
    [-w*0.5, -h*0.8, -l], [w*0.5, -h*0.8, -l], [w*0.5, h*0.8, -l], [-w*0.5, h*0.8, -l],
  ];
  
  const faces = [
    [0,1,2,3], [4,7,6,5], [8,11,10,9], [12,13,14,15],
    [0,4,5,1], [1,5,6,2], [2,6,7,3], [3,7,4,0],
    [4,8,9,5], [5,9,10,6], [6,10,11,7], [7,11,8,4],
    [8,12,13,9], [9,13,14,10], [10,14,15,11], [11,15,12,8],
  ];
  
  const c = new THREE.Color(color);
  const dark = c.clone().multiplyScalar(0.5);
  const light = c.clone().lerp(new THREE.Color(0xffffff), 0.2);
  
  faces.forEach((face, fi) => {
    let faceColor = fi % 2 === 0 ? c : dark;
    if (fi >= 16) faceColor = light;
    const n = computeFaceNormal(face.map(i => verts[i]));
    for (let i = 0; i < 2; i++) {
      const a = verts[face[i===0?0:1]], b = verts[face[i===0?1:2]], c = verts[face[i===0?2:3]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b);
    }
  });
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.6,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.2,
  });
  
  return new THREE.Mesh(geo, mat);
}

function createCorvetteMesh(color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = [], normals = [], colors = [];
  
  const sections = [
    { w: size*1.2, h: size*0.8, l: size*2, z: size*1.5 },
    { w: size*1.5, h: size*0.6, l: size*3, z: -size*0.5 },
    { w: size*2, h: size*0.4, l: size*2, z: -size*3 },
  ];
  
  let vertOffset = 0;
  const allVerts = [];
  const sectionFaces = [];
  
  sections.forEach((sec, si) => {
    const { w, h, l, z } = sec;
    const verts = [
      [-w, -h, z + l], [w, -h, z + l], [w, h, z + l], [-w, h, z + l],
      [-w, -h, z - l], [w, -h, z - l], [w, h, z - l], [-w, h, z - l],
    ].map(v => { allVerts.push(v); return vertOffset++; });
    
    const faces = [
      [0,1,2,3], [4,7,6,5],
      [0,4,5,1], [1,5,6,2], [2,6,7,3], [3,7,4,0],
    ].map(f => f.map(i => i + vertOffset - 8));
    sectionFaces.push(...faces);
  });
  
  const c = new THREE.Color(color);
  const dark = c.clone().multiplyScalar(0.5);
  const light = c.clone().lerp(new THREE.Color(0xffffff), 0.15);
  
  sectionFaces.forEach((face, fi) => {
    let faceColor = fi % 4 === 0 ? light : (fi % 2 === 0 ? c : dark);
    const n = computeFaceNormal(face.map(i => allVerts[i]));
    for (let i = 0; i < 2; i++) {
      const a = allVerts[face[i===0?0:1]], b = allVerts[face[i===0?1:2]], c = allVerts[face[i===0?2:3]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b, faceColor.r, faceColor.g, faceColor.b);
    }
  });
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.6,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.15,
  });
  
  return new THREE.Mesh(geo, mat);
}

// ============ PROJECTILES ============
function fireLaser() {
  if (player.laserCooldown > 0 || player.energy < CONFIG.laser.laserCost) return;
  
  player.laserCooldown = CONFIG.laser.fireRate;
  player.energy -= CONFIG.laser.laserCost;
  SFX.playLaser();
  
  const hardpoints = playerGroup.userData.hardpoints;
  hardpoints.forEach((hp, i) => {
    const worldPos = new THREE.Vector3();
    hp.getWorldPosition(worldPos);
    const worldDir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
    
    const spread = new THREE.Vector3(
      rand(-CONFIG.laser.spread, CONFIG.laser.spread),
      rand(-CONFIG.laser.spread, CONFIG.laser.spread),
      0
    ).applyQuaternion(playerGroup.quaternion);
    worldDir.add(spread).normalize();
    
    createLaserBolt(worldPos, worldDir, i);
  });
  
  // Muzzle flash
  createMuzzleFlash(hardpoints[0].getWorldPosition(new THREE.Vector3()));
  createMuzzleFlash(hardpoints[1].getWorldPosition(new THREE.Vector3()));
}

function createLaserBolt(position, direction, side) {
  const geo = new THREE.CylinderGeometry(0.1, 0.15, 8, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: CONFIG.laser.color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  mesh.rotateX(Math.PI / 2);
  
  // Glow
  const glowGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({
    color: CONFIG.laser.glowColor,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  mesh.add(glow);
  
  // Point light
  const light = new THREE.PointLight(CONFIG.laser.color, 1, 10);
  mesh.add(light);
  
  scene.add(mesh);
  
  projectiles.push({
    mesh,
    position: position.clone(),
    velocity: direction.clone().multiplyScalar(CONFIG.laser.speed),
    damage: CONFIG.laser.damage,
    life: CONFIG.laser.range / CONFIG.laser.speed,
    maxLife: CONFIG.laser.range / CONFIG.laser.speed,
  });
}

function fireMissile() {
  if (player.missileCooldown > 0 || player.missileAmmo <= 0) return;
  
  player.missileCooldown = 0.5;
  player.missileAmmo--;
  SFX.playMissile();
  updateHUD();
  
  const bays = playerGroup.userData.missileBays;
  const bay = bays[missiles.length % 2];
  const worldPos = new THREE.Vector3();
  bay.getWorldPosition(worldPos);
  const worldDir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
  
  createMissile(worldPos, worldDir);
}

function createMissile(position, direction) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  group.rotateX(Math.PI / 2);
  
  // Missile body
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.5, 6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x221100,
    roughness: 0.5,
    metalness: 0.7,
    emissive: new THREE.Color(0x331100),
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);
  
  // Fins
  for (let i = 0; i < 4; i++) {
    const finGeo = new THREE.BufferGeometry();
    const positions = [], normals = [], colors = [];
    const angle = (i / 4) * Math.PI * 2;
    const verts = [
      [0, 0, 0], [0, 0.6, 0], [0.8 * Math.cos(angle), 0, 0.8 * Math.sin(angle)],
      [0, 0, -0.5], [0, 0.6, -0.5], [0.8 * Math.cos(angle), -0.5, 0.8 * Math.sin(angle)],
    ];
    const faces = [[0,1,2], [3,5,4]];
    faces.forEach(face => {
      const n = computeFaceNormal(face.map(i => verts[i]));
      const a = verts[face[0]], b = verts[face[1]], c = verts[face[2]];
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      colors.push(0.2, 0.1, 0, 0.2, 0.1, 0, 0.2, 0.1, 0);
    });
    finGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    finGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    finGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const fin = new THREE.Mesh(finGeo, bodyMat);
    group.add(fin);
  }
  
  // Engine glow
  const engineLight = new THREE.PointLight(0xff6600, 2, 15);
  engineLight.position.set(0, 0, -1.5);
  group.add(engineLight);
  
  // Trail particles
  const trailGeo = new THREE.BufferGeometry();
  const maxTrail = 30;
  const trailPositions = new Float32Array(maxTrail * 3);
  const trailColors = new Float32Array(maxTrail * 3);
  const trailSizes = new Float32Array(maxTrail);
  const trailAlphas = new Float32Array(maxTrail);
  
  for (let i = 0; i < maxTrail; i++) trailAlphas[i] = 0;
  
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
  trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));
  
  const trailMat = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  
  const trail = new THREE.Points(trailGeo, trailMat);
  trail.position.set(0, 0, -1.5);
  group.add(trail);
  
  scene.add(group);
  
  missiles.push({
    mesh: group,
    position: position.clone(),
    velocity: direction.clone().multiplyScalar(CONFIG.missile.speed),
    direction: direction.clone(),
    target: null,
    damage: CONFIG.missile.damage,
    life: CONFIG.missile.range / CONFIG.missile.speed,
    maxLife: CONFIG.missile.range / CONFIG.missile.speed,
    trail,
    trailData: { positions: trailPositions, colors: trailColors, sizes: trailSizes, alphas: trailAlphas, index: 0 },
    engineLight,
  });
  
  // Find target
  acquireMissileTarget(missiles[missiles.length - 1]);
}

function acquireMissileTarget(missile) {
  let closest = null, closestDist = Infinity;
  enemies.forEach(e => {
    if (e.hull <= 0) return;
    const dist = missile.position.distanceTo(e.mesh.position);
    if (dist < closestDist && dist < 300) {
      closestDist = dist;
      closest = e;
    }
  });
  missile.target = closest;
}

function fireEMP() {
  if (player.empCooldown > 0 || player.empCharges <= 0) return;
  
  player.empCooldown = CONFIG.player.empCooldown;
  player.empCharges--;
  updateHUD();
  SFX.playEMP();
  
  // EMP effect
  createEMPEffect(playerGroup.position.clone());
  
  // Damage/stun enemies in radius
  enemies.forEach(e => {
    if (e.hull <= 0) return;
    const dist = e.mesh.position.distanceTo(playerGroup.position);
    if (dist < CONFIG.player.empRadius) {
      e.stunned = CONFIG.player.empDuration;
      e.shield = Math.max(0, e.shield - 20);
      if (e.shieldMesh) {
        e.shieldMesh.material.opacity = 0.4;
        setTimeout(() => { if (e.shieldMesh) e.shieldMesh.material.opacity = 0.15; }, 200);
      }
    }
  });
  
  // Clear enemy projectiles in radius
  projectiles.forEach((p, i) => {
    if (p.position.distanceTo(playerGroup.position) < CONFIG.player.empRadius) {
      createExplosion(p.position, 0x00ffff, 2);
      projectiles.splice(i, 1);
      scene.remove(p.mesh);
    }
  });
  missiles.forEach((m, i) => {
    if (m.position.distanceTo(playerGroup.position) < CONFIG.player.empRadius) {
      createExplosion(m.position, 0xff6600, 3);
      missiles.splice(i, 1);
      scene.remove(m.mesh);
    }
  });
}

function createEMPEffect(position) {
  // Expanding ring
  const ringGeo = new THREE.RingGeometry(0.1, 0.5, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(position);
  ring.lookAt(camera.position);
  scene.add(ring);
  
  const sphereGeo = new THREE.SphereGeometry(0.1, 16, 12);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(position);
  scene.add(sphere);
  
  // Shockwave particles
  for (let i = 0; i < 50; i++) {
    const pGeo = new THREE.SphereGeometry(rand(0.2, 0.8), 6, 4);
    const pMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.55, 1, 0.5 + rand(0, 0.3)),
      transparent: true,
      opacity: rand(0.5, 1),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(pGeo, pMat);
    particle.position.copy(position);
    particle.userData = {
      velocity: new THREE.Vector3(
        rand(-1, 1), rand(-1, 1), rand(-1, 1)
      ).normalize().multiplyScalar(rand(30, 60)),
      life: rand(0.5, 1.5),
      maxLife: rand(0.5, 1.5),
    };
    scene.add(particle);
    particles.push({ mesh: particle, ...particle.userData });
  }
  
  // Animate ring/sphere
  const startTime = performance.now() / 1000;
  function animateEMP() {
    const elapsed = performance.now() / 1000 - startTime;
    const progress = elapsed / 1.5;
    
    if (progress >= 1) {
      scene.remove(ring); ring.geometry.dispose(); ring.material.dispose();
      scene.remove(sphere); sphere.geometry.dispose(); sphere.material.dispose();
      return;
    }
    
    const scale = 1 + progress * CONFIG.player.empRadius * 2;
    ring.scale.setScalar(scale);
    ring.material.opacity = 0.8 * (1 - progress);
    
    sphere.scale.setScalar(scale * 0.5);
    sphere.material.opacity = 0.6 * (1 - progress);
    
    requestAnimationFrame(animateEMP);
  }
  animateEMP();
  
  // Screen shake
  screenShake(15);
  flashScreen(0.6, 0x00ffff);
}

function createMuzzleFlash(position) {
  const flashGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.copy(position);
  scene.add(flash);
  
  const start = performance.now();
  function animateFlash() {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed > 0.05) {
      scene.remove(flash);
      flash.geometry.dispose();
      flash.material.dispose();
      return;
    }
    flash.scale.setScalar(1 + elapsed * 20);
    flash.material.opacity = 1 - elapsed * 20;
    requestAnimationFrame(animateFlash);
  }
  animateFlash();
}

// ============ ENEMY AI ============
function updateEnemies(dt) {
  const playerPos = playerGroup.position;
  
  enemies.forEach((enemy, i) => {
    if (enemy.hull <= 0) return;
    
    if (enemy.stunned > 0) {
      enemy.stunned -= dt;
      return;
    }
    
    const toPlayer = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position);
    const dist = toPlayer.length();
    const config = CONFIG.enemy[enemy.type];
    
    // State machine
    switch (enemy.state) {
      case 'patrol':
        if (dist < 400) {
          enemy.state = 'engage';
          enemy.behaviorTimer = rand(2, 5);
        } else {
          enemy.behaviorTimer -= dt;
          if (enemy.behaviorTimer <= 0) {
            enemy.target = new THREE.Vector3(
              enemy.mesh.position.x + rand(-100, 100),
              enemy.mesh.position.y + rand(-50, 50),
              enemy.mesh.position.z + rand(-100, 100)
            );
            enemy.behaviorTimer = rand(3, 8);
          }
          if (enemy.target) {
            const toTarget = new THREE.Vector3().subVectors(enemy.target, enemy.mesh.position);
            if (toTarget.length() > 5) {
              steerTowards(enemy, toTarget.normalize(), dt);
            }
          }
        }
        break;
        
      case 'engage':
        enemy.lastPlayerPos.copy(playerPos);
        
        if (dist > 500) {
          enemy.state = 'patrol';
          break;
        }
        
        // Determine attack pattern based on type
        if (enemy.type === 'drone') {
          if (dist > 50) steerTowards(enemy, toPlayer.normalize(), dt);
          else strafeAround(enemy, playerPos, dt);
        } else if (enemy.type === 'interceptor') {
          if (dist > 150) steerTowards(enemy, toPlayer.normalize(), dt);
          else if (dist < 80) steerAway(enemy, toPlayer.normalize(), dt);
          else strafeAround(enemy, playerPos, dt);
        } else if (enemy.type === 'heavy') {
          if (dist > 200) steerTowards(enemy, toPlayer.normalize(), dt);
          else broadside(enemy, playerPos, dt);
        } else if (enemy.type === 'corvette') {
          if (dist > 300) steerTowards(enemy, toPlayer.normalize(), dt);
          else if (dist < 200) steerAway(enemy, toPlayer.normalize(), dt);
          else holdPosition(enemy, dt);
        }
        
        // Fire weapons
        enemy.fireCooldown -= dt;
        if (enemy.fireCooldown <= 0 && dist < 350 && canSeePlayer(enemy)) {
          enemyFire(enemy);
          enemy.fireCooldown = enemy.type === 'drone' ? rand(0.8, 1.5) :
                              enemy.type === 'interceptor' ? rand(0.5, 1) :
                              enemy.type === 'heavy' ? rand(1.5, 2.5) : rand(0.3, 0.6);
        }
        break;
        
      case 'flee':
        steerAway(enemy, toPlayer.normalize(), dt);
        if (dist > 600) enemy.state = 'patrol';
        break;
    }
    
    // Apply velocity
    enemy.mesh.position.addScaledVector(enemy.velocity, dt);
    
    // Clamp to bounds
    const bounds = CONFIG.world.bounds;
    enemy.mesh.position.x = clamp(enemy.mesh.position.x, -bounds, bounds);
    enemy.mesh.position.y = clamp(enemy.mesh.position.y, -bounds * 0.5, bounds * 0.5);
    enemy.mesh.position.z = clamp(enemy.mesh.position.z, -bounds, bounds);
    
    // Update engine light
    if (enemy.userData.engineLight) {
      enemy.userData.engineLight.intensity = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 10);
    }
    
    // Shield pulse
    if (enemy.shieldMesh) {
      enemy.shieldMesh.material.opacity = 0.15 + 0.05 * Math.sin(performance.now() / 1000 * 5);
      enemy.shieldMesh.scale.setScalar(1 + 0.02 * Math.sin(performance.now() / 1000 * 3));
    }
  });
}

function steerTowards(enemy, direction, dt) {
  const targetQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), direction
  );
  enemy.mesh.quaternion.slerp(targetQuat, enemy.turnRate * dt);
  
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
  enemy.velocity.lerp(forward.multiplyScalar(enemy.speed), 5 * dt);
}

function steerAway(enemy, direction, dt) {
  const away = direction.clone().negate();
  const targetQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), away
  );
  enemy.mesh.quaternion.slerp(targetQuat, enemy.turnRate * dt);
  
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
  enemy.velocity.lerp(forward.multiplyScalar(enemy.speed), 5 * dt);
}

function strafeAround(enemy, playerPos, dt) {
  const toPlayer = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position);
  const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
  const targetDir = toPlayer.clone().add(side.multiplyScalar(rand(-1, 1) > 0 ? 1 : -1)).normalize();
  
  const targetQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), targetDir
  );
  enemy.mesh.quaternion.slerp(targetQuat, enemy.turnRate * dt);
  
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
  enemy.velocity.lerp(forward.multiplyScalar(enemy.speed * 0.7), 5 * dt);
}

function broadside(enemy, playerPos, dt) {
  const toPlayer = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position);
  const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
  const targetDir = side.multiplyScalar(enemy.mesh.position.x > playerPos.x ? 1 : -1);
  
  const targetQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), targetDir
  );
  enemy.mesh.quaternion.slerp(targetQuat, enemy.turnRate * dt * 0.5);
  
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
  enemy.velocity.lerp(forward.multiplyScalar(enemy.speed * 0.3), 5 * dt);
}

function holdPosition(enemy, dt) {
  enemy.velocity.lerp(new THREE.Vector3(), 3 * dt);
}

function canSeePlayer(enemy) {
  const toPlayer = new THREE.Vector3().subVectors(playerGroup.position, enemy.mesh.position);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
  return toPlayer.normalize().dot(forward) > 0.7;
}

function enemyFire(enemy) {
  const config = CONFIG.enemy[enemy.type];
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
  const pos = enemy.mesh.position.clone().add(forward.multiplyScalar(enemy.size * 2));
  
  if (enemy.type === 'corvette') {
    for (let i = 0; i < 4; i++) {
      const spread = new THREE.Vector3(
        rand(-0.15, 0.15), rand(-0.15, 0.15), 0
      ).applyQuaternion(enemy.mesh.quaternion);
      const dir = forward.clone().add(spread).normalize();
      createEnemyProjectile(pos, dir, config.color, 12, 150, 200);
    }
  } else {
    const spread = enemy.type === 'heavy' ? 0.1 : 0.05;
    const dir = forward.clone().add(new THREE.Vector3(
      rand(-spread, spread), rand(-spread, spread), 0
    ).applyQuaternion(enemy.mesh.quaternion)).normalize();
    createEnemyProjectile(pos, dir, config.color, 
      enemy.type === 'drone' ? 8 : enemy.type === 'interceptor' ? 15 : 25,
      enemy.type === 'drone' ? 180 : enemy.type === 'interceptor' ? 250 : 200,
      250
    );
  }
}

function createEnemyProjectile(position, direction, color, damage, speed, range) {
  const geo = new THREE.CylinderGeometry(0.15, 0.2, 6, 6);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  mesh.rotateX(Math.PI / 2);
  
  const glowGeo = new THREE.SphereGeometry(0.4, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  mesh.add(glow);
  
  const light = new THREE.PointLight(color, 0.8, 8);
  mesh.add(light);
  
  scene.add(mesh);
  
  projectiles.push({
    mesh,
    position: position.clone(),
    velocity: direction.clone().multiplyScalar(speed),
    damage,
    life: range / speed,
    maxLife: range / speed,
    isEnemy: true,
  });
}

// ============ PROJECTILE UPDATES ============
function updateProjectiles(dt) {
  // Player lasers
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.position.addScaledVector(p.velocity, dt);
    p.mesh.position.copy(p.position);
    p.life -= dt;
    
    // Check enemy collision
    if (!p.isEnemy) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.hull <= 0) continue;
        if (p.position.distanceTo(e.mesh.position) < e.size * 1.5) {
          damageEnemy(e, p.damage, p.position);
          createHitEffect(p.position, e.color);
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
          break;
        }
      }
    } else {
      // Enemy projectile vs player
      if (player.invulnerable <= 0 && p.position.distanceTo(playerGroup.position) < 4) {
        damagePlayer(p.damage);
        createHitEffect(p.position, p.mesh.material.color);
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
    
    if (p.life <= 0 && projectiles.includes(p)) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
  
  // Missiles
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    
    // Update target
    if (m.target && (m.target.hull <= 0 || m.position.distanceTo(m.target.mesh.position) > 400)) {
      acquireMissileTarget(m);
    }
    
    if (m.target) {
      const toTarget = new THREE.Vector3().subVectors(m.target.mesh.position, m.position).normalize();
      m.direction.lerp(toTarget, CONFIG.missile.turnRate * dt);
      m.velocity.copy(m.direction).multiplyScalar(CONFIG.missile.speed);
    }
    
    m.position.addScaledVector(m.velocity, dt);
    m.mesh.position.copy(m.position);
    m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.direction.clone().negate());
    m.mesh.rotateX(Math.PI / 2);
    
    // Update trail
    updateMissileTrail(m, dt);
    
    // Check collision
    if (m.target) {
      if (m.position.distanceTo(m.target.mesh.position) < m.target.size * 1.5) {
        damageEnemy(m.target, m.damage, m.position);
        createExplosion(m.position, 0xff6600, 5);
        scene.remove(m.mesh);
        missiles.splice(i, 1);
        continue;
      }
    }
    
    m.life -= dt;
    if (m.life <= 0) {
      createExplosion(m.position, 0xff6600, 3);
      scene.remove(m.mesh);
      missiles.splice(i, 1);
    }
  }
}

function updateMissileTrail(missile, dt) {
  const data = missile.trailData;
  const pos = missile.mesh.position.clone();
  pos.add(new THREE.Vector3(0, 0, 1.5).applyQuaternion(missile.mesh.quaternion));
  
  data.positions[data.index * 3] = pos.x;
  data.positions[data.index * 3 + 1] = pos.y;
  data.positions[data.index * 3 + 2] = pos.z;
  
  const life = 1 - missile.life / missile.maxLife;
  const color = new THREE.Color().setHSL(0.08, 1, 0.3 + life * 0.4);
  data.colors[data.index * 3] = color.r;
  data.colors[data.index * 3 + 1] = color.g;
  data.colors[data.index * 3 + 2] = color.b;
  
  data.sizes[data.index] = rand(0.3, 0.8);
  data.alphas[data.index] = 1;
  
  data.index = (data.index + 1) % 30;
  
  // Fade old trail points
  for (let i = 0; i < 30; i++) {
    data.alphas[i] *= 0.95;
    if (data.alphas[i] < 0.01) data.alphas[i] = 0;
  }
  
  missile.trail.geometry.attributes.position.needsUpdate = true;
  missile.trail.geometry.attributes.color.needsUpdate = true;
  missile.trail.geometry.attributes.size.needsUpdate = true;
  missile.trail.geometry.attributes.alpha.needsUpdate = true;
}

// ============ DAMAGE & EFFECTS ============
function damageEnemy(enemy, damage, position) {
  let actualDamage = damage;
  
  if (enemy.shield > 0) {
    enemy.shield = Math.max(0, enemy.shield - damage * 0.5);
    actualDamage = damage * 0.5;
    if (enemy.shieldMesh) {
      enemy.shieldMesh.material.opacity = 0.5;
      setTimeout(() => { if (enemy.shieldMesh) enemy.shieldMesh.material.opacity = 0.15; }, 100);
    }
  }
  
  enemy.hull -= actualDamage;
  
  // Damage number
  createDamageNumber(position, actualDamage, enemy.color);
  
  if (enemy.hull <= 0) {
    destroyEnemy(enemy);
  }
}

function destroyEnemy(enemy) {
  addScore(enemy.score);
  kills++;
  createExplosion(enemy.mesh.position, enemy.color, enemy.size);
  SFX.playExplosion();
  createDebris(enemy.mesh.position, enemy.mesh.rotation, enemy.color, enemy.size);
  
  // Power-up drop
  if (Math.random() < CONFIG.powerup.spawnChance) {
    spawnPowerup(enemy.mesh.position);
  }
  
  // Remove from scene
  scene.remove(enemy.mesh);
  enemy.mesh.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  
  enemies = enemies.filter(e => e !== enemy);
  enemiesRemaining--;
  checkWaveComplete();
}

function damagePlayer(damage) {
  if (player.invulnerable > 0) return;
  
  let actualDamage = damage;
  
  if (player.shield > 0) {
    player.shield = Math.max(0, player.shield - damage);
    actualDamage = 0;
    screenShake(5);
    flashScreen(0.3, 0x00ffff);
    SFX.playHit();
  } else {
    player.hull -= damage;
    player.invulnerable = 1;
    screenShake(12);
    flashScreen(0.5, 0xff0000);
    SFX.playExplosion();
    
    playerGroup.userData.shipMesh.material.emissiveIntensity = 1;
    setTimeout(() => { playerGroup.userData.shipMesh.material.emissiveIntensity = 0.3; }, 200);
  }
  
  createDamageNumber(playerGroup.position.clone().add(new THREE.Vector3(0, 3, 0)), actualDamage, 0xff0000);
  
  updateHUD();
  
  if (player.hull <= 0) {
    gameOverSequence();
  }
}

function createExplosion(position, color, scale) {
  const c = new THREE.Color(color);
  
  // Main flash
  const flashGeo = new THREE.SphereGeometry(scale * 0.5, 16, 12);
  const flashMat = new THREE.MeshBasicMaterial({
    color: c.clone().lerp(new THREE.Color(0xffffff), 0.5),
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.copy(position);
  scene.add(flash);
  
  // Shockwave ring
  const ringGeo = new THREE.RingGeometry(scale * 0.3, scale * 0.5, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: c,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(position);
  ring.lookAt(camera.position);
  scene.add(ring);
  
  // Particles
  const particleCount = Math.floor(30 * scale);
  for (let i = 0; i < particleCount; i++) {
    const pGeo = new THREE.SphereGeometry(rand(0.1, 0.5) * scale, 6, 4);
    const pMat = new THREE.MeshBasicMaterial({
      color: c.clone().lerp(new THREE.Color(0xffffff), rand(0, 0.5)),
      transparent: true,
      opacity: rand(0.5, 1),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(pGeo, pMat);
    particle.position.copy(position);
    particle.userData = {
      velocity: new THREE.Vector3(
        rand(-1, 1), rand(-1, 1), rand(-1, 1)
      ).normalize().multiplyScalar(rand(10, 40) * scale),
      life: rand(0.3, 1.5),
      maxLife: rand(0.3, 1.5),
    };
    scene.add(particle);
    particles.push({ mesh: particle, ...particle.userData });
  }
  
  // Animate
  const startTime = performance.now() / 1000;
  function animateExplosion() {
    const elapsed = performance.now() / 1000 - startTime;
    const progress = elapsed / 0.8;
    
    if (progress >= 1) {
      scene.remove(flash); flash.geometry.dispose(); flash.material.dispose();
      scene.remove(ring); ring.geometry.dispose(); ring.material.dispose();
      return;
    }
    
    const s = 1 + progress * 3;
    flash.scale.setScalar(s);
    flash.material.opacity = 1 - progress;
    
    ring.scale.setScalar(s * 1.5);
    ring.material.opacity = 0.8 * (1 - progress);
    
    requestAnimationFrame(animateExplosion);
  }
  animateExplosion();
  
  screenShake(3 * scale);
}

function createHitEffect(position, color) {
  const geo = new THREE.RingGeometry(0.5, 1.5, 32);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.copy(position);
  ring.lookAt(camera.position);
  scene.add(ring);
  
  const start = performance.now();
  function animate() {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed > 0.3) {
      scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
      return;
    }
    ring.scale.setScalar(1 + elapsed * 5);
    ring.material.opacity = 0.8 * (1 - elapsed / 0.3);
    requestAnimationFrame(animate);
  }
  animate();
}

function createDamageNumber(position, damage, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px Orbitron, monospace';
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = Math.ceil(damage).toString();
  ctx.strokeText(text, 64, 32);
  ctx.fillText(text, 64, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.copy(position);
  sprite.scale.set(4, 2, 1);
  scene.add(sprite);
  
  const start = performance.now();
  const startY = position.y;
  function animate() {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed > 1.5) {
      scene.remove(sprite);
      sprite.material.map.dispose();
      sprite.material.dispose();
      return;
    }
    sprite.position.y = startY + elapsed * 5;
    sprite.material.opacity = 1 - elapsed / 1.5;
    sprite.scale.setScalar(1 + elapsed * 0.5);
    requestAnimationFrame(animate);
  }
  animate();
}

function createDebris(position, rotation, color, scale) {
  const count = Math.floor(8 * scale);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.TetrahedronGeometry(rand(0.3, 1) * scale, 0);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.5,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.userData = {
      velocity: new THREE.Vector3(
        rand(-1, 1), rand(-1, 1), rand(-1, 1)
      ).normalize().multiplyScalar(rand(5, 30)),
      rotationSpeed: new THREE.Vector3(
        rand(-2, 2), rand(-2, 2), rand(-2, 2)
      ),
      life: CONFIG.world.debrisLifetime,
    };
    scene.add(mesh);
    debris.push({ mesh, ...mesh.userData });
  }
}

function spawnPowerup(position) {
  const type = CONFIG.powerup.types[randInt(0, CONFIG.powerup.types.length - 1)];
  const colors = {
    hull: 0xff0000, shield: 0x00ffff, energy: 0xff00ff,
    missile: 0xff8800, emp: 0xffff00, overdrive: 0xffffff,
  };
  const icons = { hull: '+', shield: '⬢', energy: '⚡', missile: '🚀', emp: '⚡', overdrive: '★' };
  
  const geo = new THREE.OctahedronGeometry(CONFIG.powerup.size, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: colors[type],
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  scene.add(mesh);
  
  powerups.push({
    mesh,
    type,
    position: position.clone(),
    rotation: new THREE.Euler(0, 0, 0),
    life: CONFIG.powerup.lifetime,
    bobOffset: rand(0, Math.PI * 2),
  });
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.life -= dt;
    p.rotation.y += dt;
    p.mesh.rotation.copy(p.rotation);
    p.mesh.position.y = p.position.y + Math.sin(performance.now() / 1000 * 2 + p.bobOffset) * 0.5;
    
    // Pulse
    const pulse = 1 + 0.2 * Math.sin(performance.now() / 1000 * 5);
    p.mesh.scale.setScalar(pulse);
    
    // Check pickup
    if (playerGroup.position.distanceTo(p.mesh.position) < 5) {
      applyPowerup(p.type);
      createPickupEffect(p.mesh.position, p.mesh.material.color);
      scene.remove(p.mesh);
      powerups.splice(i, 1);
      continue;
    }
    
    if (p.life <= 0) {
      scene.remove(p.mesh);
      powerups.splice(i, 1);
    }
  }
}

function applyPowerup(type) {
  SFX.playPickup();
  switch (type) {
    case 'hull':
      player.hull = Math.min(player.maxHull, player.hull + 30);
      showMsg('HULL REPAIRED +30', 'success');
      break;
    case 'shield':
      player.shield = Math.min(player.maxShield, player.shield + 50);
      showMsg('SHIELD BOOST +50', 'success');
      break;
    case 'energy':
      player.energy = Math.min(player.maxEnergy, player.energy + 50);
      showMsg('ENERGY CELL +50', 'success');
      break;
    case 'missile':
      player.missileAmmo = Math.min(12, player.missileAmmo + 3);
      showMsg('MISSILE RACK +3', 'success');
      break;
    case 'emp':
      player.empCharges = Math.min(5, player.empCharges + 1);
      showMsg('EMP CHARGE +1', 'success');
      break;
    case 'overdrive':
      player.invulnerable = 10;
      player.maxHull = player.hull;
      showMsg('OVERDRIVE ACTIVATED!', 'success');
      screenShake(10);
      flashScreen(0.8, 0xffff00);
      break;
  }
  updateHUD();
}

function createPickupEffect(position, color) {
  for (let i = 0; i < 15; i++) {
    const geo = new THREE.SphereGeometry(rand(0.2, 0.5), 6, 4);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.userData = {
      velocity: new THREE.Vector3(rand(-1,1), rand(-1,1), rand(-1,1)).normalize().multiplyScalar(rand(10, 20)),
      life: rand(0.5, 1),
    };
    scene.add(mesh);
    particles.push({ mesh, ...mesh.userData });
  }
}

function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;
    d.mesh.position.addScaledVector(d.velocity, dt);
    d.mesh.rotation.x += d.rotationSpeed.x * dt;
    d.mesh.rotation.y += d.rotationSpeed.y * dt;
    d.mesh.rotation.z += d.rotationSpeed.z * dt;
    d.velocity.multiplyScalar(0.98);
    
    if (d.life <= 0) {
      scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
      debris.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.velocity.multiplyScalar(0.95);
    
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function updatePlayerTrails(dt) {
  const data = playerGroup.userData.trailData;
  const trails = playerGroup.userData.trails;
  const engineLights = playerGroup.userData.engineLights;
  const thrust = player.boost ? 1 : player.thrust;
  
  for (let engine = 0; engine < 2; engine++) {
    const trail = trails[engine];
    const pos = trail.position.clone();
    pos.applyMatrix4(playerGroup.matrixWorld);
    
    const positions = data.positions[engine];
    const colors = data.colors[engine];
    const sizes = data.sizes[engine];
    const alphas = data.alphas[engine];
    const lifes = data.lifes[engine];
    const index = data.indices[engine];
    
    // Add new trail point
    if (thrust > 0.1 || player.boost) {
      positions[index * 3] = pos.x;
      positions[index * 3 + 1] = pos.y;
      positions[index * 3 + 2] = pos.z;
      
      const color = new THREE.Color(player.boost ? 0xffffff : 0x00ffff);
      color.lerp(new THREE.Color(0xff6600), player.boost ? 0.5 : 0);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      
      sizes[index] = rand(0.5, 1.5) * thrust;
      alphas[index] = 1;
      lifes[index] = 1;
    } else {
      alphas[index] = 0;
    }
    
    data.indices[engine] = (index + 1) % 100;
    
    // Fade old points
    for (let i = 0; i < 100; i++) {
      lifes[i] *= 0.92;
      alphas[i] = Math.max(0, alphas[i] * 0.95);
    }
    
    // Update engine lights
    if (engineLights[engine]) {
      engineLights[engine].intensity = player.boost ? 4 : (1 + thrust * 2);
      engineLights[engine].color.setHSL(0.55, 1, player.boost ? 0.8 : 0.5);
    }
    
    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.attributes.color.needsUpdate = true;
    trail.geometry.attributes.size.needsUpdate = true;
    trail.geometry.attributes.alpha.needsUpdate = true;
    trail.geometry.attributes.life.needsUpdate = true;
  }
}

// ============ WAVE MANAGEMENT ============
function startWave() {
  const weights = CONFIG.waves.typeWeights[Math.min(wave, 5)] || CONFIG.waves.typeWeights[5];
  const enemyCount = Math.min(CONFIG.waves.baseEnemies + (wave - 1) * CONFIG.waves.enemyIncrease, CONFIG.waves.maxEnemies);
  enemiesRemaining = enemyCount;
  
  const types = Object.keys(weights);
  const cumulative = [];
  let sum = 0;
  types.forEach(t => { sum += weights[t]; cumulative.push({ type: t, weight: sum }); });
  
  for (let i = 0; i < enemyCount; i++) {
    const r = rand(0, sum);
    let selectedType = 'drone';
    for (const c of cumulative) {
      if (r < c.weight) { selectedType = c.type; break; }
    }
    
    // Spawn around player at distance
    const angle = rand(0, Math.PI * 2);
    const dist = rand(200, 400);
    const height = rand(-100, 100);
    const pos = new THREE.Vector3(
      playerGroup.position.x + Math.cos(angle) * dist,
      playerGroup.position.y + height,
      playerGroup.position.z + Math.sin(angle) * dist
    );
    
    setTimeout(() => {
      createEnemy(selectedType, pos);
    }, i * 300);
  }
  
  waveNum.textContent = `WAVE ${wave}`;
  waveNum.parentElement.querySelector('.waveLabel').textContent = `SECTOR ${sector}`;
  showMsg(`WAVE ${wave} - ENGAGE!`, 'warning');
  SFX.playWaveStart();
}

function checkWaveComplete() {
  if (enemiesRemaining <= 0 && enemies.length === 0) {
    wave++;
    if (wave > 25) {
      // Victory!
      showMsg('SECTOR CLEARED!', 'success');
      setTimeout(() => {
        sector++;
        wave = 1;
        difficulty = Math.min(5, sector);
        startWave();
      }, 3000);
    } else {
      showMsg('WAVE CLEAR!', 'success');
      setTimeout(startWave, 2000);
    }
  }
}

// ============ PLAYER INPUT & MOVEMENT ============
function updatePlayer(dt) {
  const p = player;
  const pg = playerGroup;
  
  // Shield regen
  if (p.shield < p.maxShield) {
    p.shieldRegenTimer -= dt;
    if (p.shieldRegenTimer <= 0) {
      p.shield = Math.min(p.maxShield, p.shield + CONFIG.player.shieldRegen * dt);
    }
  } else {
    p.shieldRegenTimer = CONFIG.player.shieldRegenDelay;
  }
  
  // Energy regen
  p.energy = Math.min(p.maxEnergy, p.energy + CONFIG.player.energyRegen * dt);
  
  // Cooldowns
  p.laserCooldown = Math.max(0, p.laserCooldown - dt);
  p.missileCooldown = Math.max(0, p.missileCooldown - dt);
  p.empCooldown = Math.max(0, p.empCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  multiplierTimer = Math.max(0, multiplierTimer - dt);
  if (multiplierTimer <= 0) multiplier = Math.max(1, multiplier - 0.02 * dt);
  
  // Input handling — simplified: W/S = thrust, A/D = yaw turn, Up/Down = pitch
  let pitchInput = 0, yawInput = 0, rollInput = 0;
  let thrustInput = 0;
  let boostPressed = false;
  
  // Keyboard
  if (keys['w']) thrustInput = 1;
  if (keys['s']) thrustInput = -1;
  if (keys['arrowup']) pitchInput = 1;      // Pitch up (looping)
  if (keys['arrowdown']) pitchInput = -1;    // Pitch down
  if (keys['a'] || keys['arrowleft']) yawInput = -1;  // Turn left
  if (keys['d'] || keys['arrowright']) yawInput = 1;   // Turn right
  if (keys['q']) yawInput = -1;   // Also turn left
  if (keys['e']) yawInput = 1;    // Also turn right
  if (keys['shift']) { boostPressed = true; if (!p._boostSfx) { SFX.playBoost(); p._boostSfx = true; } }
  else p._boostSfx = false;
  if (keys[' ']) { p.currentWeapon = 'laser'; fireLaser(); }
  if (keys['tab']) { p.currentWeapon = 'missile'; fireMissile(); }
  if (keys['c']) { p.currentWeapon = 'emp'; fireEMP(); }
  if (keys['1']) p.currentWeapon = 'laser';
  if (keys['2']) p.currentWeapon = 'missile';
  if (keys['3']) p.currentWeapon = 'emp';
  
  // Mobile joystick (move) — simplified: X axis = yaw, Y axis = thrust
  if (joyMove.active) {
    thrustInput = -joyMove.y;
    yawInput = joyMove.x;
    boostPressed = boostPressed || joyMove.boost;
    if (joyMove.fire) { p.currentWeapon = 'laser'; fireLaser(); }
    if (joyMove.missile) { p.currentWeapon = 'missile'; fireMissile(); }
    if (joyMove.emp) { p.currentWeapon = 'emp'; fireEMP(); }
  }
  
  // Mouse look — only pitch, yaw handled by A/D keys
  if (mouseLook.active) {
    pitchInput = -mouseLook.y * 0.5;
    yawInput += -mouseLook.x * 0.3;
    mouseLook.x *= 0.8;
    mouseLook.y *= 0.8;
  }
  
  // Mobile joystick (look) — pitch + fine yaw
  if (joyLook.active) {
    pitchInput += -joyLook.y * 2;
    yawInput += -joyLook.x * 1.5;
  }
  
  // Auto-banking roll: when yawing, automatically roll into the turn
  const autoBankTarget = -yawInput * 0.6;
  const currentRoll = pg.rotation.z;
  const autoBankSpeed = 3; // how fast the ship banks into the turn
  rollInput = (autoBankTarget - currentRoll) * autoBankSpeed;
  // Add manual roll override from mobile
  if (joyMove.rollLeft) rollInput = -2;
  if (joyMove.rollRight) rollInput = 2;
  
  // Apply rotation
  const pitchRate = CONFIG.player.pitchRate;
  const yawRate = CONFIG.player.yawRate;
  const rollRate = CONFIG.player.rollRate;
  
  // Clamp pitch
  const currentPitch = pg.rotation.x;
  const maxPitch = 1.5; // allow full loop capability
  if ((currentPitch >= maxPitch && pitchInput > 0) || (currentPitch <= -maxPitch && pitchInput < 0)) {
    pitchInput = 0;
  }
  
  pg.rotateX(pitchInput * pitchRate * dt);
  pg.rotateY(yawInput * yawRate * dt);
  pg.rotateZ(rollInput * rollRate * dt);
  
  // Movement — ship always moves in the direction it faces
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(pg.quaternion);
  
  const maxSpeed = boostPressed ? CONFIG.player.boostSpeed : CONFIG.player.maxSpeed;
  const accel = CONFIG.player.acceleration;
  const brakeForce = CONFIG.player.brakeForce;
  
  // Forward/back thrust
  if (thrustInput > 0) {
    p.velocity.addScaledVector(forward, accel * thrustInput * dt);
    p.thrust = Math.min(1, p.thrust + dt * 2);
  } else if (thrustInput < 0) {
    p.velocity.addScaledVector(forward, accel * thrustInput * dt * 0.5);
    p.thrust = Math.max(-0.5, p.thrust - dt * 2);
  } else {
    // Brake / drift damping
    p.velocity.lerp(new THREE.Vector3(0, 0, 0), brakeForce * dt);
    p.thrust *= 0.95;
  }
  
  // Speed limit — simple forward velocity cap
  const speed = p.velocity.length();
  if (speed > maxSpeed) {
    p.velocity.multiplyScalar(maxSpeed / speed);
  }
  
  // Apply velocity
  pg.position.addScaledVector(p.velocity, dt);
  
  // Bounds
  const bounds = CONFIG.world.bounds;
  pg.position.x = clamp(pg.position.x, -bounds, bounds);
  pg.position.y = clamp(pg.position.y, -bounds * 0.5, bounds * 0.5);
  pg.position.z = clamp(pg.position.z, -bounds, bounds);
  
  // Camera follow - supports both chase and first person
  if (firstPerson) {
    // First-person: camera at cockpit position looking forward
    const cockpitPos = pg.position.clone().add(
      new THREE.Vector3(0, 1.5, 2).applyQuaternion(pg.quaternion)
    );
    camera.position.lerp(cockpitPos, 0.2);
    const lookTarget = pg.position.clone().add(forward.multiplyScalar(100));
    camera.lookAt(lookTarget);
  } else {
    // Third-person chase: behind and above the ship
    const camOffset = new THREE.Vector3(0, 5, -25).applyQuaternion(pg.quaternion);
    const camTarget = pg.position.clone().add(camOffset);
    camera.position.lerp(camTarget, 0.1);
    camera.lookAt(pg.position.clone().add(forward.multiplyScalar(50)));
  }
  
  // Update engine trails
  updatePlayerTrails(dt);
  
  // Update engine hum sound
  updateEngineHum();
}

// ============ WORLD UPDATES ============
function updateWorld(dt) {
  // Stars twinkle
  if (stars && stars.material.userData.shader) {
    stars.material.userData.shader.uniforms.uTime.value = performance.now() / 1000;
  }
  
  // Nebulas slow rotation
  if (nebulas) {
    nebulas.children.forEach(n => {
      n.rotation.x += n.userData.rotSpeed.x;
      n.rotation.y += n.userData.rotSpeed.y;
      n.rotation.z += n.userData.rotSpeed.z;
    });
  }
  
  // Asteroids rotation and drift
  if (asteroids) {
    asteroids.children.forEach(a => {
      a.rotation.x += a.userData.rotSpeed.x;
      a.rotation.y += a.userData.rotSpeed.y;
      a.rotation.z += a.userData.rotSpeed.z;
      a.position.addScaledVector(a.userData.drift, dt);
    });
  }
  
  // Grid floor scroll with player
  if (gridFloor) {
    gridFloor.position.x = Math.floor(playerGroup.position.x / 50) * 50;
    gridFloor.position.z = Math.floor(playerGroup.position.z / 50) * 50;
    if (gridFloor.userData.lines) {
      gridFloor.userData.lines.material.opacity = 0.4 * (1 - playerGroup.position.y / 500);
    }
  }
}

// ============ SCREEN EFFECTS ============
function updateScreenEffects(dt) {
  // Screen shake
  if (shakeIntensity > 0) {
    shakeIntensity -= dt * 15;
    const shakeX = rand(-shakeIntensity, shakeIntensity);
    const shakeY = rand(-shakeIntensity, shakeIntensity);
    camera.position.x += shakeX;
    camera.position.y += shakeY;
    camera.rotation.z = shakeX * 0.01;
  } else {
    camera.rotation.z = 0;
  }
  
  // Screen flash
  if (screenFlash > 0) {
    screenFlash -= dt * 2;
    renderer.domElement.style.filter = `brightness(${1 + screenFlash})`;
    if (flashColor.r > 0 || flashColor.g > 0 || flashColor.b > 0) {
      renderer.domElement.style.filter += ` saturate(${1 + screenFlash})`;
    }
  } else {
    renderer.domElement.style.filter = 'none';
  }
  
  // Chromatic aberration based on speed/boost
  if (window.chromaticPass) {
    const speed = player.velocity.length();
    const boost = player.boost ? 0.005 : 0;
    window.chromaticPass.uniforms.amount.value = (speed / CONFIG.player.maxSpeed) * 0.003 + boost;
  }
  
  // Bloom intensity based on action
  if (bloomPass) {
    bloomPass.strength = 1.2 + (player.boost ? 0.5 : 0) + (screenFlash * 0.5);
  }

  // Radar
  updateRadar();
}

// ============ RADAR ============
let _radarCtx = null;
function getRadarCtx() {
  if (!_radarCtx) {
    const canvas = gi('radar');
    if (canvas && canvas.getContext) {
      _radarCtx = canvas.getContext('2d');
    }
  }
  return _radarCtx;
}
function updateRadar() {
  const radarCtx = getRadarCtx();
  if (!radarCtx) return;
  const w = 140, h = 140, cx = w/2, cy = h/2, r = 55;
  const canvas = radarCtx.canvas;
  
  radarCtx.clearRect(0, 0, w, h);
  
  // Background
  radarCtx.fillStyle = 'rgba(0,5,15,0.85)';
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
  radarCtx.fill();
  
  // Ring
  radarCtx.strokeStyle = 'rgba(0,255,255,0.2)';
  radarCtx.lineWidth = 1;
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
  radarCtx.stroke();
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  radarCtx.stroke();
  
  // Crosshairs
  radarCtx.strokeStyle = 'rgba(0,255,255,0.12)';
  radarCtx.lineWidth = 0.5;
  radarCtx.beginPath();
  radarCtx.moveTo(cx - r, cy); radarCtx.lineTo(cx + r, cy);
  radarCtx.moveTo(cx, cy - r); radarCtx.lineTo(cx, cy + r);
  radarCtx.stroke();
  
  if (!gameRunning || !playerGroup) return;
  const pp = playerGroup.position;
  const radarRange = 400;
  
  // Player dot
  radarCtx.fillStyle = '#0ff';
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, 3, 0, Math.PI * 2);
  radarCtx.fill();
  
  // Enemies
  enemies.forEach(e => {
    if (e.hull <= 0) return;
    const dx = e.mesh.position.x - pp.x;
    const dz = e.mesh.position.z - pp.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > radarRange) return;
    const rx = cx + (dx / radarRange) * r;
    const ry = cy + (dz / radarRange) * r;
    const c = new THREE.Color(e.color);
    radarCtx.fillStyle = '#' + c.getHexString();
    radarCtx.beginPath();
    radarCtx.arc(rx, ry, e.type === 'corvette' ? 4 : e.type === 'heavy' ? 3 : 2, 0, Math.PI * 2);
    radarCtx.fill();
  });
  
  // Powerups
  powerups.forEach(p => {
    const dx = p.mesh.position.x - pp.x;
    const dz = p.mesh.position.z - pp.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > radarRange) return;
    const rx = cx + (dx / radarRange) * r;
    const ry = cy + (dz / radarRange) * r;
    radarCtx.fillStyle = '#ff0';
    radarCtx.beginPath();
    radarCtx.arc(rx, ry, 2, 0, Math.PI * 2);
    radarCtx.fill();
  });
}

// ============ AIM SYSTEM (Crosshair, Target Info, Lead Indicator, Range) ============
function updateAimSystem() {
  if (!gameRunning || !playerGroup || enemies.length === 0) {
    if (crosshairEl) crosshairEl.style.display = 'none';
    if (targetInfoEl) targetInfoEl.style.display = 'none';
    if (rangeInfoEl) rangeInfoEl.style.display = 'none';
    if (leadIndicatorEl) leadIndicatorEl.style.display = 'none';
    targetEnemy = null;
    return;
  }

  const playerPos = playerGroup.position;
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
  let closestDist = Infinity;
  let closestEnemy = null;

  // Find the nearest enemy within a cone (forward arc)
  enemies.forEach(e => {
    if (e.hull <= 0) return;
    const toEnemy = new THREE.Vector3().subVectors(e.mesh.position, playerPos);
    const dist = toEnemy.length();
    if (dist > 500) return; // max lock range
    
    // Angle check - only target enemies roughly in front
    toEnemy.normalize();
    const dot = forward.dot(toEnemy);
    if (dot < 0.3) return; // ~72 degree cone
    
    if (dist < closestDist) {
      closestDist = dist;
      closestEnemy = e;
    }
  });

  targetEnemy = closestEnemy;

  if (!closestEnemy) {
    if (crosshairEl) crosshairEl.style.display = 'none';
    if (targetInfoEl) targetInfoEl.style.display = 'none';
    if (rangeInfoEl) rangeInfoEl.style.display = 'none';
    if (leadIndicatorEl) leadIndicatorEl.style.display = 'none';
    return;
  }

  // Show crosshair
  if (crosshairEl) {
    crosshairEl.style.display = 'block';
    // Lock indicator if enemy is close/visible
    const locked = closestDist < 300 && closestEnemy.shield > 0;
    crosshairEl.classList.toggle('locked', locked);
  }

  // Project enemy position to screen space
  const enemyPos = closestEnemy.mesh.position.clone();
  const enemyVec = enemyPos.clone().project(camera);

  // Check if enemy is on screen
  if (enemyVec.x < -1 || enemyVec.x > 1 || enemyVec.y < -1 || enemyVec.y > 1 || enemyVec.z > 1) {
    // Enemy off-screen — show off-screen indicator on crosshair edge
    if (targetInfoEl) targetInfoEl.style.display = 'none';
    if (rangeInfoEl) rangeInfoEl.style.display = 'none';
    if (leadIndicatorEl) leadIndicatorEl.style.display = 'none';
    return;
  }

  // Target info panel (to the right of crosshair)
  if (targetInfoEl) {
    targetInfoEl.style.display = 'flex';
    const nameEl = targetInfoEl.querySelector('.name');
    const distEl = targetInfoEl.querySelector('.dist');
    const hullFill = targetInfoEl.querySelector('.hullBarFill');
    const shieldFill = targetInfoEl.querySelector('.shieldBarFill');
    
    if (nameEl) {
      const typeNames = { drone: 'DRONE', interceptor: 'INTERCEPTOR', heavy: 'HEAVY', corvette: 'CORVETTE' };
      nameEl.textContent = typeNames[closestEnemy.type] || closestEnemy.type.toUpperCase();
      nameEl.style.color = '#' + new THREE.Color(closestEnemy.color).getHexString();
    }
    if (distEl) distEl.textContent = Math.ceil(closestDist) + 'm';
    if (hullFill) hullFill.style.width = `${clamp(closestEnemy.hull / closestEnemy.maxHull * 100, 0, 100)}%`;
    if (shieldFill && closestEnemy.maxShield > 0) {
      shieldFill.style.width = `${clamp(closestEnemy.shield / closestEnemy.maxShield * 100, 0, 100)}%`;
    }
  }

  // Range info below crosshair
  if (rangeInfoEl) {
    rangeInfoEl.style.display = 'block';
    const weaponRange = CONFIG.laser.range;
    const inRange = closestDist < weaponRange;
    rangeInfoEl.textContent = inRange ? 'IN RANGE' : `${Math.ceil(closestDist - weaponRange)}m OUT`;
    rangeInfoEl.style.color = inRange ? '#0f0' : '#f80';
  }

  // Lead indicator - predict where to shoot based on enemy velocity
  if (leadIndicatorEl) {
    if (closestDist < 400) {
      leadIndicatorEl.style.display = 'block';
      
      // Simple lead calculation
      const enemyVel = closestEnemy.velocity || new THREE.Vector3();
      const laserSpeed = CONFIG.laser.speed;
      const timeToTarget = closestDist / laserSpeed;
      
      leadPos.copy(closestEnemy.mesh.position).add(enemyVel.clone().multiplyScalar(timeToTarget));
      
      const leadScreen = leadPos.clone().project(camera);
      const x = (leadScreen.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-leadScreen.y * 0.5 + 0.5) * window.innerHeight;
      
      leadIndicatorEl.style.left = x + 'px';
      leadIndicatorEl.style.top = y + 'px';
      
      // Only show lead if it's different from center (target is moving)
      const diff = leadScreen.distanceTo(enemyVec);
      leadIndicatorEl.style.opacity = diff > 0.03 ? '1' : '0.2';
    } else {
      leadIndicatorEl.style.display = 'none';
    }
  }
}

// ============ GAME LOOP ============
function animate(time) {
  if (!gameRunning) return;
  
  const dt = Math.min((time - lastTime) / 1000, 1/30);
  lastTime = time;
  
  if (!gamePaused) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePowerups(dt);
    updateDebris(dt);
    updateParticles(dt);
    updateWorld(dt);
    updateScreenEffects(dt);
    updateAimSystem();
    updateHUD();
  }
  
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

// ============ INPUT HANDLERS ============
function onKeyDown(e) {
  if (e.code === 'Escape') {
    if (pointerLock) {
      document.exitPointerLock();
    } else {
      togglePause();
    }
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyV') { toggleView(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (['Space', 'Tab', 'KeyC', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyV', 'KeyM', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.key.toLowerCase()] = true;
}

function onKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function onMouseDown(e) {
  if (e.button === 0 && !pointerLock && !gamePaused) {
    canvas.requestPointerLock();
  }
  if (e.button === 0) { player.currentWeapon = 'laser'; fireLaser(); }
  if (e.button === 2) { player.currentWeapon = 'missile'; fireMissile(); }
}

function onMouseMove(e) {
  if (pointerLock) {
    mouseLook.x += e.movementX * mouseLook.sensitivity;
    mouseLook.y += e.movementY * mouseLook.sensitivity;
    mouseLook.y = clamp(mouseLook.y, -1, 1);
  }
}

function onPointerLockChange() {
  pointerLock = document.pointerLockElement === canvas;
  if (!pointerLock) {
    mouseLook.x = 0;
    mouseLook.y = 0;
  }
}

function onContextMenu(e) { e.preventDefault(); }

// Touch controls
function setupTouchControls() {
  const joyMoveEl = gi('joyMove'), joyLookEl = gi('joyLook');
  const stickMove = joyMoveEl.querySelector('.stick'), stickLook = joyLookEl.querySelector('.stick');
  const baseMove = joyMoveEl.querySelector('.base'), baseLook = joyLookEl.querySelector('.base');
  
  function getStickPos(el, touch) {
    const rect = el.getBoundingClientRect();
    const x = (touch.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (touch.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const dist = Math.min(1, Math.sqrt(x * x + y * y));
    const angle = Math.atan2(y, x);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, dist };
  }
  
  // Move joystick
  baseMove.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    joyMove.active = true;
    joyMove.id = touch.identifier;
    const pos = getStickPos(baseMove, touch);
    joyMove.x = pos.x; joyMove.y = pos.y;
    stickMove.style.transform = `translate(${pos.x * 42}px, ${pos.y * 42}px)`;
    stickMove.classList.add('active');
    gi('hintMove').classList.add('hidden');
  }, { passive: false });
  
  baseMove.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.touches) {
      if (touch.identifier === joyMove.id) {
        const pos = getStickPos(baseMove, touch);
        joyMove.x = pos.x; joyMove.y = pos.y;
        stickMove.style.transform = `translate(${pos.x * 42}px, ${pos.y * 42}px)`;
        break;
      }
    }
  }, { passive: false });
  
  const resetMoveStick = () => {
    joyMove.active = false;
    joyMove.id = null;
    joyMove.x = 0; joyMove.y = 0;
    stickMove.style.transform = 'translate(0, 0)';
    stickMove.classList.remove('active');
  };

  baseMove.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joyMove.id) {
        resetMoveStick();
        break;
      }
    }
  });
  baseMove.addEventListener('touchcancel', resetMoveStick);
  
  // Look joystick
  baseLook.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    joyLook.active = true;
    joyLook.id = touch.identifier;
    const pos = getStickPos(baseLook, touch);
    joyLook.x = pos.x; joyLook.y = pos.y;
    stickLook.style.transform = `translate(${pos.x * 42}px, ${pos.y * 42}px)`;
    stickLook.classList.add('active');
    gi('hintLook').classList.add('hidden');
  }, { passive: false });
  
  baseLook.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.touches) {
      if (touch.identifier === joyLook.id) {
        const pos = getStickPos(baseLook, touch);
        joyLook.x = pos.x; joyLook.y = pos.y;
        stickLook.style.transform = `translate(${pos.x * 42}px, ${pos.y * 42}px)`;
        break;
      }
    }
  }, { passive: false });
  
  const resetLookStick = () => {
    joyLook.active = false;
    joyLook.id = null;
    joyLook.x = 0; joyLook.y = 0;
    stickLook.style.transform = 'translate(0, 0)';
    stickLook.classList.remove('active');
  };

  baseLook.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joyLook.id) {
        resetLookStick();
        break;
      }
    }
  });
  baseLook.addEventListener('touchcancel', resetLookStick);
  
  // Action buttons
  const setupBtn = (btn, action) => {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); joyMove[action] = true; btn.classList.add('active'); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); joyMove[action] = false; btn.classList.remove('active'); }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { joyMove[action] = false; btn.classList.remove('active'); });
  };
  
  setupBtn(btnFire, 'fire');
  setupBtn(btnMissile, 'missile');
  setupBtn(btnBoost, 'boost');
  setupBtn(btnEMP, 'emp');
  setupBtn(btnRollL, 'rollLeft');
  setupBtn(btnRollR, 'rollRight');
  setupBtn(btnUp, 'up');
  setupBtn(btnDown, 'down');
  
  // Show touch hints initially
  setTimeout(() => {
    document.querySelectorAll('.touchHint').forEach(h => h.classList.remove('hidden'));
  }, 1000);
  
  // Hide hints after first use
  function hideHints() {
    document.querySelectorAll('.touchHint').forEach(h => h.classList.add('hidden'));
    document.removeEventListener('touchstart', hideHints);
  }
  document.addEventListener('touchstart', hideHints);
}

function toggleView() {
  firstPerson = !firstPerson;
  if (firstPerson) {
    showMsg('COCKPIT VIEW', 'success');
    if (viewVal) viewVal.textContent = 'COCKPIT';
    if (playerGroup && playerGroup.userData.shipMesh) {
      playerGroup.userData.shipMesh.visible = false;
    }
  } else {
    showMsg('CHASE VIEW', 'success');
    if (viewVal) viewVal.textContent = 'CHASE';
    if (playerGroup && playerGroup.userData.shipMesh) {
      playerGroup.userData.shipMesh.visible = true;
    }
  }
}

function toggleSound() {
  soundMuted = !soundMuted;
  if (soundMuted) {
    showMsg('SOUND OFF', 'warning');
    if (soundVal) { soundVal.textContent = 'OFF'; soundVal.style.color = '#f80'; }
    if (engineHumOsc && engineHumGain) {
      engineHumGain.gain.setValueAtTime(0, SFX.ctx.currentTime);
    }
  } else {
    showMsg('SOUND ON', 'success');
    if (soundVal) { soundVal.textContent = 'ON'; soundVal.style.color = ''; }
    startEngineHum();
  }
}

function startEngineHum() {
  if (!SFX.ctx || soundMuted) return;
  try {
    if (engineHumOsc) {
      engineHumOsc.disconnect();
      engineHumOsc = null;
    }
    if (engineHumGain) {
      engineHumGain.disconnect();
      engineHumGain = null;
    }
    // Main engine oscillator (sawtooth for grumble)
    engineHumOsc = SFX.ctx.createOscillator();
    engineHumGain = SFX.ctx.createGain();
    const filter = SFX.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    filter.Q.value = 1.5;
    engineHumOsc.type = 'sawtooth';
    engineHumOsc.frequency.value = 55;
    engineHumGain.gain.setValueAtTime(0.1, SFX.ctx.currentTime);
    engineHumOsc.connect(filter);
    filter.connect(engineHumGain);
    engineHumGain.connect(SFX.ctx.destination);
    engineHumOsc._filter = filter;
    // Second detuned oscillator for richer texture
    const osc2 = SFX.ctx.createOscillator();
    const gain2 = SFX.ctx.createGain();
    const filter2 = SFX.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 180;
    filter2.Q.value = 2;
    osc2.type = 'sawtooth';
    osc2.frequency.value = 48;
    gain2.gain.setValueAtTime(0.05, SFX.ctx.currentTime);
    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(SFX.ctx.destination);
    osc2.start();
    engineHumOsc._osc2 = osc2;
    engineHumOsc._gain2 = gain2;
    engineHumOsc._filter2 = filter2;
    // Sub-bass sine layer for deep rumble
    const osc3 = SFX.ctx.createOscillator();
    const gain3 = SFX.ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = 30;
    gain3.gain.setValueAtTime(0.06, SFX.ctx.currentTime);
    osc3.connect(gain3);
    gain3.connect(SFX.ctx.destination);
    osc3.start();
    engineHumOsc._osc3 = osc3;
    engineHumOsc._gain3 = gain3;
    // LFO for filter modulation (living engine feel)
    const lfo = SFX.ctx.createOscillator();
    const lfoGain = SFX.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 3.5;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfoGain.connect(filter2.frequency);
    lfo.start();
    engineHumOsc._lfo = lfo;
    engineHumOsc._lfoGain = lfoGain;
    engineHumOsc.start();
  } catch(e) {
    // Silently fail - engine hum is non-critical
  }
}

function updateEngineHum() {
  if (!SFX.ctx || soundMuted || !engineHumOsc || !engineHumGain) return;
  try {
    const speed = player.velocity.length();
    const thrustNorm = speed / CONFIG.player.maxSpeed;
    const isBoosting = player.boost;
    const norm = isBoosting ? Math.max(thrustNorm, 0.8) : thrustNorm;
    
    // Main oscillator
    const baseFreq = 55;
    const maxFreq = 150;
    const freq = baseFreq + (maxFreq - baseFreq) * norm;
    engineHumOsc.frequency.setTargetAtTime(freq, SFX.ctx.currentTime, 0.1);
    const baseGain = 0.08;
    const maxGain = 0.25;
    const gain = baseGain + (maxGain - baseGain) * norm;
    engineHumGain.gain.setTargetAtTime(gain, SFX.ctx.currentTime, 0.1);
    if (engineHumOsc._filter) {
      engineHumOsc._filter.frequency.setTargetAtTime(250 + norm * 1200, SFX.ctx.currentTime, 0.1);
      engineHumOsc._filter.Q.setTargetAtTime(isBoosting ? 3 : 1.5, SFX.ctx.currentTime, 0.1);
    }
    // Second oscillator (detuned)
    if (engineHumOsc._osc2 && engineHumOsc._gain2 && engineHumOsc._filter2) {
      const freq2 = freq * 0.87;
      engineHumOsc._osc2.frequency.setTargetAtTime(freq2, SFX.ctx.currentTime, 0.1);
      const gain2 = (baseGain * 0.5) + (maxGain * 0.3) * norm;
      engineHumOsc._gain2.gain.setTargetAtTime(gain2, SFX.ctx.currentTime, 0.1);
      engineHumOsc._filter2.frequency.setTargetAtTime(180 + norm * 600, SFX.ctx.currentTime, 0.1);
    }
    // Sub-bass layer
    if (engineHumOsc._osc3 && engineHumOsc._gain3) {
      const subFreq = 30 + norm * 20;
      engineHumOsc._osc3.frequency.setTargetAtTime(subFreq, SFX.ctx.currentTime, 0.1);
      const subGain = 0.04 + norm * 0.12;
      engineHumOsc._gain3.gain.setTargetAtTime(subGain, SFX.ctx.currentTime, 0.1);
    }
    // LFO modulation rate increases with thrust
    if (engineHumOsc._lfo && engineHumOsc._lfoGain) {
      const lfoRate = 3.5 + norm * 4;
      engineHumOsc._lfo.frequency.setTargetAtTime(lfoRate, SFX.ctx.currentTime, 0.1);
      const lfoDepth = 30 + norm * 50;
      engineHumOsc._lfoGain.gain.setTargetAtTime(lfoDepth, SFX.ctx.currentTime, 0.1);
    }
  } catch(e) {
    // Silently fail
  }
}

function togglePause() {
  if (gameOver) return;
  gamePaused = !gamePaused;
  if (gamePaused) {
    showMsg('PAUSED', 'warning');
  } else {
    lastTime = performance.now();
    showMsg('RESUMED', 'success');
    requestAnimationFrame(animate);
  }
}

function gameOverSequence() {
  gameRunning = false;
  gameOver = true;
  SFX.playGameOver();
  
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('starfighterBest', bestScore.toString());
    showMsg('NEW HIGH SCORE!', 'success');
  } else {
    showMsg('GAME OVER', 'danger');
  }
  
  setTimeout(() => {
    intro.style.display = 'flex';
    hud.style.display = 'none';
    document.querySelectorAll('.touchHint').forEach(h => h.classList.remove('hidden'));
  }, 3000);
}

// ============ START GAME ============
function startGame() {
  debugLog('>>> startGame() ENTERED');
  if (window.__dbg) window.__dbg('startGame() called', 'success');
  try {
    // Reset state
    debugLog('startGame: resetting core state...');
    score = 0;
    wave = 1;
    kills = 0;
    multiplier = 1;
    multiplierTimer = 0;
    const diffSelEl = gi('diffSel');
    if (!diffSelEl) {
      debugLog('startGame: #diffSel NOT found, defaulting sector=1', 'warn');
      sector = 1;
    } else {
      sector = parseInt(diffSelEl.value) || 1;
      debugLog('startGame: diffSel.value="' + diffSelEl.value + '" -> sector=' + sector);
    }
    difficulty = sector;
    enemies = [];
    projectiles = [];
    missiles = [];
    powerups = [];
    debris = [];
    particles = [];
    gameOver = false;
    gamePaused = false;
    gameRunning = true;
    lastTime = performance.now();
    debugLog('startGame: core state reset OK');

    // Reset player
    debugLog('startGame: resetting player (player=' + !!player + ', playerGroup=' + !!playerGroup + ')');
    if (!player) { debugLog('startGame: player is null!', 'error'); throw new Error('player is null'); }
    if (!playerGroup) { debugLog('startGame: playerGroup is null!', 'error'); throw new Error('playerGroup is null'); }
    player.hull = player.maxHull;
    player.shield = player.maxShield;
    player.energy = player.maxEnergy;
    player.missileAmmo = CONFIG.player.missileAmmo;
    player.empCharges = CONFIG.player.empCharges;
    player.empCooldown = 0;
    player.laserCooldown = 0;
    player.missileCooldown = 0;
    // Initialize audio on user gesture
    SFX.init();
    // Reset first person view to chase on new game
    firstPerson = false;
    if (playerGroup && playerGroup.userData.shipMesh) {
      playerGroup.userData.shipMesh.visible = true;
    }
    // Start engine hum
    if (!soundMuted) startEngineHum();
    
    player.invulnerable = 0;
    player.velocity.set(0, 0, 0);
    player.thrust = 0;
    playerGroup.position.set(0, 0, 0);
    playerGroup.rotation.set(0, 0, 0);
    playerGroup.quaternion.set(0, 0, 0, 1);
    debugLog('startGame: player reset OK');

    // Clear existing entities
    debugLog('startGame: clearing entities...');
    enemies.forEach(e => {
      scene.remove(e.mesh);
      e.mesh.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });
    enemies = [];
    [...projectiles, ...missiles].forEach(p => {
      scene.remove(p.mesh);
      p.mesh.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });
    projectiles = [];
    missiles = [];
    [...powerups, ...debris].forEach(p => {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    powerups = [];
    debris = [];
    debugLog('startGame: entities cleared OK');

    debugLog('startGame: toggling intro/hud visibility...');
    intro.style.display = 'none';
    hud.style.display = 'block';
    debugLog('startGame: calling updateHUD()');
    updateHUD();
    debugLog('startGame: calling startWave()');
    startWave();
    debugLog('startGame: startWave() returned OK');
    debugLog('startGame: calling requestAnimationFrame(animate)');
    requestAnimationFrame(animate);
    debugLog('startGame() COMPLETED successfully', 'success');
    if (window.__dbg) window.__dbg('startGame() COMPLETED successfully', 'success');
  } catch (err) {
    const errMsg = 'startGame() THREW: ' + (err && err.message ? err.message : err);
    debugLog(errMsg, 'error');
    if (window.__dbg) window.__dbg(errMsg, 'error');
    if (err && err.stack) {
      debugLog('STACK: ' + err.stack, 'error');
      if (window.__dbg) window.__dbg('STACK: ' + err.stack, 'error');
    }
  }
}

// ============ INITIALIZATION ============
function init() {
  debugLog('init() called - initializing...');
  if (window.__setStatus) window.__setStatus('statusInit', 'INIT: running', '#0ff');
  console.log('[Starfighter] Initializing...');
  
  try {
    initThree();
    debugLog('Three.js init succeeded', 'success');
    if (window.__setStatus) window.__setStatus('statusInit', 'INIT: ok', '#0f0');
    console.log('[Starfighter] Three.js initialized');
  } catch (e) {
    const msg = 'Three.js init failed: ' + e.message;
    debugLog(msg, 'error');
    if (window.__setStatus) window.__setStatus('statusInit', 'INIT: FAILED', '#f44');
    console.error('[Starfighter] Three.js init failed:', e);
    showMsg('INIT ERROR: ' + e.message, 'danger');
    return;
  }
  
  try {
    setupTouchControls();
    debugLog('Touch controls initialized');
    console.log('[Starfighter] Touch controls initialized');
  } catch (e) {
    debugLog('Touch controls init error: ' + e.message, 'warn');
    console.error('[Starfighter] Touch controls init failed:', e);
  }
  
  // Attach event listeners
  debugLog('Attaching keyboard/mouse event listeners...');
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  if (canvas) {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('contextmenu', onContextMenu);
    debugLog('Canvas event listeners attached');
  } else {
    debugLog('Canvas element is null, cannot attach mouse listeners!', 'error');
  }
  document.addEventListener('pointerlockchange', onPointerLockChange);
  debugLog('Pointer lock change listener attached');

  // Debug control - clear button
  const debugCtrl = gi('debugCtrl');
  if (debugCtrl) {
    debugCtrl.addEventListener('click', () => {
      if (debugLogList) debugLogList.innerHTML = '';
    });
    debugLog('Debug clear button found');
  } else {
    debugLog('Debug clear button not found', 'warn');
  }

  // Start button with debugging
  const startBtn = gi('sB');
  if (startBtn) {
    debugLog('Start button found, attaching click & touchend listeners');
    startBtn.addEventListener('click', (e) => {
      debugLog('>>> START BUTTON CLICK EVENT FIRED!', 'success');
      console.log('[Starfighter] Start button clicked');
      startGame();
    }, { passive: true });
    startBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      debugLog('>>> START BUTTON TOUCHEND EVENT FIRED!', 'success');
      console.log('[Starfighter] Start button touchend');
      startGame();
    }, { passive: false });
    debugLog('Start button listeners attached successfully');
    debugLog(`startBtn disabled=${startBtn.disabled}, innerHTML="${startBtn.textContent}"`);
  } else {
    const msg = 'Start button #sB NOT FOUND in DOM!';
    debugLog(msg, 'error');
    console.error('[Starfighter] Start button NOT FOUND!');
  }
  
  const fsBtn = gi('fs');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  } else {
    debugLog('Fullscreen button not found', 'warn');
  }
  
  // Prevent default touch behaviors
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  
  updateHUD();
  debugLog('Initialization complete - game ready!', 'success');
  console.log('[Starfighter] Initialization complete');
}

// Start
init();
debugLog('init() returned, startup sequence finished');
if (window.__dbg) window.__dbg('init() returned, startup sequence finished', 'success');

// Expose internals for debugging / fallback listener
window.startGame = startGame;
window.__gameState = () => ({ gameRunning, gameOver, gamePaused, player: !!player, scene: !!scene, playerGroup: !!playerGroup });
if (window.__dbg) window.__dbg('Exposed window.startGame and window.__gameState', 'success');
