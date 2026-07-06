const fs = require('fs');

const js = `/* ============================================================
   Medieval Fortress 3D – Tower Defense
   Built with Three.js (r160)   |   Single-file version
   ============================================================ */

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'https://esm.sh/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js';

/* ─── Globals ─── */
let scene, camera, renderer, labelRenderer, controls;
let clock, raycaster, mouse;

/* Game state */
const game = {
  gold: 150, lives: 20, wave: 0, score: 0, started: false, over: false,
  buildMode: null, selectedTower: null, hoverTile: null,
  towers: [], enemies: [], lastProjectile: 0, projectiles: [], particles: [], floatingTexts: [],
  path: [], grid: [], cols: 15, rows: 11, tileSize: 10,
  waveData: {
    1: { count: 5,  hp: 30,  speed: 2,   value: 5 },
    2: { count: 8,  hp: 50,  speed: 2.2, value: 8 },
    3: { count: 10, hp: 70,  speed: 2.5, value: 10 },
    4: { count: 12, hp: 100, speed: 2.5, value: 12 },
    5: { count: 15, hp: 200, speed: 3,   value: 15 },
    6: { count: 20, hp: 300, speed: 3,   value: 18 },
    7: { count: 25, hp: 400, speed: 3.5, value: 22 },
    8: { count: 40, hp: 2000, speed: 5, value: 50 }
  },
  towerTypes: {
    archer: { name: 'Archer', icon: '🏹', cost: 50,  range: 15, damage: 15, rate: 1.0, color: 0x2e8b57, desc: 'Fast, single target' },
    cannon: { name: 'Cannon', icon: '💣', cost: 100, range: 20, damage: 40, rate: 0.5, color: 0x8b4513, desc: 'Slow, area damage' },
    frost:  { name: 'Frost',  icon: '❄',  cost: 120, range: 18, damage: 5,  rate: 1.2, color: 0x4682b4, desc: 'Slows enemies' },
    fire:   { name: 'Fire',   icon: '🔥', cost: 180, range: 22, damage: 25, rate: 1.5, color: 0xff4500, desc: 'High damage burst' },
    holy:   { name: 'Holy',   icon: '✨', cost: 300, range: 25, damage: 60, rate: 0.8, color: 0xffd700, desc: 'Anti-boss, high DPS' }
  }
};
let waveInProgress = false, enemiesSpawned = 0, spawnTimer = 0;

/* Three.js objects */
let boardGroup;

/* ═════ INIT ═════ */
init(); animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 50, 250);

  camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
  camera.position.set(80, 120, 100);
  camera.lookAt(75, 0, 55);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game').replaceWith(renderer.domElement);
  renderer.domElement.id = 'game';

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(innerWidth, innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(labelRenderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minPolarAngle = Math.PI / 6;
  controls.minDistance = 50;
  controls.maxDistance = 250;
  controls.target.set(75, 0, 55);
  controls.enabled = false;

  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffa07a, 0.8);
  dir.position.set(50, 100, 50);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -100; dir.shadow.camera.right = 200;
  dir.shadow.camera.top = 150; dir.shadow.camera.bottom = -100;
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x3a5f0d, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(75, -0.5, 55);
  ground.receiveShadow = true;
  scene.add(ground);

  boardGroup = new THREE.Group();
  scene.add(boardGroup);

  generatePath();
  buildBoard();

  const end = game.path[game.path.length - 1];
  const castle = createCastle();
  castle.position.set(end.x * game.tileSize, 0, end.y * game.tileSize);
  boardGroup.add(castle);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  buildUI();
  bindInput();

  addEventListener('resize', onResize);
  onResize();

  clock = new THREE.Clock();
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
}

/* ═════ PATH & BOARD ═════ */
function generatePath() {
  const s = game.cols, r = game.rows;
  const raw = [[0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[13,5],[14,5]];
  const pathSet = new Set();
  for (const [i,j] of raw) pathSet.add(i+','+j);
  for (const [i,j] of raw) {
    for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if (i+di >=0 && i+di < s && j+dj >=0 && j+dj < r) pathSet.add((i+di)+','+(j+dj));
    }
  }
  game.path = raw.map(p => ({ x: p[0], y: p[1] }));
  game.grid = [];
  for (let x = 0; x < s; x++) {
    game.grid[x] = [];
    for (let y = 0; y < r; y++) {
      game.grid[x][y] = !pathSet.has(x+','+y);
    }
  }
}

function buildBoard() {
  const geo = new THREE.BoxGeometry(game.tileSize * 0.95, 0.5, game.tileSize * 0.95);
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });
  const matDark = new THREE.MeshLambertMaterial({ color: 0x3a6c2f });
  const matPath = new THREE.MeshLambertMaterial({ color: 0xd4a76a });
  for (let x = 0; x < game.cols; x++) {
    for (let y = 0; y < game.rows; y++) {
      const isPath = !game.grid[x][y];
      const mesh = new THREE.Mesh(geo, isPath ? matPath : ((x+y)%2 ? mat : matDark));
      mesh.position.set(x * game.tileSize, isPath ? -0.2 : 0, y * game.tileSize);
      mesh.receiveShadow = true;
      mesh.userData = { gridX: x, gridY: y };
      boardGroup.add(mesh);
    }
  }
}

function createCastle() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), new THREE.MeshStandardMaterial({ color: 0x808080 }));
  base.position.y = 3; base.castShadow = true; g.add(base);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0x606060 }));
  tower.position.y = 10; tower.castShadow = true; g.add(tower);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  pole.position.y = 16; g.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
  flag.position.set(1.5, 18, 0); g.add(flag);
  return g;
}

/* ═════ UI BUILDERS ═════ */
function buildUI() {
  const panel = document.getElementById('buildPanel');
  panel.innerHTML = '';
  for (const key in game.towerTypes) {
    const t = game.towerTypes[key];
    const btn = document.createElement('button');
    btn.className = 'tower-btn';
    btn.innerHTML = \`<span class="icon">\${t.icon}</span><span>\${t.name}</span><small>\${t.cost}G</small>\`;
    btn.dataset.type = key;
    btn.title = t.desc;
    btn.onclick = () => selectTower(key, btn);
    panel.appendChild(btn);
  }
  document.getElementById('startBtn').onclick  = () => { startGame(); };
  document.getElementById('restartBtn').onclick = () => location.reload();
  updateHUD();
}

function startGame() {
  if (game.started) return;
  game.started = true;
  document.getElementById('startBtn').textContent = 'Next Wave';
  document.getElementById('startBtn').onclick = nextWave;
  document.getElementById('startScreen').style.display = 'none';
  controls.enabled = true;
}

function selectTower(type, btn) {
  if (!game.started) return;
  if (game.buildMode === type) { game.buildMode = null; updateBtnState(); return; }
  game.buildMode = type;
  game.selectedTower = null;
  closeTowerInfo();
  updateBtnState();
}

function updateBtnState() {
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.toggle('selected', b.dataset.type === game.buildMode));
}

function updateHUD() {
  document.getElementById('gold').textContent = game.gold;
  document.getElementById('lives').textContent = game.lives;
  document.getElementById('waveCount').textContent = game.wave;
  document.getElementById('score').textContent = game.score;
}

/* ═════ INPUTS ─── */
function bindInput() {
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
}

function onPointerMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  if (game.hoverTile) { boardGroup.remove(game.hoverTile); game.hoverTile = null; }
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(boardGroup.children);
  for (const hit of intersects) {
    const ud = hit.object.userData;
    if (ud.gridX === undefined) continue;
    if (game.grid[ud.gridX][ud.gridY]) showHover(ud.gridX, ud.gridY);
    break;
  }
}

function showHover(x, y) {
  if (game.hoverTile) boardGroup.remove(game.hoverTile);
  const g = new THREE.Mesh(
    new THREE.BoxGeometry(game.tileSize, 1, game.tileSize),
    new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 })
  );
  g.position.set(x * game.tileSize, 1, y * game.tileSize);
  boardGroup.add(g);
  game.hoverTile = g;
}

function onPointerDown(e) {
  if (e.button !== 0 || game.over) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(boardGroup.children);
  for (const hit of hits) {
    const ud = hit.object.userData;
    if (ud.gridX !== undefined) {
      if (game.buildMode && game.grid[ud.gridX][ud.gridY]) {
        buildTower(game.buildMode, ud.gridX, ud.gridY);
      } else if (ud.gridX !== undefined && !game.grid[ud.gridX][ud.gridY]) {
        // path tile clicked
      }
    } else if (hit.object.userData.tower) {
      selectExistingTower(hit.object.userData.tower);
    }
    break;
  }
}

/* ═════ TOWER MANAGEMENT ─── */
function buildTower(type, gx, gy) {
  const t = game.towerTypes[type];
  if (game.gold < t.cost) return;
  game.gold -= t.cost;
  updateHUD();
  const tower = createTowerMesh(type, gx, gy, game.tileSize);
  boardGroup.add(tower);
  tower.userData = { gridX: gx, gridY: gy, type, ...t, lastShot: 0, targets: [] };
  game.towers.push(tower);
  game.grid[gx][gy] = false;
  game.buildMode = null;
  updateBtnState();
}

function createTowerMesh(type, gx, gy, tileS) {
  const t = game.towerTypes[type];
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 4, 6), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
  base.position.y = 2; base.castShadow = true; g.add(base);
  const top = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: t.color, emissive: t.color, emissiveIntensity: 0.2 }));
  top.position.y = 5; top.castShadow = true; g.add(top);
  g.position.set(gx * tileS, 0, gy * tileS);
  g.userData.tower = g;
  return g;
}

function selectExistingTower(tower) {
  game.selectedTower = tower;
  showTowerInfo(tower);
}

function showTowerInfo(tower) {
  const el = document.getElementById('towerInfo');
  el.innerHTML = \`<strong>\${game.towerTypes[tower.userData.type].name}</strong><br>DMG: \${tower.userData.damage} | RATE: \${tower.userData.rate}\`;
  el.style.display = 'block';
}

function closeTowerInfo() { document.getElementById('towerInfo').style.display = 'none'; }

/* ═════ WAVES & ENEMIES ─── */
function nextWave() {
  if (waveInProgress) return;
  waveInProgress = true; enemiesSpawned = 0; spawnTimer = 0; game.wave++;
  document.getElementById('waveInfo').style.display = 'block';
  document.getElementById('waveInfo').textContent = \`Wave \${game.wave}\`;
  updateHUD();
}

function spawnEnemy() {
  const wd = game.waveData[game.wave];
  if (!wd) return null;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 }));
  body.castShadow = true; g.add(body);
  const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
  hpBar.position.y = 3; g.add(hpBar);
  g.position.set(-10, 1.8, game.path[0].y * game.tileSize);
  g.userData = { hp: wd.hp, maxHp: wd.hp, speed: wd.speed, value: wd.value, pathIndex: 0, hpBar };
  return g;
}

function createParticle(pos, color) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([0, 0, 0, Math.random()*2-1, Math.random()*2+1, Math.random()*2-1]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.5, transparent: true });
  const p = new THREE.Points(geo, mat);
  p.position.copy(pos);
  p.userData = { life: 1.0, velocity: new THREE.Vector3((Math.random()-0.5), Math.random()+0.5, (Math.random()-0.5)).multiplyScalar(2) };
  scene.add(p);
  game.particles.push(p);
}

/* ═════ PROJECTILES & HIT ─── */
function shoot(tower, target) {
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshStandardMaterial({ color: game.towerTypes[tower.userData.type].color, emissive: game.towerTypes[tower.userData.type].color, emissiveIntensity: 0.5 }));
  p.position.copy(tower.position); p.position.y += 3;
  const dir = new THREE.Vector3().subVectors(target.position, tower.position).normalize();
  p.userData = { speed: 40, damage: tower.userData.damage, target, dir };
  scene.add(p);
  game.projectiles.push(p);
}

function createHitEffect(pos, color) {
  const g = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
  g.position.copy(pos); scene.add(g); g.userData = { life: 0.3, maxLife: 0.3 };
  game.particles.push(g);
}

function showFloatingText(text, pos, color) {
  const el = document.createElement('div');
  el.className = 'floating-text';
  el.textContent = text; el.style.color = color; el.style.fontWeight = 'bold';
  const obj = new CSS2DObject(el); obj.position.copy(pos); obj.position.y += 2;
  scene.add(obj);
  game.floatingTexts.push({ obj, el, life: 1.5 });
}

/* ═════ GAME LOGIC ─── */
function updateEnemies(dt) {
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    const data = e.userData;
    const target = game.path[data.pathIndex + 1];
    if (target) {
      const tp = new THREE.Vector3(target.x * game.tileSize, 1.8, target.y * game.tileSize);
      const dir = tp.clone().sub(e.position).normalize();
      e.position.add(dir.multiplyScalar(data.speed * dt * 2));
      if (e.position.distanceTo(tp) < 1) data.pathIndex++;
    } else {
      game.lives--; updateHUD();
      showFloatingText('-1❤', e.position, '#ff0000');
      boardGroup.remove(e); game.enemies.splice(i, 1);
      if (game.lives <= 0) { gameOver(); return; }
      continue;
    }
    data.hpBar.scale.x = data.hp / data.maxHp;
  }
}

function updateTowers(dt, now) {
  for (const tower of game.towers) {
    const data = tower.userData;
    if (now - data.lastShot < 1 / data.rate) continue;
    const enemies = game.enemies.filter(e => tower.position.distanceTo(e.position) < data.range);
    if (enemies.length > 0) {
      data.lastShot = now;
      shoot(tower, enemies[0]);
    }
  }
}

function updateProjectiles(dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.position.add(p.userData.dir.clone().multiplyScalar(p.userData.speed * dt));
    if (p.userData.target && !p.userData.dead) {
      const t = p.userData.target;
      if (p.position.distanceTo(t.position) < 3) {
        t.userData.hp -= p.userData.damage;
        createHitEffect(t.position, 0xff0000);
        createParticle(t.position, 0xffaa00);
        if (t.userData.hp <= 0) {
          game.gold += t.userData.value; game.score += t.userData.value * 10; updateHUD();
          showFloatingText(\`+\${t.userData.value}G\`, t.position, '#ffd700');
          boardGroup.remove(t);
          game.enemies = game.enemies.filter(e => e !== t);
        }
        scene.remove(p); game.projectiles.splice(i, 1);
        continue;
      }
    }
    if (p.position.length() > 500) { scene.remove(p); game.projectiles.splice(i, 1); }
  }
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.userData.life -= dt;
    if (p.userData.velocity) { p.position.add(p.userData.velocity.clone().multiplyScalar(dt)); p.userData.velocity.y -= 9.8 * dt; }
    else if (p.material.opacity) { p.material.opacity = (p.userData.life / p.userData.maxLife) * 0.7; p.scale.setScalar(1 + (1 - p.userData联赛中我看好的p.userData.life / p.userData.max) * 2); }
    if (p.userData.life <= 0) { scene.remove(p); game.particles.splice(i, 1); }
  }
}

function updateFloatingTexts(dt) {
  for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
    const ft = game.floatingTexts[i];
    ft.life -= dt;
    ft.obj.position.y += dt * 2;
    ft.el.style.opacity = ft.life;
    if (ft.life <= 0) { scene.remove(ft.obj); game.floatingTexts.splice(i, 1); }
  }
}

/* ═════ GAME LOOP ─── */
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = clock.elapsedTime || 0;
  controls.update();

  if (waveInProgress && !game.over) {
    spawnTimer += dt;
    const wd = game.waveData[game.wave] || { count: 5, hp: 30, speed: 2, value: 5 };
    const spawnRate = 1; // seconds per enemy
    if (spawnTimer >= spawnRate && enemiesSpawned < wd.count) {
      const enemy = spawnEnemy();
      if (enemy) { boardGroup.add(enemy); game.enemies.push(enemy); enemiesSpawned++; }
      spawnTimer = 0;
    }
    if (enemiesSpawned >= wd.count && game.enemies.length === 0) {
      waveInProgress = false;
      document.getElementById('waveInfo').textContent = \`Wave \${game.wave} Complete!\`;
      setTimeout(() => { if (!waveInProgress) document.getElementById('waveInfo').style.display = 'none'; }, 2000);
    }
  }

  updateEnemies(dt);
  updateTowers(dt, now);
  updateProjectiles(dt);
  updateParticles(dt);
  updateFloatingTexts(dt);

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function gameOver() {
  game.over = true;
  document.getElementById('gameOver').style.display = 'flex';
  document.getElementById('finalWave').textContent = game.wave;
  document.getElementById('finalScore').textContent = game.score;
  controls.enabled = false;
}
`;

fs.writeFileSync('/home/reiner/github/bayerischeKartenspiele/td.js', js);
console.log('td.js written successfully');
