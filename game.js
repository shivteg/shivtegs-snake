// =============================================================
// SHIVTEGS SNAKE - GAME ENGINE & MULTIPLAYER MANAGER
// =============================================================

// --- Configuration & Constants ---
const GRID_SIZE = 30; // 30x30 grid
const CELL_COUNT = GRID_SIZE;
const GAME_TICK_RATE = 110; // ms per frame

// --- WebRTC PeerJS Common Config ---
const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    key: 'peerjs',
    path: '/',
    pingInterval: 5000,
    debug: 1,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.services.mozilla.com' }
        ]
    }
};

// --- Audio Synthesizer (Web Audio API) ---
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'eat') {
        // High pitched retro sweep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'die') {
        // Harsh retro explosion
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'start') {
        // Intro beep-beep-boop
        const freqs = [329.63, 392.00, 523.25]; // E4, G4, C5
        freqs.forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(f, now + i * 0.1);
            g.gain.setValueAtTime(0.1, now + i * 0.1);
            g.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.08);
            o.start(now + i * 0.1);
            o.stop(now + i * 0.1 + 0.08);
        });
    } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }
}

// --- DOM Elements ---
const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const displayMode = document.getElementById('game-mode-display');
const scoreCardP2 = document.getElementById('score-p2');
const controlsP2Desc = document.getElementById('controls-p2-desc');
const valScoreP1 = document.getElementById('val-score-p1');
const valScoreP2 = document.getElementById('val-score-p2');

// Buttons
const btnSingle = document.getElementById('mode-single');
const btnLocal = document.getElementById('mode-local');
const btnMulti = document.getElementById('mode-multiplayer');
const btnBack = document.querySelector('.back-btn');
const btnHostCreate = document.getElementById('btn-host-create');
const btnCopyUrl = document.getElementById('btn-copy-url');
const btnJoinGame = document.getElementById('btn-join-game');
const btnPause = document.getElementById('btn-pause');
const btnQuit = document.getElementById('btn-quit');
const btnSound = document.getElementById('sound-btn');
const btnHelp = document.getElementById('help-btn');
const modalHelp = document.getElementById('help-modal');
const closeModal = document.querySelector('.close-modal');

// Quick Match Buttons & Status
const btnQuickMatch = document.getElementById('btn-quick-match');
const quickMatchStatusContainer = document.getElementById('quick-match-status-container');
const quickMatchStatusText = document.getElementById('quick-match-status-text');
const quickMatchStatusIndicator = document.querySelector('.quick-match-option .status-indicator');

// Overlay Elements
const canvasOverlay = document.getElementById('canvas-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const btnOverlayAction = document.getElementById('btn-overlay-action');

// Inputs & Shared Link
const shareUrlInput = document.getElementById('share-url');
const hostLinkContainer = document.getElementById('host-link-container');
const joinRoomInput = document.getElementById('join-room-id');
const hostStatusText = document.getElementById('host-status-text');
const hostStatusIndicator = document.querySelector('.host-option .status-indicator');
const joinStatusContainer = document.getElementById('join-status-container');
const joinStatusText = document.getElementById('join-status-text');
const joinStatusIndicator = document.querySelector('.join-option .status-indicator');

// Mobile Controls
const mobileControls = document.getElementById('mobile-controls');
const dpadButtons = document.querySelectorAll('.dpad-btn');

// --- Game Engine Variables ---
let gameInterval = null;
let gameMode = 'single'; // 'single', 'local', 'online'
let gameState = 'menu'; // 'menu', 'lobby', 'playing', 'paused', 'gameover'
let onlineRole = null; // 'host', 'client'
let peer = null;
let connection = null;

// Game State Data
let snake1 = {
    body: [],
    dir: 'right',
    nextDir: 'right',
    color: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.6)',
    alive: true
};

let snake2 = {
    body: [],
    dir: 'left',
    nextDir: 'left',
    color: '#ff007f',
    glow: 'rgba(255, 0, 127, 0.6)',
    alive: false // Enabled only in multiplayer
};

let apples = []; // Multi-apple array
const MAX_APPLES = 3;
let scores = [0, 0];
let particles = [];

// Screen sizing / responsive handling
function resizeCanvas() {
    // Keep internal canvas size 600x600 for math, css handles sizing
    canvas.width = 600;
    canvas.height = 600;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- Particle Effects System ---
class Particle {
    constructor(x, y, color) {
        this.x = x * (600 / GRID_SIZE) + (600 / GRID_SIZE) / 2;
        this.y = y * (600 / GRID_SIZE) + (600 / GRID_SIZE) / 2;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.alpha = 1.0;
        this.size = Math.random() * 4 + 2;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.03;
    }

    draw(c) {
        c.save();
        c.globalAlpha = this.alpha;
        c.shadowBlur = 8;
        c.shadowColor = this.color;
        c.fillStyle = this.color;
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }
}

function spawnEatenEffect(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function spawnExplosionEffect(x, y, color) {
    for (let i = 0; i < 25; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// --- Screen Switching Logic ---
function showScreen(screenKey) {
    Object.keys(screens).forEach(key => {
        if (key === screenKey) {
            screens[key].classList.add('active');
        } else {
            screens[key].classList.remove('active');
        }
    });
    gameState = screenKey === 'game' ? 'playing' : screenKey;
    
    // Hide mobile controls on menu/lobby
    if (screenKey !== 'game') {
        mobileControls.classList.add('hidden');
    } else {
        // Detect touch capability to show mobile controls
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            mobileControls.classList.remove('hidden');
        }
    }
}

// --- Initialize Game ---
function setupGame(mode) {
    gameMode = mode;
    scores = [0, 0];
    valScoreP1.textContent = '0';
    valScoreP2.textContent = '0';
    particles = [];

    // Reset Snake 1
    snake1.body = [
        { x: 5, y: 15 },
        { x: 4, y: 15 },
        { x: 3, y: 15 }
    ];
    snake1.dir = 'right';
    snake1.nextDir = 'right';
    snake1.alive = true;

    // Handle game layout display
    if (mode === 'single') {
        displayMode.textContent = 'SINGLE PLAYER';
        scoreCardP2.classList.add('hidden');
        controlsP2Desc.classList.add('hidden');
        snake2.alive = false;
    } else {
        displayMode.textContent = mode === 'local' ? 'LOCAL CO-OP' : 'ONLINE MULTIPLAYER';
        scoreCardP2.classList.remove('hidden');
        controlsP2Desc.classList.remove('hidden');
        
        // Reset Snake 2
        snake2.body = [
            { x: 24, y: 15 },
            { x: 25, y: 15 },
            { x: 26, y: 15 }
        ];
        snake2.dir = 'left';
        snake2.nextDir = 'left';
        snake2.alive = true;
    }

    // Spawn initial apples
    apples = [];
    for (let i = 0; i < MAX_APPLES; i++) {
        spawnApple();
    }

    canvasOverlay.classList.add('hidden');
    showScreen('game');
    playSound('start');

    // Only start game interval on Host (or single/local mode)
    if (gameMode !== 'online' || onlineRole === 'host') {
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, GAME_TICK_RATE);
    }
}

// --- Spawn Apple ---
function spawnApple() {
    let newApple;
    let valid = false;
    
    while (!valid) {
        newApple = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };

        valid = true;

        // Check crash with Snake 1
        for (let cell of snake1.body) {
            if (cell.x === newApple.x && cell.y === newApple.y) {
                valid = false;
                break;
            }
        }

        // Check crash with Snake 2
        if (snake2.alive) {
            for (let cell of snake2.body) {
                if (cell.x === newApple.x && cell.y === newApple.y) {
                    valid = false;
                    break;
                }
            }
        }

        // Check crash with other apples
        for (let app of apples) {
            if (app.x === newApple.x && app.y === newApple.y) {
                valid = false;
                break;
            }
        }
    }

    apples.push(newApple);
}

// --- Main Server / Local Game Loop ---
function gameLoop() {
    if (gameState !== 'playing') return;

    // 1. Move Snakes
    moveSnake(snake1);
    if (snake2.alive) {
        moveSnake(snake2);
    }

    // 2. Check Collision with Apples
    checkAppleCollision(snake1, 0);
    if (snake2.alive) {
        checkAppleCollision(snake2, 1);
    }

    // 3. Check Self & Wall collisions
    checkCollisions();

    // 4. Update Particles
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.alpha > 0);

    // 5. Draw Canvas
    draw();

    // 6. Online Host Sync
    if (gameMode === 'online' && onlineRole === 'host' && connection) {
        sendGameStateToClient();
    }
}

// --- Snake Move Math ---
function moveSnake(snake) {
    snake.dir = snake.nextDir;
    let head = { ...snake.body[0] };

    switch (snake.dir) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }

    // Add new head
    snake.body.unshift(head);
    // Remove tail (will remain if snake ate an apple)
    snake.body.pop();
}

// --- Apple Collision Math ---
function checkAppleCollision(snake, playerIdx) {
    const head = snake.body[0];
    
    for (let i = 0; i < apples.length; i++) {
        if (head.x === apples[i].x && head.y === apples[i].y) {
            // Snake grows: duplicate tail cell to keep size
            snake.body.push({ ...snake.body[snake.body.length - 1] });
            
            // Increment score
            scores[playerIdx] += 10;
            if (playerIdx === 0) {
                valScoreP1.textContent = scores[0];
            } else {
                valScoreP2.textContent = scores[1];
            }

            // FX
            spawnEatenEffect(apples[i].x, apples[i].y, snake.color);
            playSound('eat');

            // Remove apple and spawn new
            apples.splice(i, 1);
            spawnApple();
            break;
        }
    }
}

// --- Snake Collisions Math (Self / Wall / Competitor) ---
function checkCollisions() {
    let p1Crashed = false;
    let p2Crashed = false;

    // Check Wall Collisions for Snake 1
    const head1 = snake1.body[0];
    if (head1.x < 0 || head1.x >= GRID_SIZE || head1.y < 0 || head1.y >= GRID_SIZE) {
        p1Crashed = true;
    }

    // Check Self Collisions for Snake 1
    for (let i = 1; i < snake1.body.length; i++) {
        if (head1.x === snake1.body[i].x && head1.y === snake1.body[i].y) {
            p1Crashed = true;
            break;
        }
    }

    if (snake2.alive) {
        const head2 = snake2.body[0];
        
        // Check Wall Collisions for Snake 2
        if (head2.x < 0 || head2.x >= GRID_SIZE || head2.y < 0 || head2.y >= GRID_SIZE) {
            p2Crashed = true;
        }

        // Check Self Collisions for Snake 2
        for (let i = 1; i < snake2.body.length; i++) {
            if (head2.x === snake2.body[i].x && head2.y === snake2.body[i].y) {
                p2Crashed = true;
                break;
            }
        }

        // Check Head-to-Head Collision
        if (head1.x === head2.x && head1.y === head2.y) {
            p1Crashed = true;
            p2Crashed = true;
        }

        // Check Snake 1 crashing into Snake 2 body
        for (let cell of snake2.body) {
            if (head1.x === cell.x && head1.y === cell.y) {
                p1Crashed = true;
            }
        }

        // Check Snake 2 crashing into Snake 1 body
        for (let cell of snake1.body) {
            if (head2.x === cell.x && head2.y === cell.y) {
                p2Crashed = true;
            }
        }
    }

    // Handle Crashing Results
    if (p1Crashed || p2Crashed) {
        gameState = 'gameover';
        if (gameInterval) clearInterval(gameInterval);
        
        playSound('die');

        // FX explosion
        if (p1Crashed) spawnExplosionEffect(snake1.body[0].x, snake1.body[0].y, snake1.color);
        if (p2Crashed && snake2.alive) spawnExplosionEffect(snake2.body[0].x, snake2.body[0].y, snake2.color);

        let title = "GAME OVER";
        let subtitle = "";

        if (gameMode === 'single') {
            title = "GAME OVER";
            subtitle = `You scored ${scores[0]} points!`;
        } else {
            if (p1Crashed && p2Crashed) {
                title = "MUTUAL CRASH!";
                subtitle = scores[0] === scores[1] ? `It's a tie! Both got ${scores[0]} pts.` : (scores[0] > scores[1] ? `Player 1 wins on points (${scores[0]} vs ${scores[1]})!` : `Player 2 wins on points (${scores[1]} vs ${scores[0]})!`);
            } else if (p1Crashed) {
                title = gameMode === 'online' ? (onlineRole === 'host' ? "YOU CRASHED!" : "VICTORY!") : "PLAYER 2 WINS!";
                subtitle = gameMode === 'online' ? (onlineRole === 'host' ? "Your friend wins." : "Host crashed.") : "Player 1 crashed.";
            } else if (p2Crashed) {
                title = gameMode === 'online' ? (onlineRole === 'host' ? "VICTORY!" : "YOU CRASHED!") : "PLAYER 1 WINS!";
                subtitle = gameMode === 'online' ? (onlineRole === 'host' ? "Client crashed." : "Your friend wins.") : "Player 2 crashed.";
            }
        }

        overlayTitle.textContent = title;
        overlaySubtitle.textContent = subtitle;
        btnOverlayAction.textContent = "Play Again";
        canvasOverlay.classList.remove('hidden');

        // Update Client if Online Host
        if (gameMode === 'online' && onlineRole === 'host' && connection) {
            sendGameStateToClient();
        }
    }
}

// --- Render / Draw Canvas ---
function draw() {
    // Clear canvas with dark futuristic grid backdrop
    ctx.fillStyle = '#060408';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / GRID_SIZE;
    const cellH = canvas.height / GRID_SIZE;

    // Draw grid dots for space aesthetics
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE; r++) {
            ctx.fillRect(c * cellW + cellW/2 - 1, r * cellH + cellH/2 - 1, 2, 2);
        }
    }

    // Draw Particles
    particles.forEach(p => p.draw(ctx));

    // Draw Apples
    apples.forEach(apple => {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff3838';
        ctx.fillStyle = '#ff3838';
        
        // Animated pulse radius
        const t = Date.now() * 0.006;
        const pulse = Math.sin(t) * 1.5;
        const radius = (cellW / 2 - 2) + pulse;

        ctx.beginPath();
        ctx.arc(apple.x * cellW + cellW/2, apple.y * cellH + cellH/2, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Draw Snake 1
    if (snake1.body.length > 0) {
        drawSnake(snake1, cellW, cellH);
    }

    // Draw Snake 2
    if (snake2.alive && snake2.body.length > 0) {
        drawSnake(snake2, cellW, cellH);
    }
}

function drawSnake(snake, w, h) {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = snake.color;
    ctx.fillStyle = snake.color;

    // Draw body segments
    snake.body.forEach((cell, idx) => {
        // Head looks slightly different
        if (idx === 0) {
            ctx.fillStyle = '#ffffff'; // Glowing white head
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(cell.x * w + 1, cell.y * h + 1, w - 2, h - 2, 5);
            } else {
                ctx.rect(cell.x * w + 1, cell.y * h + 1, w - 2, h - 2);
            }
            ctx.fill();

            // Draw tiny eyes indicating direction
            ctx.fillStyle = '#000000';
            const eyeSize = 3;
            if (snake.dir === 'up' || snake.dir === 'down') {
                ctx.fillRect(cell.x * w + 4, cell.y * h + h/2 - eyeSize/2, eyeSize, eyeSize);
                ctx.fillRect(cell.x * w + w - 7, cell.y * h + h/2 - eyeSize/2, eyeSize, eyeSize);
            } else {
                ctx.fillRect(cell.x * w + w/2 - eyeSize/2, cell.y * h + 4, eyeSize, eyeSize);
                ctx.fillRect(cell.x * w + w/2 - eyeSize/2, cell.y * h + h - 7, eyeSize, eyeSize);
            }
        } else {
            // Gradient/faded tail representation
            ctx.fillStyle = snake.color;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(cell.x * w + 1, cell.y * h + 1, w - 2, h - 2, 4);
            } else {
                ctx.rect(cell.x * w + 1, cell.y * h + 1, w - 2, h - 2);
            }
            ctx.fill();
        }
    });

    ctx.restore();
}

// --- Keyboard Input Handling ---
window.addEventListener('keydown', e => {
    let key = e.key.toLowerCase();
    
    // Prevent Arrow keys scrolling window
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].indexOf(e.key) > -1) {
        e.preventDefault();
    }

    // Pause toggle
    if (e.key === 'Escape' || key === 'p') {
        togglePause();
        return;
    }

    // Inputs map based on Game Mode / Online status
    if (gameState === 'playing') {
        if (gameMode === 'online') {
            if (onlineRole === 'host') {
                // Host controls Snake 1 (WASD or Arrows)
                handleSnakeInput(snake1, key);
            } else if (onlineRole === 'client' && connection) {
                // Client controls Snake 2, send keys to Host
                let newDir = getDirectionFromKey(key);
                if (newDir) {
                    connection.send({ type: 'input', dir: newDir });
                }
            }
        } else if (gameMode === 'local') {
            // Local mode: Player 1 = WASD, Player 2 = Arrows
            handleSnakeInput(snake1, key); // WASD / Arrows handles Player 1
            handleSnake2LocalInput(key);
        } else {
            // Single player: Both WASD and Arrows control Snake 1
            handleSnake1SingleInput(key);
        }
    }
});

function handleSnakeInput(snake, key) {
    if ((key === 'w' || key === 'arrowup') && snake.dir !== 'down') snake.nextDir = 'up';
    if ((key === 's' || key === 'arrowdown') && snake.dir !== 'up') snake.nextDir = 'down';
    if ((key === 'a' || key === 'arrowleft') && snake.dir !== 'right') snake.nextDir = 'left';
    if ((key === 'd' || key === 'arrowright') && snake.dir !== 'left') snake.nextDir = 'right';
}

function handleSnake1SingleInput(key) {
    if ((key === 'w' || key === 'arrowup') && snake1.dir !== 'down') snake1.nextDir = 'up';
    if ((key === 's' || key === 'arrowdown') && snake1.dir !== 'up') snake1.nextDir = 'down';
    if ((key === 'a' || key === 'arrowleft') && snake1.dir !== 'right') snake1.nextDir = 'left';
    if ((key === 'd' || key === 'arrowright') && snake1.dir !== 'left') snake1.nextDir = 'right';
}

function handleSnake2LocalInput(key) {
    // Player 1 controls (WASD ONLY)
    if (key === 'w' && snake1.dir !== 'down') snake1.nextDir = 'up';
    if (key === 's' && snake1.dir !== 'up') snake1.nextDir = 'down';
    if (key === 'a' && snake1.dir !== 'right') snake1.nextDir = 'left';
    if (key === 'd' && snake1.dir !== 'left') snake1.nextDir = 'right';

    // Player 2 controls (ARROWS ONLY)
    if (key === 'arrowup' && snake2.dir !== 'down') snake2.nextDir = 'up';
    if (key === 'arrowdown' && snake2.dir !== 'up') snake2.nextDir = 'down';
    if (key === 'arrowleft' && snake2.dir !== 'right') snake2.nextDir = 'left';
    if (key === 'arrowright' && snake2.dir !== 'left') snake2.nextDir = 'right';
}

function getDirectionFromKey(key) {
    if (key === 'w' || key === 'arrowup') return 'up';
    if (key === 's' || key === 'arrowdown') return 'down';
    if (key === 'a' || key === 'arrowleft') return 'left';
    if (key === 'd' || key === 'arrowright') return 'right';
    return null;
}

// Mobile controls callback
dpadButtons.forEach(btn => {
    btn.addEventListener('touchstart', e => {
        e.preventDefault();
        const dir = btn.getAttribute('data-dir');
        handleDirectionInput(dir);
    });
    btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-dir');
        handleDirectionInput(dir);
    });
});

function handleDirectionInput(dir) {
    if (gameState !== 'playing') return;
    playSound('click');

    if (gameMode === 'online') {
        if (onlineRole === 'host') {
            if (dir === 'up' && snake1.dir !== 'down') snake1.nextDir = 'up';
            if (dir === 'down' && snake1.dir !== 'up') snake1.nextDir = 'down';
            if (dir === 'left' && snake1.dir !== 'right') snake1.nextDir = 'left';
            if (dir === 'right' && snake1.dir !== 'left') snake1.nextDir = 'right';
        } else if (onlineRole === 'client' && connection) {
            connection.send({ type: 'input', dir: dir });
        }
    } else {
        // Single/local, touch controls Snake 1
        if (dir === 'up' && snake1.dir !== 'down') snake1.nextDir = 'up';
        if (dir === 'down' && snake1.dir !== 'up') snake1.nextDir = 'down';
        if (dir === 'left' && snake1.dir !== 'right') snake1.nextDir = 'left';
        if (dir === 'right' && snake1.dir !== 'left') snake1.nextDir = 'right';
    }
}

// --- Pause Logic ---
function togglePause() {
    if (gameState !== 'playing' && gameState !== 'paused') return;
    playSound('click');

    if (gameState === 'playing') {
        gameState = 'paused';
        if (gameMode !== 'online' || onlineRole === 'host') {
            if (gameInterval) clearInterval(gameInterval);
        }
        
        overlayTitle.textContent = "PAUSED";
        overlaySubtitle.textContent = "Press ESC or click Resume to continue";
        btnOverlayAction.textContent = "Resume";
        canvasOverlay.classList.remove('hidden');
    } else {
        gameState = 'playing';
        canvasOverlay.classList.add('hidden');
        if (gameMode !== 'online' || onlineRole === 'host') {
            gameInterval = setInterval(gameLoop, GAME_TICK_RATE);
        }
    }

    // Sync Pause State Online
    if (gameMode === 'online' && connection) {
        connection.send({ type: 'pause', state: gameState });
    }
}

// --- Menu Button Event Listeners ---
btnSingle.addEventListener('click', () => { playSound('click'); setupGame('single'); });
btnLocal.addEventListener('click', () => { playSound('click'); setupGame('local'); });
btnMulti.addEventListener('click', () => { playSound('click'); showScreen('lobby'); });

btnBack.addEventListener('click', () => {
    playSound('click');
    showScreen('menu');
    disconnectMultiplayer();
});

btnPause.addEventListener('click', togglePause);
btnQuit.addEventListener('click', () => {
    playSound('click');
    if (gameInterval) clearInterval(gameInterval);
    disconnectMultiplayer();
    showScreen('menu');
});

btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const icon = btnSound.querySelector('i');
    if (soundEnabled) {
        icon.className = 'fa-solid fa-volume-high';
        playSound('click');
    } else {
        icon.className = 'fa-solid fa-volume-xmark';
    }
});

btnHelp.addEventListener('click', () => {
    playSound('click');
    modalHelp.style.display = 'flex';
});

closeModal.addEventListener('click', () => {
    playSound('click');
    modalHelp.style.display = 'none';
});

window.addEventListener('click', e => {
    if (e.target === modalHelp) {
        modalHelp.style.display = 'none';
    }
});

btnOverlayAction.addEventListener('click', () => {
    playSound('click');
    if (gameState === 'paused') {
        togglePause();
    } else if (gameState === 'gameover') {
        if (gameMode === 'online') {
            if (onlineRole === 'host') {
                setupGame('online');
            } else if (onlineRole === 'client' && connection) {
                // Client requests host to restart
                connection.send({ type: 'restart' });
                overlaySubtitle.textContent = "Waiting for host to restart...";
            }
        } else {
            setupGame(gameMode);
        }
    }
});

// --- WebRTC Multiplayer - PeerJS Implementation ---

// Generate connection link
function getShareLink(peerId) {
    // If running via file:// local context, return the live production URL
    // so that copy-pasting it to other devices/phones will connect successfully!
    if (window.location.protocol === 'file:') {
        return `https://shivteg.github.io/shivtegs-snake/?room=${peerId}`;
    }
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?room=${peerId}`;
}

// HOST MODE: Create Room
btnHostCreate.addEventListener('click', () => {
    playSound('click');
    hostStatusText.textContent = "Connecting to signaling server...";
    hostStatusIndicator.className = "status-indicator waiting";
    btnHostCreate.classList.add('hidden');
    hostLinkContainer.classList.remove('hidden');

    initPeer('host', null);
});

// COPY URL
btnCopyUrl.addEventListener('click', () => {
    playSound('click');
    shareUrlInput.select();
    shareUrlInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(shareUrlInput.value).then(() => {
        btnCopyUrl.classList.add('copied');
        btnCopyUrl.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            btnCopyUrl.classList.remove('copied');
            btnCopyUrl.innerHTML = '<i class="fa-solid fa-copy"></i>';
        }, 2000);
    });
});

// CLIENT MODE: Join Room
btnJoinGame.addEventListener('click', () => {
    playSound('click');
    const inputVal = joinRoomInput.value.trim();
    if (!inputVal) {
        alert("Please enter a valid Room ID or share link!");
        return;
    }

    // Robust URL parsing to extract the 'room' parameter
    let roomId = inputVal;
    try {
        if (inputVal.startsWith('http://') || inputVal.startsWith('https://') || inputVal.startsWith('file://')) {
            const url = new URL(inputVal);
            roomId = url.searchParams.get('room') || roomId;
        } else if (inputVal.includes('?room=')) {
            const params = new URLSearchParams(inputVal.substring(inputVal.indexOf('?')));
            roomId = params.get('room') || roomId;
        }
    } catch (e) {
        console.error("Failed to parse URL, using raw input value", e);
    }

    joinStatusContainer.classList.remove('hidden');
    joinStatusText.textContent = "Connecting to peer...";
    joinStatusIndicator.className = "status-indicator waiting";

    initPeer('client', roomId);
});

// Initialize PeerJS
function initPeer(role, targetRoomId) {
    disconnectMultiplayer();
    onlineRole = role;

    // Use default public PeerJS server configured with PEER_CONFIG
    peer = new Peer(null, PEER_CONFIG);

    peer.on('open', (id) => {
        if (role === 'host') {
            const link = getShareLink(id);
            shareUrlInput.value = link;
            
            // Helpful user notice if they run via file:// local context
            if (window.location.protocol === 'file:') {
                hostStatusText.innerHTML = `Running locally. Copy link to test in another tab, or use <a href="https://shivteg.github.io/shivtegs-snake/?room=${id}" target="_blank" style="color: var(--neon-blue); font-weight: bold; text-decoration: underline;">GitHub Pages URL</a> to play across different devices!`;
            } else {
                hostStatusText.textContent = "Waiting for friend to join...";
            }
            hostStatusIndicator.className = "status-indicator waiting";
        } else {
            // Client: connect to host
            connectToHost(targetRoomId);
        }
    });

    peer.on('connection', (conn) => {
        if (role === 'host') {
            connection = conn;
            setupHostConnection();
        }
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        if (role === 'host') {
            hostStatusText.textContent = "Failed to start room. Retry?";
            hostStatusIndicator.className = "status-indicator";
            btnHostCreate.classList.remove('hidden');
            hostLinkContainer.classList.add('hidden');
        } else {
            joinStatusText.textContent = "Failed to connect. Verify link.";
            joinStatusIndicator.className = "status-indicator";
        }
        alert("Connection error: " + err.type);
    });
}

function connectToHost(hostId) {
    // Determine which status elements to update (Quick Match or manual invite join)
    const isQuickMatch = !quickMatchStatusContainer.classList.contains('hidden');
    const statusText = isQuickMatch ? quickMatchStatusText : joinStatusText;
    const statusIndicator = isQuickMatch ? quickMatchStatusIndicator : joinStatusIndicator;

    statusText.textContent = "Connecting to peer...";
    statusIndicator.className = "status-indicator waiting";

    connection = peer.connect(hostId, {
        reliable: true
    });

    connection.on('open', () => {
        statusText.textContent = "Connection established! Syncing...";
        statusIndicator.className = "status-indicator connected";
        
        // Host will trigger the layout switch and initialize setup
        // Client waits for the first state update to render
        setTimeout(() => {
            showScreen('game');
            displayMode.textContent = 'ONLINE MULTIPLAYER (GUEST)';
            scoreCardP2.classList.remove('hidden');
            controlsP2Desc.classList.remove('hidden');
        }, 1000);
    });

    connection.on('data', (data) => {
        handleIncomingData(data);
    });

    connection.on('close', () => {
        alert("Lost connection to Host.");
        disconnectMultiplayer();
        showScreen('menu');
    });

    connection.on('error', (err) => {
        console.error("Connection Error:", err);
        disconnectMultiplayer();
        showScreen('menu');
    });
}

function setupHostConnection() {
    hostStatusText.textContent = "Connected! Launching game...";
    hostStatusIndicator.className = "status-indicator connected";

    connection.on('data', (data) => {
        handleIncomingData(data);
    });

    connection.on('close', () => {
        alert("Player 2 disconnected.");
        disconnectMultiplayer();
        showScreen('menu');
    });

    // Start the game for Host
    setTimeout(() => {
        setupGame('online');
    }, 1000);
}

// Handle real-time WebRTC communications
function handleIncomingData(data) {
    if (!data) return;

    if (onlineRole === 'host') {
        // Host receives inputs / instructions from Client
        if (data.type === 'input') {
            // Update Snake 2 direction
            if (data.dir === 'up' && snake2.dir !== 'down') snake2.nextDir = 'up';
            if (data.dir === 'down' && snake2.dir !== 'up') snake2.nextDir = 'down';
            if (data.dir === 'left' && snake2.dir !== 'right') snake2.nextDir = 'left';
            if (data.dir === 'right' && snake2.dir !== 'left') snake2.nextDir = 'right';
        } else if (data.type === 'restart') {
            if (gameState === 'gameover') {
                setupGame('online');
            }
        }
    } else if (onlineRole === 'client') {
        // Client receives state ticks from Host
        if (data.type === 'state') {
            snake1.body = data.snake1.body;
            snake1.dir = data.snake1.dir;
            snake2.body = data.snake2.body;
            snake2.dir = data.snake2.dir;
            snake2.alive = data.snake2.alive;

            apples = data.apples;
            scores = data.scores;
            gameState = data.gameState;

            // Sync scores text
            valScoreP1.textContent = scores[0];
            valScoreP2.textContent = scores[1];

            // Sound FX triggers synced from server
            if (data.sound) {
                playSound(data.sound);
            }

            // Sync overlay menus
            if (gameState === 'paused') {
                overlayTitle.textContent = "PAUSED";
                overlaySubtitle.textContent = "Waiting for host to resume...";
                btnOverlayAction.classList.add('hidden'); // Hide resume button on client
                canvasOverlay.classList.remove('hidden');
            } else if (gameState === 'gameover') {
                overlayTitle.textContent = data.overlayTitle;
                overlaySubtitle.textContent = data.overlaySubtitle;
                btnOverlayAction.textContent = "Request Restart";
                btnOverlayAction.classList.remove('hidden');
                canvasOverlay.classList.remove('hidden');
            } else {
                canvasOverlay.classList.add('hidden');
            }

            // Trigger canvas draw for client
            draw();
        }
    }
}

// Host compiles and forwards game status details
let lastScores = [0, 0];
let lastGameState = 'playing';

function sendGameStateToClient() {
    if (onlineRole !== 'host' || !connection) return;

    let soundToPlay = null;
    // Simple state change triggers sound playback on client
    if (gameState === 'gameover' && lastGameState === 'playing') {
        soundToPlay = 'die';
    } else if (scores[0] > lastScores[0] || scores[1] > lastScores[1]) {
        soundToPlay = 'eat';
    }

    lastScores = [...scores];
    lastGameState = gameState;

    const payload = {
        type: 'state',
        snake1: { body: snake1.body, dir: snake1.dir },
        snake2: { body: snake2.body, dir: snake2.dir, alive: snake2.alive },
        apples: apples,
        scores: scores,
        gameState: gameState,
        sound: soundToPlay,
        overlayTitle: overlayTitle.textContent,
        overlaySubtitle: overlaySubtitle.textContent
    };

    connection.send(payload);
}

// Reset networks on exiting
function disconnectMultiplayer() {
    if (gameInterval) clearInterval(gameInterval);
    
    if (connection) {
        connection.close();
        connection = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }

    onlineRole = null;
    hostLinkContainer.classList.add('hidden');
    btnHostCreate.classList.remove('hidden');
    joinStatusContainer.classList.add('hidden');
    joinRoomInput.value = "";
    
    resetQuickMatchUI();
}

// --- Matchmaking / Quick Match Engine ---
let searchIndex = 0;
const MAX_SEARCH_SLOTS = 5;

btnQuickMatch.addEventListener('click', () => {
    playSound('click');
    startQuickMatchSearch();
});

function resetQuickMatchUI() {
    quickMatchStatusContainer.classList.add('hidden');
    btnQuickMatch.classList.remove('hidden');
    quickMatchStatusText.textContent = "Searching for active lobbies...";
}

function startQuickMatchSearch() {
    searchIndex = 0;
    quickMatchStatusContainer.classList.remove('hidden');
    quickMatchStatusText.textContent = "Connecting to matchmaking...";
    quickMatchStatusIndicator.className = "status-indicator waiting";
    btnQuickMatch.classList.add('hidden');
    
    checkNextSlot();
}

function checkNextSlot() {
    if (searchIndex >= MAX_SEARCH_SLOTS) {
        // Checked all slots, none had a waiting host.
        // Let's host our own on the first slot that we can!
        hostPublicMatch();
        return;
    }
    
    const slotId = `shivtegs-snake-lobby-slot-${searchIndex}`;
    quickMatchStatusText.textContent = `Scanning public lobby slot ${searchIndex + 1}...`;
    
    // We create a temporary peer to probe the slot
    let probePeer = new Peer(null, {
        ...PEER_CONFIG,
        debug: 0
    });
    
    let isResolved = false;
    
    probePeer.on('open', () => {
        // Try to connect to the slot host
        let conn = probePeer.connect(slotId, { reliable: true });
        
        let timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                probePeer.destroy();
                searchIndex++;
                checkNextSlot();
            }
        }, 1200); // 1.2 seconds timeout
        
        conn.on('open', () => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                // SUCCESS! Host is waiting! Let's disconnect probe and do the real join!
                probePeer.destroy();
                quickMatchStatusText.textContent = `Slot ${searchIndex + 1} active! Joining...`;
                setTimeout(() => {
                    joinPublicMatch(slotId);
                }, 200);
            }
        });
        
        conn.on('error', (err) => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                probePeer.destroy();
                searchIndex++;
                checkNextSlot();
            }
        });
    });
    
    probePeer.on('error', () => {
        if (!isResolved) {
            isResolved = true;
            probePeer.destroy();
            searchIndex++;
            checkNextSlot();
        }
    });
}

function joinPublicMatch(slotId) {
    disconnectMultiplayer();
    onlineRole = 'client';
    
    peer = new Peer(null, PEER_CONFIG);
    
    peer.on('open', () => {
        connectToHost(slotId);
    });
    
    peer.on('error', (err) => {
        console.error("Matchmaking Join Error:", err);
        resetQuickMatchUI();
        alert("Failed to join matched game.");
    });
}

function hostPublicMatch() {
    disconnectMultiplayer();
    onlineRole = 'host';
    
    let hostSlotIndex = 0;
    
    function tryHostSlot() {
        if (hostSlotIndex >= MAX_SEARCH_SLOTS) {
            resetQuickMatchUI();
            alert("All matchmaking slots are full. Please try again later!");
            return;
        }
        
        const slotId = `shivtegs-snake-lobby-slot-${hostSlotIndex}`;
        quickMatchStatusText.textContent = `Creating public match on Slot ${hostSlotIndex + 1}...`;
        
        peer = new Peer(slotId, PEER_CONFIG);
        
        peer.on('open', () => {
            quickMatchStatusText.textContent = `Lobby active on Slot ${hostSlotIndex + 1}! Waiting for players...`;
            quickMatchStatusIndicator.className = "status-indicator waiting";
            
            peer.on('connection', (conn) => {
                connection = conn;
                setupHostConnection();
            });
        });
        
        peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                // Slot is taken, try next slot
                hostSlotIndex++;
                tryHostSlot();
            } else {
                console.error("Matchmaking Host Error:", err);
                resetQuickMatchUI();
                alert("Failed to create matchmaking room: " + err.type);
            }
        });
    }
    
    tryHostSlot();
}

// --- Check URL parameters for Direct Room Invites ---
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        showScreen('lobby');
        joinRoomInput.value = roomParam;
        
        joinStatusContainer.classList.remove('hidden');
        joinStatusText.textContent = "Joining invite room...";
        joinStatusIndicator.className = "status-indicator waiting";
        
        // Auto-join after short pause
        setTimeout(() => {
            initPeer('client', roomParam);
        }, 800);
    }
});
