const canvas = document.getElementById('game');
const goldEl = document.getElementById('gold');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const scoreEl = document.getElementById('score');

let scene, camera, renderer, raycaster, mouse;
let clock, lastTime = 0;
const rad = Math.PI / 180;



/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  GAME STATE                                                                            ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
let G = {
  gold: 0, lives: 0, wave: 1, score: 0,
  state: 'idle', // 'idle' | 'playing' | 'wave_end' | 'game_over'
  isTowerSelected: false,
  selectedType: null,
  cursorMesh: null,
  castle: null,
  pathPoints: [],
  enemies: [],
  towers: [],
  projectiles: [],
  particles: [],
  nextSpawnTime: 0,
  spawnInterval: 1.5,
  waveEnemyCount: 0,
  waveEnemiesSpawned: 0,
  waveEnemiesKilled: 0,
  pathGroup: null,  // group holding path visual meshes
};

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  COMBAT CONSTANTS                                                                      ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */

const TOWER_SPECS = {
  Bowman:    { name: 'Bowman',    cost: 50,  damage: 15,  range: 45,  fireRate: 0.8, colour: 0x2ecc71 },
  Cannon:    { name: 'Cannon',    cost: 120, damage: 40,  range: 60,  fireRate: 1.5, colour: 0xe67e22 },
  IceTower:  { name: 'Ice Tower', cost: 100, damage: 5,   range: 50,  fireRate: 0.6, colour: 0x3498db },
  Flame:     { name: 'Flame',     cost: 150, damage: 2,   range: 35,  fireRate: 0.1, colour: 0xe74c3c },
  Sniper:    { name: 'Sniper',    cost: 200, damage: 100, range: 100, fireRate: 2.5, colour: 0x9b59b6 },
};

const INITIAL_GOLD = 500;
const INITIAL_LIVES = 20;

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  UTILITY FUNCTIONS                                                                     ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
let idCounter = 0;
function uid() { return ++idCounter; }

/* ── global rng ───────────────────────────────── */
function rng() { return Math.random(); }
function rngRange(a, b) { return a + rng() * (b - a); }

/* ── vector helpers ───────────────────────────── */
function dist2D(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2); }

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  SOUND EFFECTS (simple oscillator, no external assets)                                ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
let AC;
function ensureAudio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
}

function play(type) {
  ensureAudio();
  if (!AC) return;
  const defs = {
    shoot:   { f: 440, type: 'square',  dur: 0.05, vol: 0.05, glide: 880 },
    hit:     { f: 200, type: 'sawtooth',dur: 0.1,  vol: 0.04, glide: 100 },
    build:   { f: 660, type: 'sine',   dur: 0.3,  vol: 0.06, glide: 880 },
    wave:    { f: 440, type: 'triangle',dur: 0.6,  vol: 0.05, glide: 660 },
    gameover:{ f: 300, type: 'sawtooth',dur: 0.6,  vol: 0.06, glide: 100 },
  };
  const d = defs[type] || defs.hit;
  const osc = AC.createOscillator();
  const gain = AC.createGain();
  osc.type = d.type;
  osc.frequency.setValueAtTime(d.f, AC.currentTime);
  if (d.glide) osc.frequency.exponentialRampToValueAtTime(d.glide, AC.currentTime + d.dur);
  gain.gain.setValueAtTime(d.vol, AC.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d.dur);
  osc.connect(gain).connect(AC.destination);
  osc.start(); osc.stop(AC.currentTime + d.dur);
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  THREE.JS SETUP                                                                        ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function initRenderer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 60, 100);
  camera.lookAt(0, 0, 0);

  /* Check WebGL availability using a temporary canvas */
  let webglSupported = false;
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (gl) {
      webglSupported = true;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  } catch(e) {
    webglSupported = false;
  }

  if (!webglSupported) {
    document.getElementById('startOverlay').innerHTML =
      '<div class="card"><h1 style="color:#e74c3c;">⚠️ WebGL Not Available</h1><p>Your browser does not support WebGL, which is required for 3D rendering.<br>Please try a different browser or enable hardware acceleration.</p></div>';
    return;
  }

  /* Try multiple approaches to create the WebGL context */
  let created = false;

  /* Approach 1: Basic THREE renderer */
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    if (renderer.getContext()) created = true;
  } catch(e) {
    /* fall through */
  }

  /* Approach 2: With preserveDrawingBuffer */
  if (!created) {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
      if (renderer.getContext()) created = true;
    } catch(e) {
      /* fall through */
    }
  }

  /* Approach 3: Try to manually create the context and pass it in */
  if (!created) {
    try {
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, stencil: false }) ||
                 canvas.getContext('webgl', { alpha: false, antialias: true, stencil: false }) ||
                 canvas.getContext('experimental-webgl', { alpha: false, antialias: true, stencil: false });
      if (gl) {
        renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
        created = true;
      }
    } catch(e) {
      /* fall through */
    }
  }

  if (!created) {
    document.getElementById('startOverlay').innerHTML =
      '<div class="card"><h1 style="color:#e74c3c;">⚠️ Cannot Start 3D Renderer</h1><p>WebGL is reported as supported but the renderer failed to initialize.<br>Try opening this page in a different browser or from a local web server.</p></div>';
    return;
  }
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* lights */
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(50, 100, 50);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 300;
  dir.shadow.camera.left = -150;
  dir.shadow.camera.right = 150;
  dir.shadow.camera.top = 150;
  dir.shadow.camera.bottom = -150;
  scene.add(dir);

  /* raycaster / mouse */
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  clock = new THREE.Clock();
  addEventListeners();
  buildWorld();
  setupInterface();
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  WORLD BUILDERS                                                                        ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function buildWorld() {
  /* ── ground ── */
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  groundGeo.rotateX(-Math.PI / 2);
  const groundTex = makeGrassTexture();
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: 0x3a7a3a, roughness: 0.8, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);
  ground.userData.isGround = true;

  /* ── path group (cleared and rebuilt each game) ── */
  G.pathGroup = new THREE.Group();
  scene.add(G.pathGroup);
  makePath();     // carve the dirt

  /* ── grids (for readability) ── */
  const gridHelper = new THREE.GridHelper(200, 20, 0x555555, 0x888888);
  gridHelper.position.set(0, 0.05, 0);
  scene.add(gridHelper);

  /* ── decorative castle ── */
  buildCastle();

  /* ── start / end markers ── */
  makeCylinder(new THREE.Vector3(-100, 0, 0), 0xff0000, 8, 4, 'Start');
  makeCylinder(new THREE.Vector3(0, 0, 0),   0x00ff00, 10, 4, 'Castle');
}

/* ── helper: place a coloured cylinder ── */
function makeCylinder(pos, col, r, h, name) {
  const geo = new THREE.CylinderGeometry(r, r * 0.8, h, 16);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos); mesh.position.y = h / 2;
  mesh.castShadow = true;  mesh.receiveShadow = true;
  mesh.name = name;
  scene.add(mesh);
  return mesh;
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  PATH SYSTEM — random Catmull-Rom path each game                                    ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */

/* Generate random control points between start (-100,0,0) and end (0,0,0) */
function generateRandomControlPoints() {
  const start = new THREE.Vector3(-100, 0, 0);
  const end   = new THREE.Vector3(0, 0, 0);
  const numMid = 4 + Math.floor(rng() * 3); // 4-6 intermediate points

  const pts = [start];
  for (let i = 0; i < numMid; i++) {
    const t = (i + 1) / (numMid + 1); // 0..1 progress from start to end
    const x = -100 + t * 100;          // linearly spaced in x from -100 to 0
    /* Z jitter: up to ±60 but clamped to ±80 to stay on ground */
    const z = Math.max(-80, Math.min(80, (rng() - 0.5) * 120));
    pts.push(new THREE.Vector3(x, 0, z));
  }
  pts.push(end);
  return pts;
}

/* Catmull-Rom interpolation between control points */
function catmullRomPath(controlPoints, samplesPerSegment = 10) {
  const result = [];
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const tt = t * t;
      const ttt = tt * t;

      const x = 0.5 * (
        (2 * p1.x) + (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * ttt
      );
      const z = 0.5 * (
        (2 * p1.z) + (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * tt +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * ttt
      );
      result.push(new THREE.Vector3(x, 0, z));
    }
  }
  /* Ensure exact end point */
  const last = controlPoints[controlPoints.length - 1];
  result.push(new THREE.Vector3(last.x, 0, last.z));
  return result;
}

function makePath() {
  /* Clear any previous path visuals */
  if (G.pathGroup) {
    while (G.pathGroup.children.length > 0) {
      const child = G.pathGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      G.pathGroup.remove(child);
    }
  }

  /* Generate random control points and smooth Catmull-Rom path */
  const controlPts = generateRandomControlPoints();
  const smoothPts = catmullRomPath(controlPts, 10);
  G.pathPoints = smoothPts;

  /* Build dirt trail strips between consecutive path points */
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x6b5838, roughness: 1 });
  for (let i = 0; i < G.pathPoints.length - 1; i++) {
    const a = G.pathPoints[i], b = G.pathPoints[i + 1];
    const len = a.distanceTo(b);
    if (len < 0.01) continue;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const geo = new THREE.PlaneGeometry(10, len + 0.5);
    const strip = new THREE.Mesh(geo, dirtMat);
    strip.position.copy(mid);
    strip.position.y = 0.02;
    strip.lookAt(b.x, 0.02, b.z);
    strip.rotateY(Math.PI / 2);
    strip.receiveShadow = true;
    if (G.pathGroup) G.pathGroup.add(strip);
  }
}

function getPathPoint(t) {
  t = Math.max(0, Math.min(1, t));
  const points = G.pathPoints;
  const totalLen = getTotalPathLength();
  const targetDist = t * totalLen;
  let dist = 0, i = 0;
  for (; i < points.length - 1; i++) {
    const segLen = points[i].distanceTo(points[i + 1]);
    if (dist + segLen >= targetDist) break;
    dist += segLen;
  }
  const remaining = targetDist - dist;
  const segLen = points[i].distanceTo(points[i + 1]);
  const ratio = segLen === 0 ? 0 : remaining / segLen;
  return new THREE.Vector3().lerpVectors(points[i], points[i + 1], ratio);
}

function getTotalPathLength() {
  let l = 0;
  for (let i = 0; i < G.pathPoints.length - 1; i++)
    l += G.pathPoints[i].distanceTo(G.pathPoints[i + 1]);
  return l;
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  IMPUTE COSINE (PROCEDURAL – no external assets)                                     ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function buildCastle() {
  const castle = new THREE.Group();

  /* base */
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(20, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 })
  );
  base.position.y = 5; base.castShadow = true;
  castle.add(base);

  /* towers */
  for (let dx of [-9, 9])
    for (let dz of [-9, 9]) {
      const towerGeo = new THREE.CylinderGeometry(3, 3, 20, 12);
      const tower = new THREE.Mesh(towerGeo, new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.8 }));
      tower.position.set(dx, 10, dz); tower.castShadow = true;
      castle.add(tower);

      const roofGeo = new THREE.ConeGeometry(4, 5, 12);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 }));
      roof.position.set(dx, 22.5, dz); roof.castShadow = true;
      castle.add(roof);
    }

  /* flags */
  for (let dx of [-9, 9])
    for (let dz of [-9, 9]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 6, 4),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      pole.position.set(dx + 0.5, 25, dz); pole.castShadow = true;
      castle.add(pole);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 1.5),
        new THREE.MeshStandardMaterial({ color: 0xff0000, side: THREE.DoubleSide })
      );
      flag.position.set(dx + 2.5, 26, dz); flag.castShadow = true;
      castle.add(flag);
    }

  scene.add(castle);
  G.castle = castle;
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  CREATE TOWER (BASIC, BEFORE UPGRADES)                                                 ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function createTower(typeKey, x, z) {
  const spec = TOWER_SPECS[typeKey];

  const group = new THREE.Group();
  group.position.set(x, 0, z);

  /* ── base ── */
  const baseGeo = new THREE.CylinderGeometry(3, 3.5, 2, 12);
  const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 }));
  base.position.y = 1; base.castShadow = true;
  group.add(base);

  /* ── tower body ── */
  const bodyGeo = new THREE.BoxGeometry(5, 12, 5);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: spec.colour, roughness: 0.5 }));
  body.position.y = 8; body.castShadow = true;
  group.add(body);

  /* ── turret ── */
  const turretGeo = new THREE.CylinderGeometry(2.5, 2, 6, 12);
  const turret = new THREE.Mesh(turretGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.3 }));
  turret.position.y = 15; turret.castShadow = true;
  group.add(turret);

  /* ── barrel ── */
  const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
  const barrel = new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 15, 4); barrel.castShadow = true;
  group.add(barrel);

  scene.add(group);

  const towerObj = {
    type: typeKey,
    mesh: group,
    spec: spec,
    position: new THREE.Vector3(x, 0, z),
    range: spec.range,
    damage: spec.damage,
    fireRate: spec.fireRate,
    lastFire: 0,
    level: 1,
    kills: 0,
    xp: 0,
    target: null,
    targetMob: null,
  };

  G.towers.push(towerObj);
  spawnBuildParticle(x, 8, z, spec.colour);
  play('build');
  return towerObj;
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  SPAWN ENEMY                                                                             ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function spawnEnemy(wave) {
  const isBoss = wave % 5 === 0;
  const isElite = wave % 3 === 0;

  const hpMult = 1 + wave * 0.15 + (isBoss ? 4 : 0) + (isElite ? 1 : 0);
  const speedMult = 1 + wave * 0.03 + (isBoss ? -0.4 : 0) + (isElite ? 0.15 : 0);
  const hp = Math.min(5000, Math.floor(100 * hpMult));
  const spd = Math.min(15, 10 + speedMult);

  let col = 0xff6600, s = 2.5, name = 'Goblin', geoType = 'box';
  if (isBoss)          { col = 0x6600ff; s = 5;  name = 'Boss';     geoType = 'cylinder'; }
  else if (wave % 4 === 0) { col = 0x00ff00; s = 1.8; name = 'Speedy';  geoType = 'cone'; }
  else if (isElite)    { col = 0xff0000; s = 3;  name = 'Elite';     geoType = 'box'; }
  else if (wave % 7 === 0){col = 0xffff00; s = 4; name = 'Tank';      geoType = 'dodecahedron'; }

  const enemy = {
    hp, maxHp: hp, speed: spd, t: 0, name, colour: col, id: uid(),
    effects: { frozen: 0, burning: 0 },
    mesh: null, _dead: false,
  };

  const geoSize = s * 1.5;
  let geo;
  switch (geoType) {
    case 'cone':         geo = new THREE.ConeGeometry(geoSize, geoSize * 2, 8); break;
    case 'cylinder':     geo = new THREE.CylinderGeometry(geoSize, geoSize, geoSize * 2, 12); break;
    case 'dodecahedron': geo = new THREE.DodecahedronGeometry(geoSize, 0); break;
    default:             geo = new THREE.BoxGeometry(geoSize * 2, geoSize * 2, geoSize * 2);
  }

  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;  mesh.receiveShadow = true;
  scene.add(mesh);
  enemy.mesh = mesh;

  /* health bar */
  const barGeo = new THREE.PlaneGeometry(geoSize * 2.5, 0.5);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(0, s + 1, 0);
  mesh.add(bar);
  enemy.hpBar = bar;

  G.enemies.push(enemy);
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  UPDATE LOOP                                                                             ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  /* always render the scene */
  if (G.state === 'playing' || G.state === 'wave_end' || G.state === 'idle') {
    updateCursor();
  }

  if (G.state === 'playing' || G.state === 'wave_end') {
    if (G.state === 'playing') {
      if (now >= G.nextSpawnTime && G.waveEnemiesSpawned < G.waveEnemyCount) {
        spawnEnemy(G.wave);
        G.waveEnemiesSpawned++;
        G.waveEnemyCount = calcWaveCount(G.wave);
        G.nextSpawnTime = now + G.spawnInterval * 1000;
      }
    }

    updateEnemies(dt);
    updateTowers(dt, now);
    updateProjectiles(dt);
    updateParticles(dt);
    updateUI();

    if (G.waveEnemiesSpawned >= G.waveEnemyCount && G.enemies.length === 0 && G.state === 'playing') {
      waveComplete();
    }

    if (G.lives <= 0 && G.state !== 'game_over') {
      gameOver();
    }
  }

  if (renderer) renderer.render(scene, camera);
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  ENEMY UPDATE                                                                           ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function updateEnemies(dt) {
  const totalLen = getTotalPathLength();
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e._dead) continue;

    let moveSpeed = e.speed;
    if (e.effects.frozen > 0) moveSpeed *= 0.5;
    if (e.effects.burning > 0) e.hp -= 5 * dt;

    e.t += (moveSpeed / totalLen) * dt;
    if (e.t >= 1) {
      castleHit(e);
      removeEnemy(i);
      continue;
    }

    const pos = getPathPoint(e.t);
    e.mesh.position.copy(pos);
    e.mesh.position.y = 1;

    if (e.effects.frozen > 0) e.effects.frozen -= dt;
    if (e.effects.burning > 0) e.effects.burning -= dt;

    if (e.hpBar) {
      e.hpBar.scale.x = Math.max(0, e.hp / e.maxHp);
      e.hpBar.position.y = 2 + (e.effects.frozen > 0 ? 0.1 : 0);
    }

    if (e.hp <= 0) {
      enemyKilled(e, i);
    }
  }
}

function removeEnemy(idx) {
  const e = G.enemies[idx];
  if (!e) return;
  if (e.mesh) { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
  G.enemies.splice(idx, 1);
}

function enemyKilled(e, idx) {
  e._dead = true;
  spawnDeathParticles(e.mesh.position.clone(), e.colour);
  play('hit');
  G.gold += 10 + (G.wave * 2);
  G.score += 100 * G.wave;
  removeEnemy(idx);
}

function castleHit(e) {
  G.lives -= 1;
  play('hit');
  if (G.castle) {
    G.castle.position.y += 2;
    setTimeout(() => { if (G.castle) G.castle.position.y -= 2; }, 100);
  }
  const idx = G.enemies.indexOf(e);
  if (idx !== -1) removeEnemy(idx);
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  TOWER LOGIC                                                                            ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function updateTowers(dt, now) {
  for (const tower of G.towers) {
    let target = null, bestDist = Infinity;
    for (const e of G.enemies) {
      if (e._dead) continue;
      const dist = dist2D(tower.position, e.mesh.position);
      if (dist <= tower.range && dist < bestDist) { target = e; bestDist = dist; }
    }

    if (target) {
      tower.targetMob = target;
      const dx = target.mesh.position.x - tower.position.x;
      const dz = target.mesh.position.z - tower.position.z;
      const angle = Math.atan2(dx, dz);
      tower.mesh.rotation.y = angle;

      if (now - tower.lastFire >= tower.fireRate * 1000) {
        tower.lastFire = now;
        fireProjectile(tower, target);
      }
    }
  }
}

function fireProjectile(tower, target) {
  const start = new THREE.Vector3(0, 15, 0).applyMatrix4(tower.mesh.matrixWorld);
  const projGeo = new THREE.SphereGeometry(0.7, 8, 8);
  const projMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
  const proj = new THREE.Mesh(projGeo, projMat);
  proj.position.copy(start);
  scene.add(proj);

  G.projectiles.push({
    mesh: proj,
    target: target,
    speed: 80,
    damage: tower.damage * tower.level,
    type: tower.type,
    dead: false,
  });
  play('shoot');
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  PROJECTILE UPDATE                                                                       ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    if (p.dead) { removeProjectile(i); continue; }
    if (!p.target || p.target._dead) { p.dead = true; continue; }

    const dir = new THREE.Vector3().subVectors(p.target.mesh.position, p.mesh.position);
    const dist = dir.length();

    if (dist < 2.0) {
      p.target.hp -= p.damage;
      if (p.target.type === 'IceTower') p.target.effects.frozen = 2.0;
      if (p.target.type === 'Flame') p.target.effects.burning = 3.0;
      p.dead = true;
    }

    dir.normalize();
    p.mesh.position.add(dir.multiplyScalar(p.speed * dt));
  }
}

function removeProjectile(idx) {
  const p = G.projectiles[idx];
  if (p && p.mesh) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
  G.projectiles.splice(idx, 1);
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  PARTICLES                                                                               ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function spawnDeathParticles(pos, colour) {
  for (let i = 0; i < 8; i++) {
    const pGeo = new THREE.SphereGeometry(0.4, 4, 4);
    const pMat = new THREE.MeshStandardMaterial({ color: colour });
    const mesh = new THREE.Mesh(pGeo, pMat);
    mesh.position.copy(pos);
    scene.add(mesh);
    G.particles.push({
      mesh, life: 1.0,
      vel: new THREE.Vector3(rngRange(-3, 3), rngRange(2, 6), rngRange(-3, 3)),
    });
  }
}

function spawnBuildParticle(x, y, z, colour) {
  for (let i = 0; i < 12; i++) {
    const pGeo = new THREE.SphereGeometry(0.3, 4, 4);
    const pMat = new THREE.MeshStandardMaterial({ color: colour });
    const mesh = new THREE.Mesh(pGeo, pMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    G.particles.push({
      mesh,
      life: 1.0,
      vel: new THREE.Vector3(rngRange(-3, 3), rngRange(4, 8), rngRange(-3, 3)),
    });
  }
}

function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 9.8 * dt;
    if (p.life <= 0) {
      scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose();
      G.particles.splice(i, 1);
    }
  }
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  CURSOR / PLACEMENT                                                                      ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function updateCursor() {
  if (G.isTowerSelected) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    let hitGround = null;
    for (const hit of intersects) {
      if (hit.object.userData.isGround) { hitGround = hit; break; }
    }
    if (hitGround) {
      const { x, z } = hitGround.point;
      if (!G.cursorMesh) createCursor();
      G.cursorMesh.position.set(x, 0.5, z);
      G.cursorMesh.visible = true;
      const canBuild = canBuildAt(x, z);
      G.cursorMesh.material.color.setHex(canBuild ? 0x00ff00 : 0xff0000);
      G.cursorMesh.material.opacity = canBuild ? 0.5 : 0.3;
      G.cursorMesh.material.transparent = true;
    } else if (G.cursorMesh) {
      G.cursorMesh.visible = false;
    }
  } else if (G.cursorMesh) {
    G.cursorMesh.visible = false;
  }
}

function createCursor() {
  const geo = new THREE.CylinderGeometry(4, 4, 0.2, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  G.cursorMesh = mesh;
}

function canBuildAt(x, z) {
  const pos = new THREE.Vector3(x, 0, z);
  for (const t of G.towers) {
    if (dist2D(pos, t.position) < 5) return false;
  }
  /* TODO: prevent building ON path – calc path dist > 8 */
  return true;
}

function tryBuild(x, z) {
  if (!G.isTowerSelected) return;
  if (!canBuildAt(x, z)) return;
  const cost = TOWER_SPECS[G.selectedType].cost;
  if (G.gold < cost) return;
  G.gold -= cost;
  createTower(G.selectedType, x, z);
  deselectTower();
}

function deselectTower() {
  G.isTowerSelected = false;
  G.selectedType = null;
  if (G.cursorMesh) { G.cursorMesh.visible = false; }
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  UI                                                                                       ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function setupInterface() {
  const buildPanel = document.getElementById('buildPanel');
  for (const [key, spec] of Object.entries(TOWER_SPECS)) {
    const btn = document.createElement('div');
    btn.className = 'tower-btn';
    btn.innerHTML = `<div style="font-weight:bold;color:${'#' + new THREE.Color(spec.colour).getHexString()}">${spec.name}</div><div>$${spec.cost}</div>`;
    btn.onclick = () => { selectTower(key); };
    buildPanel.appendChild(btn);
  }
}

function selectTower(type) {
  G.selectedType = type;
  G.isTowerSelected = true;
  if (!G.cursorMesh) createCursor();
  play('shoot');
}

function updateUI() {
  goldEl.textContent = G.gold;
  livesEl.textContent = G.lives;
  waveEl.textContent = G.wave;
  scoreEl.textContent = G.score;
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  STATE & WAVES                                                                           ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function startGame() {
  resetGame();
  G.state = 'playing';
  initWave();
  play('wave');
}

function calcWaveCount(wave) {
  return 5 + (wave * 2);
}

function initWave() {
  G.waveEnemyCount = calcWaveCount(G.wave);
  G.waveEnemiesSpawned = 0;
  G.waveEnemiesKilled = 0;
  G.nextSpawnTime = performance.now();
  G.spawnInterval = Math.max(0.3, 1.5 - (G.wave * 0.05));
}

function waveComplete() {
  G.state = 'wave_end';
  play('wave');
  G.gold += 50 + (G.wave * 10);
  setTimeout(() => {
    G.wave++;
    initWave();
    G.state = 'playing';
  }, 2000);
}

function gameOver() {
  G.state = 'game_over';
  play('gameover');
  document.getElementById('goWaves').textContent = G.wave;
  document.getElementById('goScore').textContent = G.score;
  document.getElementById('gameOver').classList.add('show');
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  GRASS TEXTURE (PROCEDURAL)                                                               ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function makeGrassTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2d5016';
  ctx.fillRect(0,0,size,size);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(${40+rng()*60},${80+rng()*100},${30+rng()*40},0.3)`;
    const s = 1 + rng() * 3;
    ctx.fillRect(rng()*size, rng()*size, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10,10);
  return tex;
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  EVENT LISTENERS                                                                           ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function addEventListeners() {
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(innerWidth, innerHeight);
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) *2 + 1;
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    let hitGround = null;
    for (const hit of intersects) {
      if (hit.object.userData.isGround) { hitGround = hit; break; }
    }
    if (hitGround) {
      const { x, z } = hitGround.point;
      tryBuild(x, z);
    }
  });
}

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║  INITIALISATION                                                                              ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
function resetGame() {
  /* remove all dynamic objects from scene, leaving static world */
  for (const t of G.towers)   { scene.remove(t.mesh); }
  for (const e of G.enemies)  { if (e.mesh) scene.remove(e.mesh); }
  for (const p of G.projectiles) { if (p.mesh) scene.remove(p.mesh); }
  for (const q of G.particles)   { if (q.mesh) scene.remove(q.mesh); }

  /* Generate a new random path for this game */
  makePath();

  G.gold     = INITIAL_GOLD;
  G.lives    = INITIAL_LIVES;
  G.wave     = 1;
  G.score    = 0;
  G.state    = 'playing';
  G.enemies  = [];
  G.towers   = [];
  G.projectiles = [];
  G.particles   = [];

  document.getElementById('gameOver').classList.remove('show');
}

/* event listeners for UI */
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startOverlay').classList.remove('show');
  startGame();
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOver').classList.remove('show');
  startGame();
});

/* start renderer, wait for Play button */
initRenderer();

/* force an immediate render to clear any black screen */
if (renderer) {
  try {
    renderer.render(scene, camera);
  } catch(e) {
    /* ignore */
  }
}

lastTime = performance.now();
requestAnimationFrame(gameLoop);
