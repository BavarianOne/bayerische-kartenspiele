const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");

const uiPos = document.getElementById("pos");
const uiLap = document.getElementById("lap");
const uiTime = document.getElementById("time");

// Unsichtbares Hilfs-Canvas für die Kollisionsprüfung (Strecke = Grau, Rasen = Grün)
const bgCanvas = document.createElement("canvas");
bgCanvas.width = 800;
bgCanvas.height = 600;
const bgCtx = bgCanvas.getContext("2d");

let gameRunning = false;
let startTime = 0;
let totalLaps = 3;
let waypoints = [];

let audioCtx = null;
let motorOsc = null;
let motorGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    motorOsc = audioCtx.createOscillator();
    motorGain = audioCtx.createGain();
    motorOsc.type = 'sawtooth'; 
    motorOsc.frequency.setValueAtTime(30, audioCtx.currentTime); 
    motorGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    motorOsc.connect(motorGain);
    motorGain.connect(audioCtx.destination);
    motorOsc.start(0);
}

function playBeep(freq, duration) {
    if(!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function generateDynamicTrack() {
    waypoints = [];
    const centerX = 400;
    const centerY = 300;
    const numPoints = 8; 
    
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radius = 170 + Math.random() * 90; 
        
        waypoints.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }
}

// Hilfsfunktion für eine schöne Ziellinie im Zielflaggen-Muster
function drawCheckeredLine(targetCtx, x, y, angle, width) {
    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.rotate(angle + Math.PI / 2); // Rechtwinklig zur Strecke

    const size = 6; // Kachelgröße
    const rows = Math.floor(width / size);
    
    for (let r = -rows/2; r < rows/2; r++) {
        for (let c = 0; c < 2; c++) {
            targetCtx.fillStyle = (r + c) % 2 === 0 ? "#fff" : "#000";
            targetCtx.fillRect(c * size - size, r * size, size, size);
        }
    }
    targetCtx.restore();
}

function renderTrackOnContext(targetCtx, clearColor) {
    targetCtx.fillStyle = clearColor;
    targetCtx.fillRect(0, 0, 800, 600);

    targetCtx.strokeStyle = "#7f8c8d";
    targetCtx.lineWidth = 90;
    targetCtx.lineCap = "round";
    targetCtx.lineJoin = "round";
    
    targetCtx.beginPath();
    targetCtx.moveTo(waypoints[0].x, waypoints[0].y);
    for(let i = 1; i < waypoints.length; i++) {
        targetCtx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    targetCtx.closePath();
    targetCtx.stroke();

    // Winkel für die Ziellinie berechnen (Richtung zum nächsten Waypoint)
    let angleToNext = Math.atan2(waypoints[1].y - waypoints[0].y, waypoints[1].x - waypoints[0].x);

    if (targetCtx === ctx) {
        targetCtx.strokeStyle = "#fff";
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([15, 15]);
        targetCtx.stroke();
        targetCtx.setLineDash([]);

        // Schöne Ziellinie zeichnen
        drawCheckeredLine(targetCtx, waypoints[0].x, waypoints[0].y, angleToNext, 90);
    }
}

// --- BOMBENFESTE STEUERUNG (PC & MOBIL) ---
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

// Tastatur für PC
window.addEventListener("keydown", e => { if(e.key in keys) keys[e.key] = true; });
window.addEventListener("keyup", e => { if(e.key in keys) keys[e.key] = false; });

// Mobil-Buttons direkt via ID binden (Verhindert Koordinaten-Fehler komplett)
function bindMobileControl(elementId, keyName) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const startEvent = (e) => {
        e.preventDefault();
        keys[keyName] = true;
        initAudio();
    };
    
    const endEvent = (e) => {
        e.preventDefault();
        keys[keyName] = false;
    };

    el.addEventListener("touchstart", startEvent, { passive: false });
    el.addEventListener("touchend", endEvent, { passive: false });
    el.addEventListener("touchcancel", endEvent, { passive: false });
}

bindMobileControl("btnLeft", "ArrowLeft");
bindMobileControl("btnRight", "ArrowRight");
bindMobileControl("btnUp", "ArrowUp");
bindMobileControl("btnDown", "ArrowDown");


class Car {
    constructor(x, y, color, isAI) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isAI = isAI;
        
        this.width = 24;
        this.height = 12;
        this.speed = 0;
        this.maxSpeed = isAI ? 3.3 : 4.0;
        this.acc = 0.12;
        this.friction = 0.04;
        this.angle = 0;
        this.turnSpeed = 0.045;
        
        this.currentWaypoint = 1;
        this.lapsCompleted = 0;
        this.passedHalfway = false;
    }

    update() {
        if (this.isAI) {
            this.handleAI();
        } else {
            this.handlePlayer();
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // Kollisions-Begrenzung via Pixel-Check
        if (this.x > 0 && this.x < 800 && this.y > 0 && this.y < 600) {
            let pixel = bgCtx.getImageData(Math.floor(this.x), Math.floor(this.y), 1, 1).data;
            if (pixel[1] === 204 && pixel[0] === 46) { 
                this.speed *= 0.75; 
                if (this.speed > 1.0) this.speed = 1.0; 
            }
        }

        // Sound-Anpassung
        if (!this.isAI && motorGain && audioCtx) {
            motorGain.gain.setTargetAtTime(0.08, audioCtx.currentTime, 0.1);
            let pitch = 30 + (Math.abs(this.speed) * 22);
            motorOsc.frequency.setTargetAtTime(pitch, audioCtx.currentTime, 0.1);
        }

        // Ziellinien-Durchfahrt tracken
        let distToStart = Math.sqrt(Math.pow(this.x - waypoints[0].x, 2) + Math.pow(this.y - waypoints[0].y, 2));
        if (distToStart < 45) {
            if (this.passedHalfway) {
                this.lapsCompleted++;
                this.passedHalfway = false;
                if (!this.isAI) playBeep(880, 0.25);
            }
        }
        
        if (this.currentWaypoint === Math.floor(waypoints.length / 2)) {
            this.passedHalfway = true;
        }
    }

    handlePlayer() {
        if (keys.ArrowUp) this.speed += this.acc;
        if (keys.ArrowDown) this.speed -= this.acc;

        if (!keys.ArrowUp && !keys.ArrowDown) {
            if (this.speed > 0) this.speed -= this.friction;
            if (this.speed < 0) this.speed += this.friction;
            if (Math.abs(this.speed) < 0.05) this.speed = 0;
        }

        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        if (this.speed !== 0) {
            const dir = this.speed > 0 ? 1 : -1;
            if (keys.ArrowLeft) this.angle -= this.turnSpeed * dir;
            if (keys.ArrowRight) this.angle += this.turnSpeed * dir;
        }
    }

    handleAI() {
        let target = waypoints[this.currentWaypoint];
        let dx = target.x - this.x;
        let dy = target.y - this.y;
        
        if (Math.sqrt(dx*dx + dy*dy) < 45) {
            this.currentWaypoint = (this.currentWaypoint + 1) % waypoints.length;
            target = waypoints[this.currentWaypoint];
            dx = target.x - this.x;
            dy = target.y - this.y;
        }
        
        let targetAngle = Math.atan2(dy, dx);
        let diff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));

        if (diff > 0.05) this.angle += this.turnSpeed;
        if (diff < -0.05) this.angle -= this.turnSpeed;

        this.speed += this.acc;
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Frontscheibe
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.width/6, -this.height/2 + 2, 4, this.height - 4);
        ctx.restore();
    }
}

let player = null;
let ai = null;

function updateUI() {
    let elapsed = (Date.now() - startTime) / 1000;
    let mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    let secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
    let ms = Math.floor((elapsed % 1) * 10);
    uiTime.innerText = `${mins}:${secs}.${ms}`;

    uiLap.innerText = `${player.lapsCompleted}/${totalLaps}`;

    if (player.lapsCompleted > ai.lapsCompleted || 
       (player.lapsCompleted === ai.lapsCompleted && player.currentWaypoint > ai.currentWaypoint)) {
        uiPos.innerText = "1. Platz";
        uiPos.style.color = "#2ecc71";
    } else {
        uiPos.innerText = "2. Platz";
        uiPos.style.color = "#e74c3c";
    }
}

function gameLoop() {
    if (!gameRunning) return;

    renderTrackOnContext(ctx, "#2ecc71");

    player.update();
    ai.update();
    
    player.draw();
    ai.draw();

    updateUI();

    if (player.lapsCompleted >= totalLaps) {
        gameRunning = false;
        if (motorGain) motorGain.gain.setValueAtTime(0, audioCtx.currentTime);
        alert("🏁 Gewonnen! Deine Zeit: " + uiTime.innerText);
        return;
    }
    if (ai.lapsCompleted >= totalLaps) {
        gameRunning = false;
        if (motorGain) motorGain.gain.setValueAtTime(0, audioCtx.currentTime);
        alert("Die KI hat gewonnen!");
        return;
    }

    requestAnimationFrame(gameLoop);
}

startBtn.addEventListener("click", () => {
    initAudio();
    startBtn.disabled = true;
    
    generateDynamicTrack();
    renderTrackOnContext(bgCtx, "#2ecc71");
    
    player = new Car(waypoints[0].x, waypoints[0].y - 12, "#e74c3c", false);
    ai = new Car(waypoints[0].x, waypoints[0].y + 12, "#3498db", true);
    
    let angleToFirstNode = Math.atan2(waypoints[1].y - waypoints[0].y, waypoints[1].x - waypoints[0].x);
    player.angle = angleToFirstNode;
    ai.angle = angleToFirstNode;
    
    let count = 3;
    uiTime.innerText = "Bereit...";
    
    let countdownInterval = setInterval(() => {
        if (count > 0) {
            uiTime.innerText = count;
            playBeep(440, 0.15);
            count--;
        } else {
            clearInterval(countdownInterval);
            uiTime.innerText = "GO!";
            playBeep(880, 0.4);
            
            startTime = Date.now();
            gameRunning = true;
            startBtn.disabled = false;
            gameLoop();
        }
    }, 800);
});

generateDynamicTrack();
renderTrackOnContext(ctx, "#2ecc71");