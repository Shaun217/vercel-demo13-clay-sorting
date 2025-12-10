// --- Configuration ---
const COLORS = {
    bg: 0x1A2F23,   // Pine Green
    red: 0xD42E2E,  // Christmas Red
    gold: 0xF1C40F, // Bell Gold
    green: 0x27AE60,// Tree Green
    brown: 0x8B4513,// Tree Trunk
    white: 0xFDF8F5,
    darkIcon: 0x2C3E50
};

const SHAPE_COUNT = 10;

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    if (type === 'pop') {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.8);
    }
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
}

// --- Game Logic ---
const game = {
    playerName: "Player",
    remaining: 0,
    startTime: 0,
    timerInterval: null,
    
    screens: {
        start: document.getElementById('screen-start'),
        hud: document.getElementById('hud'),
        result: document.getElementById('screen-result')
    },

    showScreen: (name) => {
        Object.values(game.screens).forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none'; 
        });
        
        if(name === 'hud') {
            game.screens.hud.style.display = 'flex';
        } else {
            game.screens[name].style.display = 'flex';
            setTimeout(() => game.screens[name].classList.add('active'), 10);
        }
    },

    init: () => {
        game.showScreen('start');
    },

    startRound: () => {
        const nameInput = document.getElementById('input-name').value;
        game.playerName = nameInput || "Santa's Helper";
        
        // Reset Data
        game.remaining = SHAPE_COUNT;
        document.getElementById('hud-remaining').innerText = game.remaining;
        
        game.showScreen('hud');
        
        // Spawn 3D objects
        scene3D.clearShapes();
        scene3D.spawnShapes(SHAPE_COUNT);
        
        // Start Timer
        game.startTime = Date.now();
        clearInterval(game.timerInterval);
        
        game.timerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - game.startTime) / 1000;
            document.getElementById('hud-timer').innerText = elapsed.toFixed(1) + 's';
        }, 100);
    },

    onShapeSorted: () => {
        game.remaining--;
        document.getElementById('hud-remaining').innerText = game.remaining;
        playSound('pop');
        
        if (game.remaining <= 0) {
            game.endRound();
        }
    },

    endRound: () => {
        clearInterval(game.timerInterval);
        const elapsed = (Date.now() - game.startTime) / 1000;
        
        document.getElementById('result-name').innerText = game.playerName;
        document.getElementById('result-time').innerText = elapsed.toFixed(2) + 's';
        
        game.showScreen('result');
        playSound('win');
    }
};

document.getElementById('btn-start').onclick = game.startRound;

// --- Three.js Setup ---
const canvas = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.Fog(COLORS.bg, 20, 50);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 100);
camera.position.set(0, 7, 18); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvas.appendChild(renderer.domElement);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 12, 8);
dirLight.castShadow = true;
scene.add(dirLight);

// Materials (Matte Clay Look)
const mats = {
    red: new THREE.MeshStandardMaterial({ color: COLORS.red, roughness: 0.6, metalness: 0.1 }),
    gold: new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.4, metalness: 0.6 }),
    green: new THREE.MeshStandardMaterial({ color: COLORS.green, roughness: 0.8, metalness: 0.0 }),
    brown: new THREE.MeshStandardMaterial({ color: COLORS.brown, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: COLORS.white, roughness: 1.0 }),
    icon: new THREE.MeshBasicMaterial({ color: COLORS.darkIcon })
};

// --- Objects Builder ---
const shapes = [];
const particles = [];
const targets = [];

// 核心修改：用组合几何体创建更像的物体
function createGeometry(type) {
    const group = new THREE.Group();
    
    if (type === 'tree') {
        // 1. Trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5), mats.brown);
        trunk.position.y = -0.6;
        trunk.castShadow = true;
        group.add(trunk);

        // 2. Layers of Leaves
        const l1 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 8), mats.green);
        l1.position.y = -0.3;
        l1.castShadow = true;
        group.add(l1);

        const l2 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 8), mats.green);
        l2.position.y = 0.0;
        l2.castShadow = true;
        group.add(l2);

        const l3 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 8), mats.green);
        l3.position.y = 0.3;
        l3.castShadow = true;
        group.add(l3);

        // 3. Star on top
        const star = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mats.gold);
        star.position.y = 0.55;
        group.add(star);
    } 
    else if (type === 'bell') {
        // 1. Bell Body (Open bottom)
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 0.7, 16), mats.gold);
        bell.castShadow = true;
        group.add(bell);

        // 2. Bell Rim (Torus)
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 16), mats.gold);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -0.35;
        group.add(rim);

        // 3. Handle (Top ring)
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), mats.gold);
        handle.position.y = 0.35;
        group.add(handle);

        // 4. Clapper (Bottom ball)
        const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.15), mats.gold);
        clapper.position.y = -0.3;
        group.add(clapper);
    } 
    else if (type === 'ball') {
        // 1. Red Sphere
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), mats.red);
        ball.castShadow = true;
        group.add(ball);

        // 2. Gold Cap
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.15, 16), mats.gold);
        cap.position.y = 0.5;
        group.add(cap);

        // 3. Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16), mats.gold);
        ring.position.y = 0.6;
        group.add(ring);
    }
    
    return group;
}

// Create Targets (Boxes with Icons)
function createTarget(x, type) {
    const group = new THREE.Group();
    group.position.set(x, -3.5, 0);

    // Box Body
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), mats.white);
    box.receiveShadow = true;
    group.add(box);

    // Icon representation
    let icon;
    if (type === 'tree') {
        // Triangle Icon
        icon = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.05, 3), mats.icon);
        icon.rotation.x = -Math.PI / 2; // Lie flat
        icon.rotation.z = Math.PI; // Point up
    } 
    else if (type === 'bell') {
        // Bell Icon shape
        icon = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 0.05, 16), mats.icon);
    } 
    else {
        // Circle Icon
        icon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), mats.icon);
    }

    icon.position.y = 0.61;
    group.add(icon);

    scene.add(group);
    targets.push({ type, x, mesh: group });
}

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: COLORS.bg, roughness: 1 })
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -5;
floor.receiveShadow = true;
scene.add(floor);

createTarget(-3, 'tree');
createTarget(0, 'bell');
createTarget(3, 'ball');

// Spawn Logic
const scene3D = {
    spawnShapes: (count) => {
        const types = ['tree', 'bell', 'ball'];
        
        for(let i=0; i<count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const meshGroup = createGeometry(type);
            
            // Random Pos
            const posX = (Math.random() - 0.5) * 8; 
            const posY = 3 + Math.random() * 4;  
            const posZ = (Math.random() - 0.5) * 2; 
            
            meshGroup.position.set(posX, posY, posZ);
            // Random rotation
            meshGroup.rotation.set(Math.random(), Math.random(), Math.random());
            
            // User Data
            meshGroup.userData = { type, originalPos: meshGroup.position.clone(), isReturning: false };
            
            scene.add(meshGroup);
            shapes.push(meshGroup);
        }
    },

    clearShapes: () => {
        shapes.forEach(s => scene.remove(s));
        shapes.length = 0;
    },

    createExplosion: (pos, color) => {
        for(let i=0; i<10; i++) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({color}));
            p.position.copy(pos);
            p.position.x += (Math.random()-0.5);
            p.position.y += (Math.random()-0.5);
            p.userData = { 
                vel: new THREE.Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2),
                life: 1.0 
            };
            scene.add(p);
            particles.push(p);
        }
    }
};

// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let draggedObject = null;

function onDown(x, y) {
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    // Check intersection (recursive true to hit parts of groups)
    const intersects = raycaster.intersectObjects(shapes, true);

    if (intersects.length > 0) {
        // We hit a child mesh, need to find the parent group
        let obj = intersects[0].object;
        while(obj.parent && obj.parent.type !== 'Scene') {
            if(obj.userData.type) break; // Found the main group
            obj = obj.parent;
        }
        
        // Ensure we grabbed the group with logic
        if(obj.userData && obj.userData.type) {
            draggedObject = obj;
            draggedObject.userData.isReturning = false;
        }
    }
}

function onMove(x, y) {
    if (!draggedObject) return;

    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    if (intersectPoint) {
        draggedObject.position.copy(intersectPoint);
        draggedObject.position.z = 2; // Pull forward
        draggedObject.rotation.x += 0.05;
        draggedObject.rotation.y += 0.05;
    }
}

function onUp() {
    if (!draggedObject) return;

    let match = false;
    for (const t of targets) {
        const dx = draggedObject.position.x - t.x;
        const dy = draggedObject.position.y - t.mesh.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 1.8 && draggedObject.userData.type === t.type) {
            match = true;
            game.onShapeSorted();
            
            // Explosion color
            let color = COLORS.white;
            if(draggedObject.userData.type === 'tree') color = COLORS.green;
            if(draggedObject.userData.type === 'bell') color = COLORS.gold;
            if(draggedObject.userData.type === 'ball') color = COLORS.red;

            scene3D.createExplosion(draggedObject.position, color);
            scene.remove(draggedObject);
            shapes.splice(shapes.indexOf(draggedObject), 1);
            
            t.mesh.scale.set(1.2, 0.8, 1.2);
            break;
        }
    }

    if (!match) {
        draggedObject.userData.isReturning = true;
    }

    draggedObject = null;
}

window.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', onUp);
window.addEventListener('touchstart', e => { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
window.addEventListener('touchmove', e => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
window.addEventListener('touchend', onUp);

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    shapes.forEach(s => {
        if (s === draggedObject) return;
        if (s.userData.isReturning) {
            s.position.lerp(s.userData.originalPos, 0.1);
            if (s.position.distanceTo(s.userData.originalPos) < 0.1) s.userData.isReturning = false;
        } else {
            s.position.y += Math.sin(Date.now() * 0.002 + s.position.x * 10) * 0.002;
            s.rotation.z += 0.002;
        }
    });

    targets.forEach(t => t.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1));

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.vel);
        p.scale.multiplyScalar(0.92);
        p.userData.life -= 0.05;
        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

game.init();
animate();