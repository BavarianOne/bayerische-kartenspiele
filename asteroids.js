const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startBtn = document.getElementById('startBtn');

let W, H;
function resize(){ W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize);
resize();

// Game state
let ship, bullets, asteroids, keys, score, lives, running, respawnTimer;
let particles = [];

// Audio (created on first user gesture)
let audioCtx = null, masterGain = null, thrustGain = null, thrustOsc = null;

function rand(min,max){ return Math.random()*(max-min)+min }

function createShip(){
  return {
    x: W/2, y: H/2, r: 14,
    angle: -Math.PI/2, vx:0, vy:0,
    thrust:0, invulnerable:120
  };
}

function makeAsteroid(x,y,r){
  return {x,y,r,angle:rand(0,Math.PI*2),vx:rand(-1.2,1.2),vy:rand(-1.2,1.2)}
}

function spawnAsteroids(n){
  for(let i=0;i<n;i++){
    let edge = Math.floor(rand(0,4));
    let x = edge===0? -50 : edge===1? W+50 : rand(0,W);
    let y = edge===2? -50 : edge===3? H+50 : rand(0,H);
    asteroids.push(makeAsteroid(x,y, rand(20,70)));
  }
}

function reset(){
  ship=createShip(); bullets=[]; asteroids=[]; keys={}; score=0; lives=3; running=false; respawnTimer=0;
  scoreEl.textContent = 'Score: 0'; livesEl.textContent = 'Lives: 3';
}

function start(){ reset(); running=true; spawnAsteroids(5); }

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

startBtn.onclick = ()=>{ if(!running) start(); }

addEventListener('keydown', e=>{ if(e.code==='Space') e.preventDefault(); keys[e.code]=true; })
addEventListener('keyup', e=>{ keys[e.code]=false; })

// allow audio start on click of start button
startBtn.addEventListener('click', ()=>{ if(!audioCtx) ensureAudio(); if(!running) start(); });

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
    asteroids.push(makeAsteroid(a.x+a.r, a.y, r));
    asteroids.push(makeAsteroid(a.x-a.r, a.y, r));
  }
}

function explodeAsteroid(a){
  // particles
  const count = Math.min(40, Math.floor(a.r));
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = Math.random()*3 + (a.r/30);
    particles.push({x:a.x, y:a.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, life:60+Math.random()*40, size: Math.random()*3 + 1, color: 'orange'});
  }
  playExplosion(Math.min(1, a.r/70));
}

function update(){
  if(!running) return;
  // controls
  if(keys['ArrowLeft']) ship.angle -= 0.07;
  if(keys['ArrowRight']) ship.angle += 0.07;
  if(keys['ArrowUp']){
    ship.thrust = Math.min(1, (ship.thrust||0) + 0.06);
    ship.vx += Math.cos(ship.angle)*0.08*(1+ship.thrust*0.6);
    ship.vy += Math.sin(ship.angle)*0.08*(1+ship.thrust*0.6);
  } else {
    ship.thrust = Math.max(0, (ship.thrust||0) - 0.04);
  }
  if(keys['Space']){
    if(bullets.length<8){
      bullets.push({x:ship.x+Math.cos(ship.angle)*ship.r, y:ship.y+Math.sin(ship.angle)*ship.r, vx:ship.vx+Math.cos(ship.angle)*6, vy:ship.vy+Math.sin(ship.angle)*6, life:60});
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

  // asteroids
  asteroids.forEach(a=>{ a.x+=a.vx; a.y+=a.vy; a.angle+=0.01; wrap(a); });

  // collisions: bullets -> asteroids
  for(let i=asteroids.length-1;i>=0;i--){
    const a = asteroids[i];
    for(let j=bullets.length-1;j>=0;j--){
      if(dist(a, bullets[j]) < a.r){
        bullets.splice(j,1);
        const pts = Math.floor(100 - a.r);
        score += Math.max(10, pts);
        scoreEl.textContent = 'Score: '+score;
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
        lives--; livesEl.textContent = 'Lives: '+lives; respawnTimer=120; ship.invulnerable=120; ship.x = W/2; ship.y = H/2; ship.vx=ship.vy=0; explodeAsteroid(asteroids[i]); asteroids.splice(i,1);
        if(!audioCtx) ensureAudio(); playExplosion(1.0);
        if(lives<=0){ running=false; startBtn.textContent='Restart'; }
        break;
    }}
  } else { ship.invulnerable--; }

  // ensure some asteroids
  if(asteroids.length<3) spawnAsteroids(1);

  // update particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life--; p.vx *= 0.995; p.vy *= 0.995; if(p.life<=0) particles.splice(i,1);
  }
}

function drawShip(s){
  ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.angle);
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

function draw(){
  ctx.clearRect(0,0,W,H);
  // asteroids
  ctx.strokeStyle='#aaa'; ctx.lineWidth=2;
  asteroids.forEach(a=>{
    ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,Math.PI*2); ctx.stroke();
  });

  // bullets
  ctx.fillStyle='#ff8'; bullets.forEach(b=>{ ctx.fillRect(b.x-2,b.y-2,4,4); });

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

  if(!running){
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(W/2-160,H/2-40,320,80);
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='20px Arial';
    ctx.fillText('Press Start to play (Arrow keys + Space)', W/2, H/2);
  }
}

function loop(){ update(); draw(); requestAnimationFrame(loop); }

// initialize
reset(); requestAnimationFrame(loop);
