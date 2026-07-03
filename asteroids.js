const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const bestEl = document.getElementById('best');
const powerEl = document.getElementById('power');
const shieldEl = document.getElementById('shield');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
const overlayBtn = document.getElementById('overlayBtn');

let W, H;
function resize(){ W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize);
resize();

// Game state
let ship, bullets, asteroids, keys, score, lives, running, respawnTimer;
let particles = [];
let powerUps = [];
let boss = null;
let paused = false;
let bestScore = Number(localStorage.getItem('asteroidsBest') || 0);

// Audio (created on first user gesture)
let audioCtx = null, masterGain = null, thrustGain = null, thrustOsc = null;

function rand(min,max){ return Math.random()*(max-min)+min }

function createShip(){
  return {
    x: W/2, y: H/2, r: 14,
    angle: -Math.PI/2, vx:0, vy:0,
    thrust:0, invulnerable:120, firePower:1, shield:0
  };
}

function makeAsteroid(x,y,r,speedMultiplier=1){
  const roll = Math.random();
  let kind='normal';
  let color='#f7c948';
  let scoreValue=40;
  if(roll < 0.45){
    kind='normal'; color='#f7c948'; scoreValue=40;
  } else if(roll < 0.75){
    kind='speed'; color='#ff5f5f'; scoreValue=60;
  } else if(roll < 0.9){
    kind='split'; color='#4dd9ff'; scoreValue=80;
  } else {
    kind='bonus'; color='#c084fc'; scoreValue=120;
  }
  return {
    x,y,r,
    angle:rand(0,Math.PI*2),
    vx:rand(-1.2,1.2)*speedMultiplier,
    vy:rand(-1.2,1.2)*speedMultiplier,
    kind, color, scoreValue
  };
}

function getDifficultyLevel(){ return 1 + Math.floor(score / 400); }

function getAsteroidTargetCount(){ return Math.min(8, 3 + getDifficultyLevel()); }

function spawnAsteroids(n){
  const speedMultiplier = 1 + Math.min(1.4, (getDifficultyLevel()-1) * 0.08);
  for(let i=0;i<n;i++){
    let edge = Math.floor(rand(0,4));
    let x = edge===0? -50 : edge===1? W+50 : rand(0,W);
    let y = edge===2? -50 : edge===3? H+50 : rand(0,H);
    asteroids.push(makeAsteroid(x,y, rand(20,70), speedMultiplier));
  }
}

function updateHud(){
  scoreEl.textContent = 'Score: ' + score;
  livesEl.textContent = 'Lives: ' + lives;
  bestEl.textContent = 'Best: ' + bestScore;
  powerEl.textContent = 'Power: ' + ship.firePower;
  shieldEl.textContent = 'Shield: ' + (ship.shield > 0 ? 'On (' + Math.ceil(ship.shield/60) + ')' : 'Off');
}

function showOverlay(title, text, buttonLabel){
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayBtn.textContent = buttonLabel;
  overlayEl.classList.add('active');
}

function hideOverlay(){ overlayEl.classList.remove('active'); }

function reset(){
  ship=createShip(); bullets=[]; asteroids=[]; keys={}; score=0; lives=3; running=false; respawnTimer=0; particles=[]; powerUps=[]; boss=null; paused=false;
  startBtn.textContent = 'Start';
  pauseBtn.textContent = 'Pause';
  updateHud();
}

function startGame(){
  if(!audioCtx) ensureAudio();
  reset();
  running=true;
  startBtn.textContent = 'Restart';
  hideOverlay();
  spawnAsteroids(5);
}

function ensureAudio(){
  if(audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }catch(e){ return; }
  masterGain = audioCtx.createGain(); masterGain.gain.value = 0.8; masterGain.connect(audioCtx.destination);

  // thrust oscillator + gain
  thrustGain = audioCtx.createGain(); thrustGain.gain.value = 0; thrustGain.connect(masterGain);
  thrustOsc = audioCtx.createOscillator(); thrustOsc.type = 'sawtooth'; thrustOsc.frequency.value = 120;
  const thrustFilter = audioCtx.createBiquadFilter(); thrustFilter.type = 'lowpass'; thrustFilter.frequency.value = 900;
  thrustOsc.connect(thrustFilter); thrustFilter.connect(thrustGain);
  thrustOsc.start();
}

function playShoot(){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type='square'; o.frequency.value = 900; g.gain.value = 0.0001;
  o.connect(g); g.connect(masterGain);
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.08, now+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now+0.12);
  o.start(now); o.stop(now+0.13);
}

function playExplosion(vol=0.6){
  if(!audioCtx) return;
  const len = audioCtx.sampleRate * 1.0;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<len;i++){ data[i] = (Math.random()*2-1) * Math.exp(-i/ (len*0.3)); }
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(masterGain);
  src.start();
}

startBtn.onclick = ()=>{ startGame(); }
overlayBtn.onclick = ()=>{ startGame(); }
pauseBtn.onclick = ()=>{ if(running){ paused=!paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause'; } }

addEventListener('keydown', e=>{ if(e.code==='Space') e.preventDefault(); keys[e.code]=true; })
addEventListener('keyup', e=>{ keys[e.code]=false; })

// allow audio start on click of start button
startBtn.addEventListener('click', ()=>{ if(!audioCtx) ensureAudio(); if(!running) startGame(); });

// Touch / on-screen controls wiring
function bindTouchControls(){
  const buttons = document.querySelectorAll('.tc-btn');
  buttons.forEach(btn=>{
    const key = btn.dataset.key;
    const down = (e)=>{ e.preventDefault(); keys[key]=true; btn.classList.add('active'); if(!audioCtx) ensureAudio(); };
    const up = (e)=>{ if(e) e.preventDefault(); keys[key]=false; btn.classList.remove('active'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('touchstart', down, {passive:false});
    btn.addEventListener('touchend', up);
  });

  // Prevent default gestures on controls container
  const tc = document.getElementById('touch-controls');
  if(tc){ tc.style.touchAction = 'none'; }
}

// Initialize touch controls after DOM ready
if(document.readyState === 'complete' || document.readyState === 'interactive') bindTouchControls();
else addEventListener('DOMContentLoaded', bindTouchControls);

function wrap(obj){ if(obj.x< -100) obj.x = W+100; if(obj.x>W+100) obj.x = -100; if(obj.y< -100) obj.y = H+100; if(obj.y>H+100) obj.y = -100; }

function dist(a,b){ let dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

function splitAsteroid(a){
  if(a.r>25){
    const r=a.r/2;
    const speedMultiplier = 1 + Math.min(1.4, (getDifficultyLevel()-1) * 0.08);
    asteroids.push(makeAsteroid(a.x+a.r, a.y, r, speedMultiplier));
    asteroids.push(makeAsteroid(a.x-a.r, a.y, r, speedMultiplier));
  }
}

function explodeAsteroid(a){
  const count = Math.min(40, Math.floor(a.r));
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = Math.random()*3 + (a.r/30);
    particles.push({x:a.x, y:a.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, life:60+Math.random()*40, size: Math.random()*3 + 1, color: a.color});
  }
  playExplosion(Math.min(1, a.r/70));
}

function maybeSpawnPowerUp(){
  if(Math.random() < 0.004 && powerUps.length < 2){
    const type = Math.random() < 0.5 ? 'fire' : 'shield';
    powerUps.push({x:rand(30, W-30), y:rand(30, H-30), r:10, vx:rand(-0.6,0.6), vy:rand(-0.6,0.6), life:600, color:type==='fire'?'#00e5ff':'#7CFF7C', type});
  }
}

function maybeSpawnBoss(){
  if(!boss && score > 0 && score % 1000 < 20 && score > 500){
    boss = {x:W/2, y:-80, r:48, vx:1.2, vy:1.0, hp:12, color:'#ff4d6d'};
  }
}

function update(){
  if(!running || paused) return;
  // controls
  if(keys['ArrowLeft']) ship.angle -= 0.07;
  if(keys['ArrowRight']) ship.angle += 0.07;
  const accelerate = keys['ArrowUp'];
  const brake = keys['ArrowDown'];
  if(accelerate){
    ship.thrust = Math.min(1, (ship.thrust||0) + 0.06);
    ship.vx += Math.cos(ship.angle)*0.08*(1+ship.thrust*0.6);
    ship.vy += Math.sin(ship.angle)*0.08*(1+ship.thrust*0.6);
  } else if(brake){
    ship.thrust = Math.max(0, (ship.thrust||0) - 0.04);
    ship.vx *= 0.97;
    ship.vy *= 0.97;
  } else {
    ship.thrust = Math.max(0, (ship.thrust||0) - 0.04);
  }
  if(keys['Space']){
    const bulletCount = Math.min(3, ship.firePower);
    const spread = 0.12 * (bulletCount - 1);
    if(bullets.length < 8 + ship.firePower * 2){
      for(let i=0;i<bulletCount;i++){
        const angle = ship.angle - spread/2 + i * 0.12;
        bullets.push({x:ship.x+Math.cos(angle)*ship.r, y:ship.y+Math.sin(angle)*ship.r, vx:ship.vx+Math.cos(angle)*6, vy:ship.vy+Math.sin(angle)*6, life:60});
      }
      if(!audioCtx) ensureAudio(); playShoot();
    }
  }

  // update thrust audio gain
  if(audioCtx && thrustGain){
    try{ thrustGain.gain.setTargetAtTime(ship.thrust * 0.12, audioCtx.currentTime, 0.03); }catch(e){ thrustGain.gain.value = ship.thrust * 0.12; }
  }

  // physics
  ship.vx *= 0.994; ship.vy *= 0.994; ship.x+=ship.vx; ship.y+=ship.vy; wrap(ship);

  // bullets
  bullets.forEach(b=>{ b.x+=b.vx; b.y+=b.vy; b.life--; wrap(b); });
  bullets = bullets.filter(b=>b.life>0);

  // power-ups
  powerUps.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.life--; wrap(p); });
  powerUps = powerUps.filter(p=>p.life>0);
  for(let i=powerUps.length-1;i>=0;i--){
    const p = powerUps[i];
    if(dist(ship, p) < ship.r + p.r){
      if(p.type === 'fire'){ ship.firePower = Math.min(3, ship.firePower + 1); }
      else { ship.shield = 240; }
      updateHud();
      powerUps.splice(i, 1);
      break;
    }
  }

  // boss
  if(boss){
    boss.x += boss.vx; boss.y += boss.vy;
    if(boss.x < 60 || boss.x > W-60) boss.vx *= -1;
    if(boss.y < 60 || boss.y > H-60) boss.vy *= -1;
    if(Math.random() < 0.03) asteroids.push(makeAsteroid(boss.x, boss.y, 24, 1.2));
  }

  // asteroids
  asteroids.forEach(a=>{ a.x+=a.vx; a.y+=a.vy; a.angle+=0.01; wrap(a); });

  // collisions: bullets -> asteroids
  for(let i=asteroids.length-1;i>=0;i--){
    const a = asteroids[i];
    for(let j=bullets.length-1;j>=0;j--){
      if(dist(a, bullets[j]) < a.r){
        bullets.splice(j,1);
        const pts = Math.floor(100 - a.r);
        score += a.scoreValue;
        if(score > bestScore){ bestScore = score; localStorage.setItem('asteroidsBest', bestScore); }
        updateHud();
        // explosion + split
        explodeAsteroid(a);
        splitAsteroid(a);
        asteroids.splice(i,1);
        break;
      }
    }
  }

  // ship collisions
  if(ship.invulnerable<=0){
    for(let i=asteroids.length-1;i>=0;i--){ if(dist(ship,asteroids[i]) < ship.r + asteroids[i].r - 6){
        if(ship.shield > 0){ ship.shield = Math.max(0, ship.shield - 60); }
        else {
          lives--; respawnTimer=120; ship.invulnerable=120; ship.x = W/2; ship.y = H/2; ship.vx=ship.vy=0;
          if(lives<=0){
            running=false;
            startBtn.textContent='Restart';
            if(score > bestScore){ bestScore = score; localStorage.setItem('asteroidsBest', bestScore); }
            updateHud();
            showOverlay('Game Over', 'You scored ' + score + ' points.', 'Play Again');
          }
        }
        explodeAsteroid(asteroids[i]); asteroids.splice(i,1);
        if(!audioCtx) ensureAudio(); playExplosion(1.0);
        updateHud();
        break;
    }}
    if(boss && dist(ship, boss) < ship.r + boss.r - 6){
      if(ship.shield > 0){ ship.shield = Math.max(0, ship.shield - 60); }
      else {
        lives--; respawnTimer=120; ship.invulnerable=120; ship.x = W/2; ship.y = H/2; ship.vx=ship.vy=0;
        if(lives<=0){
          running=false;
          startBtn.textContent='Restart';
          if(score > bestScore){ bestScore = score; localStorage.setItem('asteroidsBest', bestScore); }
          updateHud();
          showOverlay('Game Over', 'You scored ' + score + ' points.', 'Play Again');
        }
      }
      updateHud();
    }
  } else { ship.invulnerable--; }

  if(ship.shield > 0) ship.shield--;

  // ensure some asteroids and increase difficulty over time
  if(asteroids.length < getAsteroidTargetCount()) spawnAsteroids(1);
  maybeSpawnPowerUp();
  maybeSpawnBoss();

  // update particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life--; p.vx *= 0.995; p.vy *= 0.995; if(p.life<=0) particles.splice(i,1);
  }
}

function drawShip(s){
  ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.angle);
  if(s.shield > 0){
    ctx.beginPath();
    ctx.arc(0,0,s.r+8,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(124,255,124,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(s.r,0); ctx.lineTo(-s.r*0.6,s.r*0.7); ctx.lineTo(-s.r*0.6,-s.r*0.7); ctx.closePath();
  ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.stroke();

  // draw thrust flame
  if(s.thrust > 0.01){
    const t = Math.min(1, s.thrust);
    const flameLen = s.r* (1 + 2*t);
    ctx.beginPath();
    ctx.moveTo(-s.r*0.6, -s.r*0.5);
    ctx.lineTo(-s.r*0.6 - flameLen, 0);
    ctx.lineTo(-s.r*0.6, s.r*0.5);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s.r*0.6,0,-s.r*0.6-flameLen,0);
    g.addColorStop(0,'rgba(255,200,0,'+ (0.6*t) +')');
    g.addColorStop(0.6,'rgba(255,80,0,'+ (0.6*t) +')');
    g.addColorStop(1,'rgba(255,20,0,0)');
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.restore();
}

function drawAsteroid(a){
  ctx.save();
  ctx.translate(a.x,a.y);
  ctx.rotate(a.angle);
  ctx.strokeStyle = a.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if(a.kind === 'bonus'){
    ctx.moveTo(0, -a.r);
    ctx.lineTo(a.r*0.35, -a.r*0.35);
    ctx.lineTo(a.r, 0);
    ctx.lineTo(a.r*0.35, a.r*0.35);
    ctx.lineTo(0, a.r);
    ctx.lineTo(-a.r*0.35, a.r*0.35);
    ctx.lineTo(-a.r, 0);
    ctx.lineTo(-a.r*0.35, -a.r*0.35);
  } else if(a.kind === 'split'){
    ctx.moveTo(0, -a.r);
    ctx.lineTo(a.r*0.55, -a.r*0.2);
    ctx.lineTo(a.r, a.r*0.2);
    ctx.lineTo(a.r*0.35, a.r);
    ctx.lineTo(0, a.r*0.55);
    ctx.lineTo(-a.r*0.35, a.r);
    ctx.lineTo(-a.r, a.r*0.2);
    ctx.lineTo(-a.r*0.55, -a.r*0.2);
  } else {
    ctx.moveTo(0, -a.r);
    ctx.lineTo(a.r*0.5, -a.r*0.35);
    ctx.lineTo(a.r, -a.r*0.1);
    ctx.lineTo(a.r*0.35, a.r*0.35);
    ctx.lineTo(a.r*0.5, a.r);
    ctx.lineTo(0, a.r*0.6);
    ctx.lineTo(-a.r*0.5, a.r);
    ctx.lineTo(-a.r*0.35, a.r*0.35);
    ctx.lineTo(-a.r, -a.r*0.1);
    ctx.lineTo(-a.r*0.5, -a.r*0.35);
  }
  ctx.closePath();
  ctx.fillStyle = a.color + '55';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,W,H);
  // asteroids
  asteroids.forEach(a=> drawAsteroid(a));

  // bullets
  ctx.fillStyle='#ff8'; bullets.forEach(b=>{ ctx.fillRect(b.x-2,b.y-2,4,4); });

  // boss
  if(boss){
    ctx.save();
    ctx.translate(boss.x,boss.y);
    ctx.strokeStyle = boss.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,boss.r,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#ff8'; ctx.fillRect(-8,-8,16,16);
    ctx.restore();
  }

  // power-ups
  powerUps.forEach(p=>{
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  });

  // ship with blink when invulnerable
  if(ship.invulnerable>0 && Math.floor(ship.invulnerable/6)%2===0) { /* skip draw to blink */ }
  else drawShip(ship);

  // particles
  particles.forEach(p=>{
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life/100);
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.globalAlpha = 1;
  });

  if(!running || paused){
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(W/2-160,H/2-40,320,80);
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='20px Arial';
    ctx.fillText(paused ? 'Paused' : 'Press Start to play (Arrow keys + Space)', W/2, H/2);
  }
}

function loop(){ update(); draw(); requestAnimationFrame(loop); }

// initialize
reset();
updateHud();
showOverlay('Shooter', 'Rotate, thrust, and shoot the asteroids before they hit you.', 'Start Game');
requestAnimationFrame(loop);
