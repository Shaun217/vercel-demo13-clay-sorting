// --- Game State & Configuration ---
const STATE = {
    SETUP: 0,
    NAME_ENTRY: 1,
    PLAYING: 2,
    TRANSITION: 3,
    GAME_OVER: 4
};

const GAME_CFG = {
    ROUND_TIME: 30, // seconds
    SPAWN_RATE_MIN: 500, // ms
    SPAWN_RATE_MAX: 1500, // ms
    RECOIL_THRESHOLD: 40, // Pixel movement upwards to trigger shot
    SMOOTHING: 0.3 // Lerp factor (0-1)
};

let appState = STATE.SETUP;
let players = [];
let currentPlayerIndex = 0;
let roundTimer = 0;
let lastSpawnTime = 0;
let score = 0;
let hitCounts = { r: 0, y: 0, g: 0 };
let gameInterval, spawnTimer;

// --- Canvas & Audio Setup ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const videoElement = document.getElementById('input-video');

// Resize canvas to fullscreen
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Audio Context (Synthesizer)
let audioCtx;
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    }
}

// --- Game Objects ---
let targets = [];
let particles = [];
let crosshair = { x: 0, y: 0, active: false };
let lastTipY = 0; // For recoil detection

class Target {
    constructor() {
        this.y = Math.random() * (canvas.height - 200) + 100;
        this.radius = 0;
        this.speed = 0;
        this.points = 0;
        this.color = '';
        this.isDead = false;
        
        // Randomize Type
        const r = Math.random();
        if (r < 0.2) { // Red (Fast/Small)
            this.type = 'red';
            this.radius = 30;
            this.speed = 8;
            this.points = 50;
            this.color = '#ff3333';
        } else if (r < 0.5) { // Yellow (Med)
            this.type = 'yellow';
            this.radius = 50;
            this.speed = 5;
            this.points = 20;
            this.color = '#ffff33';
        } else { // Green (Slow/Big)
            this.type = 'green';
            this.radius = 70;
            this.speed = 3;
            this.points = 10;
            this.color = '#33ff33';
        }

        // Direction: Left->Right or Right->Left
        if (Math.random() > 0.5) {
            this.x = -this.radius;
            this.vx = this.speed;
        } else {
            this.x = canvas.width + this.radius;
            this.vx = -this.speed;
        }
    }

    update() {
        this.x += this.vx;
        // Kill if off screen
        if ((this.vx > 0 && this.x > canvas.width + 100) || (this.vx < 0 && this.x < -100)) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = this.color;
        ctx.stroke();
        
        // Inner rings
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- MediaPipe Hands Setup ---
const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720
});
camera.start();

// --- Main Loop ---
function onResults(results) {
    // 1. Draw Video Feed
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Mirror video
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 2. Process Hand Logic
    let isGunGesture = false;
    let rawX = 0, rawY = 0;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Coordinates: Landmark 8 is Index Tip
        // Note: Coordinates are normalized 0-1, need to flip X because of mirroring
        rawX = (1 - landmarks[8].x) * canvas.width; 
        rawY = landmarks[8].y * canvas.height;

        // Simple Gun Gesture Check: Index extended, Pinky curled
        const indexTip = landmarks[8];
        const indexDip = landmarks[7];
        const pinkyTip = landmarks[20];
        const pinkyMcp = landmarks[17];

        const isIndexExtended = indexTip.y < indexDip.y; // Y increases downward
        const isPinkyCurled = pinkyTip.y > pinkyMcp.y;

        if (isIndexExtended && isPinkyCurled) {
            isGunGesture = true;
        }
    }

    if (appState === STATE.PLAYING) {
        // Handle Aiming
        if (isGunGesture) {
            // Lerp smoothing
            crosshair.x = crosshair.x + (rawX - crosshair.x) * GAME_CFG.SMOOTHING;
            crosshair.y = crosshair.y + (rawY - crosshair.y) * GAME_CFG.SMOOTHING;
            crosshair.active = true;

            // Handle Shooting (Recoil Detection)
            // Calculate vertical velocity: Previous Y - Current Y
            // If positive and large, finger moved UP quickly
            const deltaY = lastTipY - rawY; 
            
            if (deltaY > GAME_CFG.RECOIL_THRESHOLD) {
                fireShot();
            }
            lastTipY = rawY;
        } else {
            crosshair.active = false;
        }

        // Draw Game Elements
        drawGame(ctx);
    }
}

function drawGame(ctx) {
    // 1. Update & Draw Targets
    const now = Date.now();
    if (now - lastSpawnTime > (Math.random() * (GAME_CFG.SPAWN_RATE_MAX - GAME_CFG.SPAWN_RATE_MIN) + GAME_CFG.SPAWN_RATE_MIN)) {
        targets.push(new Target());
        lastSpawnTime = now;
    }

    targets.forEach((t, index) => {
        t.update();
        t.draw(ctx);
        if (t.isDead) targets.splice(index, 1);
    });

    // 2. Update & Draw Particles
    particles.forEach((p, index) => {
        p.update();
        p.draw(ctx);
        if (p.life <= 0) particles.splice(index, 1);
    });

    // 3. Draw Crosshair
    if (crosshair.active) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(crosshair.x, crosshair.y, 20, 0, Math.PI * 2);
        ctx.moveTo(crosshair.x - 30, crosshair.y);
        ctx.lineTo(crosshair.x + 30, crosshair.y);
        ctx.moveTo(crosshair.x, crosshair.y - 30);
        ctx.lineTo(crosshair.x, crosshair.y + 30);
        ctx.stroke();
    }
}

function fireShot() {
    playSound('shoot');
    
    // Visual flash
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Collision Check
    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        const dx = crosshair.x - t.x;
        const dy = crosshair.y - t.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < t.radius) {
            // HIT!
            playSound('hit');
            score += t.points;
            if (t.type === 'red') hitCounts.r++;
            if (t.type === 'yellow') hitCounts.y++;
            if (t.type === 'green') hitCounts.g++;
            updateHUD();

            // Create explosion
            for (let j = 0; j < 10; j++) {
                particles.push(new Particle(t.x, t.y, t.color));
            }
            
            targets.splice(i, 1);
            break; // Bullet hits only one target
        }
    }
}

// --- UI Logic & Flow ---

const ui = {
    setup: document.getElementById('setup-screen'),
    name: document.getElementById('name-screen'),
    hud: document.getElementById('hud'),
    trans: document.getElementById('transition-screen'),
    leader: document.getElementById('leaderboard-screen')
};

// Button Events
document.getElementById('btn-setup-next').onclick = () => {
    const count = parseInt(document.getElementById('player-count-input').value);
    for(let i=0; i<count; i++) players.push({name: `P${i+1}`, score: 0});
    
    ui.setup.classList.remove('active');
    setupPlayerTurn();
};

document.getElementById('btn-start-game').onclick = () => {
    const nameInput = document.getElementById('player-name-input');
    if(nameInput.value) players[currentPlayerIndex].name = nameInput.value;
    
    ui.name.classList.remove('active');
    ui.hud.style.display = 'flex';
    startGame();
};

document.getElementById('btn-next-player').onclick = () => {
    ui.trans.classList.remove('active');
    currentPlayerIndex++;
    if(currentPlayerIndex < players.length) {
        setupPlayerTurn();
    } else {
        showLeaderboard();
    }
};

document.getElementById('btn-restart').onclick = () => {
    location.reload();
};

function setupPlayerTurn() {
    appState = STATE.NAME_ENTRY;
    ui.name.classList.add('active');
    document.getElementById('current-player-num').innerText = currentPlayerIndex + 1;
    document.getElementById('player-name-input').value = `Player ${currentPlayerIndex + 1}`;
}

function startGame() {
    // Reset Round
    appState = STATE.PLAYING;
    score = 0;
    hitCounts = {r:0, y:0, g:0};
    targets = [];
    particles = [];
    roundTimer = GAME_CFG.ROUND_TIME;
    
    document.getElementById('player-name-display').innerText = players[currentPlayerIndex].name;
    updateHUD();

    // Init Audio Context (needs interaction)
    if (!audioCtx) playSound('hit');

    // Timer Interval
    clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        roundTimer--;
        updateHUD();
        if(roundTimer <= 0) endGame();
    }, 1000);
}

function updateHUD() {
    document.getElementById('timer-display').innerText = roundTimer;
    document.getElementById('total-score').innerText = `SCORE: ${score}`;
    document.getElementById('score-details').innerHTML = 
        `<span style="color:#ff3333">R:${hitCounts.r}</span> 
         <span style="color:#ffff33">Y:${hitCounts.y}</span> 
         <span style="color:#33ff33">G:${hitCounts.g}</span>`;
}

function endGame() {
    clearInterval(gameInterval);
    appState = STATE.TRANSITION;
    players[currentPlayerIndex].score = score;
    
    ui.hud.style.display = 'none';
    ui.trans.classList.add('active');
    document.getElementById('round-score').innerText = `Score: ${score}`;
    document.getElementById('round-stats').innerText = 
        `Red: ${hitCounts.r} | Yellow: ${hitCounts.y} | Green: ${hitCounts.g}`;
    
    playSound('win');
}

function showLeaderboard() {
    appState = STATE.GAME_OVER;
    ui.trans.classList.remove('active');
    ui.leader.classList.add('active');
    
    // Sort players
    const sorted = [...players].sort((a,b) => b.score - a.score);
    
    // Podium
    if(sorted[0]) document.getElementById('winner-1').innerText = `${sorted[0].name}\n${sorted[0].score}`;
    if(sorted[1]) document.getElementById('winner-2').innerText = `${sorted[1].name}\n${sorted[1].score}`;
    if(sorted[2]) document.getElementById('winner-3').innerText = `${sorted[2].name}\n${sorted[2].score}`;

    // List
    const list = document.getElementById('score-list');
    list.innerHTML = '';
    sorted.forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>#${i+1} ${p.name}</span><span>${p.score} pts</span>`;
        list.appendChild(li);
    });
}