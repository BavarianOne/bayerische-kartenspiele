const SZ = 20, W = 10, H = 5, CL = '#444861', CF = '#7a7a7a', CW = '#6b4c35', CD = '#8a3323', CK = '#2e8b57', CT = 'gold', CE = 'red', CP = 'purple', CO = 'blue', CS = 'white';
let s, e, c, p, i = 0, tm = 0, sc = 0, kc = 0, tk = 0, lv = 1, ms = 10 + Date.now() % 5 * 2, l = 3, go = false, wi = false, ks = {}, mx = 0, my = 0, pr = true, fu = false, renderLoopId;
let scene, camera, renderer, walls, maze = [], itm = [], doors = [], keys = [], ens = [], traps = [], orbs = [], part = [], gr, wc = 0, hc = 0;

function gi(a) { return document.getElementById(a); }
function ae(t, e, l) { t.addEventListener(e, l); }

function IM() {
  const g = gi('cnv');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CL, 0.015);
  camera = new THREE.PerspectiveCamera(75, g.clientWidth / g.clientHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: g, antialias: true });
  renderer.setSize(g.clientWidth, g.clientHeight);
  renderer.shadowMap.enabled = true;
  gr = new THREE.Group();
  scene.add(gr);
  const al = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(al);
  const dl = new THREE.DirectionalLight(0xffffff, 0.5);
  dl.position.set(50, 100, 50);
  dl.castShadow = true;
  scene.add(dl);
  ae(window, 'resize', () => {
    const a = gi('cnv');
    camera.aspect = a.clientWidth / a.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(a.clientWidth, a.clientHeight);
  });
  ae(document, 'keydown', z => {
    const a = z.key.toLowerCase();
    ks[a] = true;
    if (a === 'arrowup') ks.w = true;
    if (a === 'arrowdown') ks.s = true;
    if (a === 'arrowleft') ks.a = true;
    if (a === 'arrowright') ks.d = true;
  });
  ae(document, 'keyup', z => {
    const a = z.key.toLowerCase();
    ks[a] = false;
    if (a === 'arrowup') ks.w = false;
    if (a === 'arrowdown') ks.s = false;
    if (a === 'arrowleft') ks.a = false;
    if (a === 'arrowright') ks.d = false;
  });
  ae(document, 'mousemove', z => {
    if (!pr) return;
    mx += z.movementX * 0.002;
    my = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, my + z.movementY * 0.002));
  });
  ae(document, 'click', () => {
    if (!pr && document.pointerLockElement !== gi('cnv')) gi('cnv').requestPointerLock();
  });
  ae(document, 'pointerlockchange', () => {
    if (!pr) pr = document.pointerLockElement !== gi('cnv');
  });
}

function MX(sx, sy) {
  const m = [];
  for (let y = 0; y < sy; y++) {
    const r = [];
    for (let x = 0; x < sx; x++) r.push({ w: true, v: false, x, y });
    m.push(r);
  }
  return m;
}

function GM(sx, sy) {
  const m = MX(sx, sy);
  const st = [{ x: 1, y: 1 }];
  m[1][1].v = true;
  while (st.length > 0) {
    const c = st[st.length - 1];
    const n = [
      { x: c.x + 2, y: c.y, d: 2 },
      { x: c.x - 2, y: c.y, d: -2 },
      { x: c.x, y: c.y + 2, d: sx * 2 },
      { x: c.x, y: c.y - 2, d: -sx * 2 }
    ].filter(a => a.x > 0 && a.x < sx - 1 && a.y > 0 && a.y < sy - 1 && !m[a.y][a.x].v);
    if (n.length > 0) {
      const r = n[Math.floor(Math.random() * n.length)];
      m[(c.y + r.y) / 2][(c.x + r.x) / 2].w = false;
      m[r.y][r.x].w = false;
      m[r.y][r.x].v = true;
      st.push({ x: r.x, y: r.y });
    } else st.pop();
  }
  m[1][1].w = false;
  m[sy - 2][sx - 2].w = false;
  return m;
}

function PM() {
  walls = new THREE.Group();
  const wm = new THREE.MeshPhongMaterial({ color: CW });
  for (let y = 0; y < hc; y++) for (let x = 0; x < wc; x++) if (maze[y][x].w) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, H, W), wm);
    b.position.set(x * W, 0, y * W);
    b.castShadow = true;
    b.receiveShadow = true;
    walls.add(b);
  }
  gr.add(walls);
  const fm = new THREE.MeshPhongMaterial({ color: CF });
  const fg = new THREE.PlaneGeometry(wc * W, hc * W);
  const f = new THREE.Mesh(fg, fm);
  f.rotation.x = -Math.PI / 2;
  f.position.set((wc - 1) * W / 2, -H / 2, (hc - 1) * W / 2);
  f.receiveShadow = true;
  gr.add(f);
  const cm = new THREE.MeshPhongMaterial({ color: CL });
  const cg = new THREE.PlaneGeometry(wc * W, hc * W);
  const c = new THREE.Mesh(cg, cm);
  c.rotation.x = Math.PI / 2;
  c.position.set((wc - 1) * W / 2, H * 2, (hc - 1) * W / 2);
  gr.add(c);
  const tm = new THREE.MeshPhongMaterial({ color: CT, emissive: 0xaa8800, shininess: 100 });
  const tg = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), tm);
  tg.position.set((wc - 2) * W, H / 2, (hc - 2) * W);
  tg.rotation.z = Math.PI / 2;
  gr.add(tg);
  const s = new THREE.PointLight(CT, 1, 15);
  s.position.copy(tg.position);
  scene.add(s);
}

function CKP(x, y) {
  keys.forEach(k => {
    if (!k.c && Math.abs(x - k.x) < 1.5 && Math.abs(y - k.y) < 1.5) {
      k.c = true;
      k.m.visible = false;
      kc++;
    }
  });
}

function CDP(x, y) {
  let b = false;
  doors.forEach((d, ix) => {
    if (Math.abs(x - d.x) < 1.2 && Math.abs(y - d.y) < 1.2) {
      if (kc > 0) {
        kc--;
        doors.splice(ix, 1);
        gr.remove(d.m);
        b = true;
      } else if (!b) showMsg('Need key!');
    }
  });
  return b;
}

function showMsg(t) {
  const m = gi('msg');
  if (!m) return;
  m.textContent = t;
  m.style.display = 'block';
  setTimeout(() => { m.style.display = 'none'; }, 2000);
}

function spawnItems() {
  keys = [];
  doors = [];
  ens = [];
  traps = [];
  orbs = [];
  
  // Spawn keys
  for (let i = 0; i < lv + 1; i++) {
    const k = findEmptyCell();
    if (!k) break;
    const km = new THREE.MeshPhongMaterial({ color: CK, emissive: 0x00ff00 });
    const kg = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), km);
    kg.position.set(k.x * W, 3, k.y * W);
    gr.add(kg);
    keys.push({ x: k.x * W, y: k.y * W, c: false, m: kg });
  }
  
  // Spawn doors
  for (let i = 0; i < lv; i++) {
    const k = findEmptyCell();
    if (!k) break;
    const dm = new THREE.MeshPhongMaterial({ color: CD });
    const dg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, H, W * 0.8), dm);
    dg.position.set(k.x * W, H / 2, k.y * W);
    dg.castShadow = true;
    gr.add(dg);
    doors.push({ x: k.x * W, y: k.y * W, m: dg });
  }
  
  // Spawn enemies
  for (let i = 0; i < lv; i++) {
    const k = findEmptyCell();
    if (!k) break;
    const em = new THREE.MeshPhongMaterial({ color: CE });
    const eg = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 8), em);
    eg.position.set(k.x * W, 3, k.y * W);
    gr.add(eg);
    ens.push({ x: k.x * W, y: k.y * W, m: eg, hp: 30 });
  }
  
  // Spawn traps
  for (let i = 0; i < lv; i++) {
    const k = findEmptyCell();
    if (!k) break;
    const tm = new THREE.MeshPhongMaterial({ color: CP });
    const tg = new THREE.Mesh(new THREE.RingGeometry(2, 4, 16), tm);
    tg.rotation.x = -Math.PI / 2;
    tg.position.set(k.x * W, 0.5, k.y * W);
    gr.add(tg);
    traps.push({ x: k.x * W, y: k.y * W, m: tg });
  }
  
  // Spawn orbs
  for (let i = 0; i < lv + 2; i++) {
    const k = findEmptyCell();
    if (!k) break;
    const om = new THREE.MeshPhongMaterial({ color: CO, emissive: 0x0088ff });
    const og = new THREE.Mesh(new THREE.SphereGeometry(1.5), om);
    og.position.set(k.x * W, 3, k.y * W);
    gr.add(og);
    orbs.push({ x: k.x * W, y: k.y * W, m: og });
  }
}

function findEmptyCell() {
  const empty = [];
  for (let y = 1; y < hc - 1; y++) for (let x = 1; x < wc - 1; x++) {
    if (!maze[y][x].w) {
      const cx = x * W, cy = y * W;
      let ok = true;
      [...keys, ...doors, ...ens, ...traps, ...orbs].forEach(o => {
        if (Math.abs(o.x - cx) < W && Math.abs(o.y - cy) < W) ok = false;
      });
      if (ok && Math.abs(cx - W) > W && Math.abs(cy - W) > W && 
          Math.abs(cx - (wc - 2) * W) > W && Math.abs(cy - (hc - 2) * W) > W) {
        empty.push({ x, y });
      }
    }
  }
  return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
}

function initLevel() {
  gi('lv').textContent = lv;
  gi('ky').textContent = kc + '/' + (lv + 1);
  gi('li').textContent = l;
  
  // Clear previous level
  [walls, keys, doors, ens, traps, orbs, part].forEach(g => {
    if (g && g.length) g.forEach(o => { if (o.m) { gr.remove(o.m); o.m.geometry?.dispose(); o.m.material?.dispose(); } });
    else if (g) { gr.remove(g); g.geometry?.dispose(); g.material?.dispose(); }
  });
  
  wc = 10 + lv * 3;
  hc = 10 + lv * 3;
  maze = GM(wc, hc);
  PM();
  spawnItems();
  
  // Player start
  p = { x: W, y: H / 2, z: W, vx: 0, vz: 0, rot: 0 };
  camera.position.set(p.x, p.y, p.z);
  camera.rotation.y = 0;
  
  tm = 60 + lv * 10;
  i = Date.now();
  go = false;
  wi = false;
}

function updateHUD() {
  gi('lv').textContent = lv;
  gi('ky').textContent = kc + '/' + (lv + 1);
  gi('tm').textContent = Math.max(0, Math.ceil(tm));
  gi('sc').textContent = sc;
  gi('li').textContent = l;
}

function movePlayer(dt) {
  const sp = 12 * dt;
  let dx = 0, dz = 0;
  const dir = new THREE.Vector2(Math.sin(camera.rotation.y), Math.cos(camera.rotation.y));
  if (ks.w || ks.arrowup) { dx -= dir.x; dz -= dir.y; }
  if (ks.s || ks.arrowdown) { dx += dir.x; dz += dir.y; }
  if (ks.a || ks.arrowleft) { dx -= dir.y; dz += dir.x; }
  if (ks.d || ks.arrowright) { dx += dir.y; dz -= dir.x; }
  
  if (dx || dz) {
    const len = Math.hypot(dx, dz);
    dx = dx / len * sp;
    dz = dz / len * sp;
    
    const nx = p.x + dx, nz = p.z + dz;
    const gx = Math.floor(nx / W), gz = Math.floor(nz / W);
    
    if (gx >= 0 && gx < wc && gz >= 0 && gz < hc && !maze[gz][gx].w) {
      p.x = nx; p.z = nz;
      camera.position.x = p.x; camera.position.z = p.z;
    }
  }
  
  camera.rotation.y = mx;
  camera.rotation.x = my;
}

function updateEnemies(dt) {
  ens.forEach(en => {
    const dx = p.x - en.x, dz = p.z - en.y;
    const dist = Math.hypot(dx, dz);
    if (dist < 30) {
      const sp = 4 * dt;
      en.x += dx / dist * sp;
      en.y += dz / dist * sp;
      en.m.position.set(en.x, 3, en.y);
    }
    if (dist < 3) {
      l--;
      updateHUD();
      showMsg('Hit!');
      if (l <= 0) gameOver();
    }
  });
}

function updateTraps() {
  traps.forEach(t => {
    if (Math.hypot(p.x - t.x, p.z - t.y) < 3) {
      l--;
      updateHUD();
      showMsg('Trap!');
      if (l <= 0) gameOver();
    }
  });
}

function updateOrbs() {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.m.rotation.y += 0.01;
    o.m.position.y = 3 + Math.sin(Date.now() * 0.003 + i) * 0.5;
    if (Math.hypot(p.x - o.x, p.z - o.y) < 3) {
      tm += 15;
      sc += 50;
      gr.remove(o.m);
      orbs.splice(i, 1);
    }
  }
}

function checkGoal() {
  if (Math.hypot(p.x - (wc - 2) * W, p.z - (hc - 2) * W) < 5) {
    win();
  }
}

function win() {
  wi = true;
  sc += tm * 10 + lv * 100;
  showMsg('Level Complete! Score: ' + sc);
  lv++;
  setTimeout(() => {
    initLevel();
  }, 2000);
}

function gameOver() {
  go = true;
  showMsg('Game Over! Final Score: ' + sc);
  setTimeout(() => {
    gi('intro').style.display = 'flex';
    gi('hud').style.display = 'none';
    gi('cnv').style.display = 'none';
    l = 3; lv = 1; sc = 0;
  }, 3000);
}

function animate() {
  if (go || wi) return;
  renderLoopId = requestAnimationFrame(animate);
  const now = Date.now();
  const dt = Math.min(0.05, (now - i) / 1000);
  i = now;
  
  tm -= dt;
  if (tm <= 0) { gameOver(); return; }
  
  movePlayer(dt);
  updateEnemies(dt);
  updateTraps();
  updateOrbs();
  checkGoal();
  updateHUD();
  
  // Particle updates
  part.forEach((pt, i) => {
    pt.life -= dt;
    if (pt.life <= 0) { gr.remove(pt.m); part.splice(i, 1); }
    else { pt.m.position.addScaledVector(pt.vel, dt); }
  });
  
  renderer.render(scene, camera);
}

function startGame() {
  gi('intro').style.display = 'none';
  gi('hud').style.display = 'flex';
  gi('cnv').style.display = 'block';
  lv = parseInt(gi('lvl').value) || 1;
  IM();
  initLevel();
  animate();
}

// Event listeners
ae(gi('sB'), 'click', startGame);
ae(gi('fs'), 'click', () => {
  if (!document.fullscreenElement) gi('cnv').requestFullscreen();
  else document.exitFullscreen();
});

// Initialize
gi('hud').style.display = 'none';
gi('cnv').style.display = 'none';