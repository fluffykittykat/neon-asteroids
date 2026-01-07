import { InputHandler } from './InputHandler.js';
import { Ship } from './entities/Ship.js';
import { Asteroid } from './entities/Asteroid.js';
import { Particle } from './entities/Particle.js';
import { Cow } from './entities/Cow.js';
import { Vector2 } from './Vector2.js';
import { AudioController } from './AudioController.js';
import { TouchControls } from './TouchControls.js';
import { AuthService } from './AuthService.js';
import { TelemetryService } from './TelemetryService.js';
import { Dashboard } from './Dashboard.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');


        // RESOLUTION CAP: Increased to 2560px (QHD) for sharpness while maintaining performance
        const maxW = 2560;
        const scale = Math.min(1, maxW / window.innerWidth);

        this.width = this.canvas.width = window.innerWidth * scale;
        this.height = this.canvas.height = window.innerHeight * scale;

        this.input = new InputHandler();
        this.touchControls = new TouchControls(this.input, this.width, this.height);
        this.dashboard = new Dashboard();
        this.audio = new AudioController();
        this.ship = null;
        this.cow = null;
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];
        this.camera = new Vector2(0, 0);
        this.shake = 0;

        this.screenShake = 0; // Deprecated, using this.shake

        // Background Effects
        // Background Effects
        this.gridOffset = new Vector2(0, 0);
        this.stars = [];
        this.planets = [];
        this.nebulae = [];
        this.ripples = []; // Space-time ripples

        // Generate Starfield
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1
            });
        }

        // Generate Distant Planets
        this.generatePlanets();

        this.score = 0;
        this.lives = 3;
        this.highScore = parseInt(localStorage.getItem('neon-asteroids-hs')) || 0;
        this.level = 1;
        this.state = 'START'; // START, PLAYING, GAMEOVER

        // Extended Telemetry Stats
        this.stats = {
            thrusts: 0,
            turns: 0, // Total degrees turned (absolute)
            panicSpins: 0,
            closeCalls: 0,
            timeCamping: 0,
            shotsFired: 0,
            hits: 0,
            startTime: Date.now()
        };

        // Telemetry Helpers
        this.lastRotation = 0;
        this.accumulatedRotation = 0;
        this.lastPosition = new Vector2(this.width / 2, this.height / 2);
        this.campingTimer = 0;

        // UI Elements
        this.uiScore = document.getElementById('score');
        this.uiHighScore = document.getElementById('high-score');
        this.uiLives = document.getElementById('lives');
        this.uiFinalScore = document.getElementById('final-score');
        this.uiStartScreen = document.getElementById('start-screen');
        this.uiGameOverScreen = document.getElementById('game-over-screen');

        // Auth UI
        this.btnLogin = document.getElementById('login-btn');
        this.userProfile = document.getElementById('user-profile');
        this.userAvatar = document.getElementById('user-avatar');
        this.userName = document.getElementById('user-name');
        this.userName = document.getElementById('user-name');
        // this.btnTestDB = document.getElementById('test-db-btn'); // Removed per user request
        this.btnLogs = document.getElementById('view-logs-btn');
        this.btnLogout = document.getElementById('logout-btn');
        this.startPrompt = document.getElementById('start-prompt');
        this.user = null;

        this.setupAuth();
        this.updateUI();

        // Detect Mobile
        this.isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        const resize = () => {
            const maxW = 2560;
            const minW = this.isMobile ? 1200 : 0; // Force "Zoom Out" on mobile by increasing resolution

            let targetW = window.innerWidth;
            if (targetW < minW) targetW = minW;
            if (targetW > maxW) targetW = maxW;

            this.width = this.canvas.width = targetW;
            this.height = this.canvas.height = targetW * (window.innerHeight / window.innerWidth);

            if (this.touchControls) this.touchControls.resize(this.width, this.height);
        };

        window.addEventListener('resize', resize);
        resize(); // Init size immediately

        // Global Audio Unlocker
        const unlockAudio = () => {
            if (this.audio) this.audio.resume();
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        this.loop = this.loop.bind(this);
    }

    setupAuth() {
        // Listen for Login
        if (this.btnLogin) {
            this.btnLogin.addEventListener('click', async (e) => {
                e.stopPropagation(); // Don't start game
                console.log("LOGIN CLICKED"); // DEBUG
                try {
                    await AuthService.login();
                } catch (err) {
                    console.error(err);
                    alert("Login Error: " + err.message);
                }
            });
        } else {
            console.warn("Login button not found in DOM");
        }

        // Listen for Logout
        if (this.btnLogout) {
            this.btnLogout.addEventListener('click', async (e) => {
                e.stopPropagation();
                await AuthService.logout();
            });
        }

        // Listen for DB Test
        if (this.btnTestDB) {
            this.btnTestDB.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.user) TelemetryService.testConnection(this.user.uid);
            });
        }

        // Listen for Logs
        if (this.btnLogs) {
            this.btnLogs.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.user) this.dashboard.show(this.user.uid);
            });
        }

        // In-Game Logs Button
        this.btnIngameLogs = document.getElementById('ingame-logs-btn');
        if (this.btnIngameLogs) {
            this.btnIngameLogs.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.user) {
                    this.dashboard.show(this.user.uid);
                    // PAUSE LOGIC is handled in update loop automatically
                } else {
                    alert("Please Login First!");
                }
            });
            // Prevent Space key from triggering game actions when button focused?
            this.btnIngameLogs.addEventListener('keydown', e => e.stopPropagation());
        }

        // Listen for State Changes
        AuthService.onUserChange((user) => {
            this.user = user;
            if (user) {
                // Logged In
                this.btnLogin.style.display = 'none';
                this.userProfile.classList.remove('hidden');
                this.userProfile.style.display = 'flex';
                if (this.userName) this.userName.innerText = user.displayName || "Pilot";
                if (this.userAvatar) this.userAvatar.src = user.photoURL || `https://api.dicebear.com/9.x/initials/svg?seed=${user.uid}`;

                // Show Start Prompt
                this.startPrompt.classList.remove('hidden');
                this.startPrompt.style.display = 'block';
            } else {
                // Logged Out
                this.btnLogin.style.display = 'inline-block';
                this.userProfile.classList.add('hidden');
                this.userProfile.style.display = 'none';

                // Hide Start Prompt
                this.startPrompt.classList.add('hidden');
                this.startPrompt.style.display = 'none';
            }
        });
    }

    start() {
        this.initLevel();

        // Require a click to ensure audio context (if added later) and focus
        // Require a click to ensure audio context (if added later) and focus
        const startAction = (e) => {
            if (!this.user) return; // REQUIRE LOGIN

            // Prevent game start if Dashboard is open
            if (this.dashboard && this.dashboard.isVisible()) {
                console.log("Input Blocked: Dashboard is open");
                return;
            }

            if (e.target.id === 'view-logs-gameover-btn' || e.target.id === 'ingame-logs-btn') {
                e.stopPropagation();
                // Open Logs
                if (this.user) this.dashboard.show(this.user.uid);
                return;
            }

            if (e.type === 'touchstart') {
                // Prevent duplicate click if not prevented elsewhere
            }
            this.audio.resume(); // Unlock audio context
            this.audio.startMusic(); // START THE BEATS

            if (this.state === 'START') {
                this.startGame();
            } else if (this.state === 'GAMEOVER') {
                // COOLDOWN CHECK
                if (Date.now() - (this.gameOverTime || 0) > 2000) {
                    this.startGame();
                }
            }
        };

        window.addEventListener('click', startAction);
        window.addEventListener('touchstart', startAction, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (!this.user) return; // REQUIRE LOGIN

            // Prevent game start if Dashboard is open
            if (this.dashboard && this.dashboard.isVisible()) {
                return;
            }

            if (e.code === 'Space' || e.code === 'Enter') {
                // Prevent starting game if Dashboard is visible
                if (this.dashboard && this.dashboard.isVisible()) return;

                if (this.state === 'START') {
                    this.startGame();
                } else if (this.state === 'GAMEOVER') {
                    // COOLDOWN CHECK
                    if (Date.now() - (this.gameOverTime || 0) > 2000) {
                        this.startGame();
                    }
                }
            }
        });

        requestAnimationFrame(this.loop);
    }

    startGame() {
        this.state = 'PLAYING';
        this.uiStartScreen.classList.add('hidden');
        this.uiStartScreen.classList.remove('visible');
        this.uiGameOverScreen.classList.add('hidden');
        this.uiGameOverScreen.classList.remove('visible');
        this.uiGameOverScreen.classList.remove('visible');
        this.resetGame(); // Changed from this.reset()
        if (this.touchControls) this.touchControls.setActive(true);
        TelemetryService.startSession();
    }

    resetStats() {
        this.stats = {
            thrusts: 0,
            turns: 0,
            panicSpins: 0,
            closeCalls: 0,
            timeCamping: 0,
            shotsFired: 0,
            hits: 0,
            startTime: Date.now(), // Critical for duration calculation
            asteroidColorMap: {}
        };
        this.accumulatedRotation = 0;
        this.campingTimer = 0;
    }

    resetGame() {
        this.lives = 3;
        this.score = 0;
        this.level = 1;
        this.ship = new Ship(this.width / 2, this.height / 2);
        this.ship.invulnerable = 180; // Start with shield
        this.resetStats();

        // Full Cleanup
        this.cow = null;
        this.ripples = [];
        this.shake = 0;
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];

        this.spawnAsteroids(5);
        this.updateUI();
    }

    spawnAsteroids(count) {
        for (let i = 0; i < count; i++) {
            let x, y;
            // Spawn away from center to avoid instant death
            do {
                x = Math.random() * this.width;
                y = Math.random() * this.height;
            } while (Vector2.distance(new Vector2(x, y), new Vector2(this.width / 2, this.height / 2)) < 200);

            this.asteroids.push(new Asteroid(x, y));
        }
    }

    generatePlanets() {
        this.planets = [];
        const count = 3; // Number of visible planets
        for (let i = 0; i < count; i++) {
            // Push them DEEP into the background
            const depth = Math.random() * 0.15 + 0.05; // 0.05 to 0.2 (Very far)
            this.planets.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: (Math.random() * 60 + 40) * depth * 4, // Scale up size to look like big distant planets
                color: `hsl(${Math.random() * 360}, 40%, 30%)`, // Desaturated, darker
                hasRings: Math.random() > 0.5,
                depth: depth,
                speed: depth // Move at parallax speed
            });
        }
    }

    initLevel() {
        // Just waiting for user input loop logic handled in update
    }

    update() {
        // Shake decay (Always run)
        if (this.shake > 0) {
            this.shake *= 0.9;
            if (this.shake < 0.5) this.shake = 0;
        }

        // PAUSE GAME IF DASHBOARD OPEN
        if (this.dashboard && this.dashboard.elements.overlay && !this.dashboard.elements.overlay.classList.contains('hidden')) {
            return;
        }

        // Always update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(this.width, this.height);
            if (p.isDead) {
                this.particles.splice(i, 1);
            }
        }

        // --- BACKGROUND UPDATE (Constant Drift + Parallax) ---
        const drift = { x: 0, y: 4.0 }; // INCREASED SPEED

        // Asteroid vs Asteroid Collisions
        this.checkAsteroidCollisions();

        // Helper for parallax
        const updateBg = (el, speedMult) => {
            el.y += drift.y * speedMult; // Constant drift

            if (this.ship && !this.ship.isDead) {
                el.x -= this.ship.vel.x * speedMult;
                el.y -= this.ship.vel.y * speedMult;
            }

            // Wrap
            if (el.x < -200) el.x += this.width + 400;
            if (el.x > this.width + 200) el.x -= this.width + 400;
            if (el.y < -200) el.y += this.height + 400;
            if (el.y > this.height + 200) el.y -= this.height + 400;
        };

        this.stars.forEach(s => updateBg(s, s.speed));
        this.planets.forEach(p => updateBg(p, p.speed));

        // Update Ripples (Always run)
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.speed;
            r.amplitude *= 0.95; // Decay power

            // Physics: Push Asteroids
            if (this.state === 'PLAYING') {
                for (const a of this.asteroids) {
                    const dist = Vector2.distance(new Vector2(r.x, r.y), a.pos);
                    // Check if asteroid is in the "wave zone" (width of wave)
                    if (Math.abs(dist - r.radius) < r.width) {
                        // Push away from center
                        const angle = Math.atan2(a.pos.y - r.y, a.pos.x - r.x);
                        const force = new Vector2(Math.cos(angle), Math.sin(angle));

                        // Strength depends on amplitude and how close it is to the wave peak
                        const waveIntensity = Math.cos((dist - r.radius) / r.width * Math.PI / 2);
                        // Multiplier tweaked: Was 0.01, now 0.002 for MICRO subtle effect
                        force.mult(r.amplitude * 0.002 * waveIntensity);

                        a.vel.add(force);

                        // Spin it too!
                        // a.angle += 0.1; // If we had rotation velocity...
                    }
                }
            }

            if (r.amplitude < 0.1 || r.radius > Math.max(this.width, this.height)) {
                this.ripples.splice(i, 1);
            }
        }

        if (this.state !== 'PLAYING') return;

        // --- PLAYING STATE ---

        if (this.state === 'PLAYING') { // Check PLAYING state for intensity
            let baseIntensity = Math.min(1, (this.level - 1) * 0.1); // +10% per level

            // Boost intensity during chaos (lots of asteroids or visual shake)
            if (this.shake > 5) baseIntensity += 0.2;
            if (this.asteroids.length > 15) baseIntensity += 0.1;

            this.audio.setMusicIntensity(baseIntensity);
        }

        // --- PLAYING STATE ---

        // Update Ship
        if (!this.ship.isDead) {
            const isBlocked = this.dashboard && this.dashboard.elements.overlay && !this.dashboard.elements.overlay.classList.contains('hidden');
            this.ship.update(this.width, this.height, this.input, this.particles, this.bullets, this.audio, this.stats, isBlocked);

            // --- Extended Telemetry Tracking ---

            // 1. Thrust Count
            if (this.input.up) {
                this.stats.thrusts++;
            }

            // 2. Turn Degrees (Approximate based on frame updates)
            if (this.input.left || this.input.right) {
                const turnSpeed = 5; // Assuming 5 degrees per frame from Ship.js (check this value)
                this.stats.turns += turnSpeed;
                this.accumulatedRotation += turnSpeed;
            } else {
                this.accumulatedRotation = Math.max(0, this.accumulatedRotation - 2); // Decay
            }

            // 3. Panic Spin Detection (> 360 degrees continuous without shooting)
            if (this.accumulatedRotation > 360) {
                this.stats.panicSpins++;
                this.accumulatedRotation = 0; // Reset after detecting one panic
                TelemetryService.logEvent('panic_spin', { rotation: 360 });
            }

            // 4. Camping Detection (Stay within 100px of center)
            const center = new Vector2(this.width / 2, this.height / 2);
            const distFromCenter = Math.hypot(this.ship.pos.x - center.x, this.ship.pos.y - center.y);
            if (distFromCenter < 150) {
                this.campingTimer += 1 / 60; // Assuming 60fps
                if (this.campingTimer > 5 && Math.floor(this.campingTimer) % 5 === 0) { // Log every 5s
                    // Only log once per threshold to avoid spam? 
                    // For now just accumulate total time
                }
            } else {
                if (this.campingTimer > 10) {
                    TelemetryService.logEvent('camping', { duration: Math.floor(this.campingTimer) });
                }
                this.campingTimer = 0;
            }
            this.stats.timeCamping += (distFromCenter < 150 ? 1 / 60 : 0);

            // 5. Close Calls (in Collision Loop)
        }

        // Update Entities
        this.bullets.forEach(b => b.update(this.width, this.height));
        this.asteroids.forEach(a => a.update(this.width, this.height));
        this.particles.forEach(p => p.update(this.width, this.height));

        // Update Cow
        if (this.cow) {
            this.cow.update(this.width, this.height, this.audio);
            // Randomly despawn if it drifts too long? 
            // Nah, let it roam until death.
        } else if (Math.random() < 0.002) { // 0.2% chance per frame to spawn
            // Spawn Cow
            this.cow = new Cow(
                Math.random() > 0.5 ? 0 : this.width,
                Math.random() * this.height
            );
        }

        // Cleanup Dead Entities
        this.bullets = this.bullets.filter(b => !b.isDead);
        this.particles = this.particles.filter(p => !p.isDead);
        // Asteroids cleanup handled in collision to support splitting

        this.checkCollisions();

        // Level Up
        // Level Up & Endless Spawning Logic
        // Difficulty increases every 5000 points
        const targetLevel = 1 + Math.floor(this.score / 5000);
        if (targetLevel > this.level) {
            this.level = targetLevel;
            // Audio cue for level up?
        }

        // Maintain Target Density (Endless Mode)
        const targetCount = 10 + this.level * 3;

        if (this.asteroids.length < targetCount && Math.random() < 0.02) { // 2% chance per frame to spawn if low
            this.spawnAsteroids(1); // Spawns 1 safely away from center/ship
        }
    }

    checkCollisions() {
        // Bullet vs Asteroid
        // Update Background (Parallax)
        if (this.ship && !this.ship.isDead) {
            this.gridOffset.x -= this.ship.vel.x * 0.5;
            this.gridOffset.y -= this.ship.vel.y * 0.5;

            // Move stars
            this.stars.forEach(star => {
                star.x -= this.ship.vel.x * star.speed;
                star.y -= this.ship.vel.y * star.speed;

                // Wrap stars
                if (star.x < 0) star.x += this.width;
                if (star.x > this.width) star.x -= this.width;
                if (star.y < 0) star.y += this.height;
                if (star.y > this.height) star.y -= this.height;
            });
        }
        this.shake *= 0.9; // Decay shake

        // Collision Detection
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            // Bullet vs Asteroids
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const a = this.asteroids[j];
                if (a.collidesWith(b)) {
                    // Classify Size
                    let sizeCat = 'Small';
                    if (a.radius > 30) sizeCat = 'Large';
                    else if (a.radius > 15) sizeCat = 'Medium';

                    TelemetryService.logEvent('hit', {
                        targetType: 'asteroid',
                        size: sizeCat,
                        radius: Math.round(a.radius),
                        color: a.color
                    });

                    this.stats.asteroidColorMap = this.stats.asteroidColorMap || {};
                    this.stats.asteroidColorMap[a.color] = (this.stats.asteroidColorMap[a.color] || 0) + 1;
                    this.stats.hits++;

                    b.isDead = true;
                    this.breakAsteroid(a, j);
                    this.score += 100 * (4 - (a.radius > 20 ? 1 : a.radius > 10 ? 2 : 3));
                    this.updateUI();

                    // MEGA EXPLOSION for Bullet Impact
                    const distToShip = this.ship ? Vector2.distance(this.ship.pos, a.pos) : 1000;
                    // Amplitude: Base 200, scale by size, boosted by proximity (closer = stronger)
                    // Proximity factor: 1.0 at 1000px, 3.0 at 0px
                    const proximity = 1 + (1000 - Math.min(distToShip, 1000)) / 500;
                    const rippleAmp = (a.radius * 2) * proximity;

                    this.createExplosion(a.pos, a.color, 150);
                    this.createRipple(a.pos, rippleAmp, 30);
                    this.audio.explode(a.color, a.radius);
                    this.shake = 20;

                    break;
                }
            }

            if (b.isDead) continue; // Skip cow check if bullet hit asteroid

            // Bullet vs Cow
            if (this.cow && Vector2.distance(b.pos, this.cow.pos) < this.cow.radius + 10) {
                b.isDead = true;

                // OPERATION SPILLED MILK
                this.createExplosion(this.cow.pos, '#ffffff', 300); // MASSIVE MILK STORM
                this.createRipple(this.cow.pos, 800, 80); // Huge space distortion

                this.audio.explode('cow', 100);
                // this.audio.ripple(); // Handled by createRipple? No, createRipple is visual. Audio ripple is sound.
                // Keeping audio ripple separate or maybe integrate?
                this.audio.ripple();
                this.shake = 30; // EARTHQUAKE

                // Spawn Mini Cows (Particles)
                // Manual particle creation simulating mini cows

                for (let i = 0; i < 8; i++) {
                    const p = new Particle(this.cow.pos.x, this.cow.pos.y, '#ffffff');
                    p.vel = new Vector2((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
                    p.life = 2.0; // Live longer
                    p.radius = 15; // Mini scale

                    // Override Draw to be a Cow
                    p.draw = (ctx) => {
                        ctx.save();
                        ctx.translate(p.pos.x, p.pos.y);
                        // Rotate based on velocity
                        const angle = Math.atan2(p.vel.y, p.vel.x);
                        ctx.rotate(angle);

                        const s = 0.5; // Mini scale
                        ctx.globalAlpha = p.life > 1 ? 1 : p.life;

                        // Simple Mini Cow Draw
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.roundRect(-15 * s, -10 * s, 30 * s, 20 * s, 5 * s);
                        ctx.fill();
                        // Legs
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(-10 * s, 10 * s); ctx.lineTo(-10 * s, 15 * s);
                        ctx.moveTo(10 * s, 10 * s); ctx.lineTo(10 * s, 15 * s);
                        ctx.stroke();

                        ctx.restore();
                    };
                    this.particles.push(p);
                }


                this.cow = null;
                // Log cow murder?
                this.score += 1000;
                this.updateUI();
            }
        }

        // Check Close Calls (Ship vs Asteroids) - Independent of bullets
        if (this.ship && !this.ship.isDead && !this.ship.isInvulnerable) { // Only check if vulnerable
            this.asteroids.forEach(a => {
                const dist = Math.hypot(this.ship.pos.x - a.pos.x, this.ship.pos.y - a.pos.y);
                const safeDist = a.radius + this.ship.radius + 40; // 40px margin
                const dangerDist = a.radius + this.ship.radius + 5;

                if (dist < safeDist && dist > dangerDist) {
                    // Debounce close calls?
                    if (!a.hadCloseCall) {
                        this.stats.closeCalls++;
                        TelemetryService.logEvent('close_call', { dist: Math.round(dist) });
                        a.hadCloseCall = true; // Flag to prevent spamming close call on same asteroid
                    }
                }
            });

            // Ship vs Asteroid (Actual Collision)
            for (const a of this.asteroids) {
                if (a.collidesWith(this.ship)) {
                    this.playerHit();
                    return;
                }
            }
        }
    }

    checkAsteroidCollisions() {
        for (let i = 0; i < this.asteroids.length; i++) {
            const a1 = this.asteroids[i];
            for (let j = i + 1; j < this.asteroids.length; j++) {
                const a2 = this.asteroids[j];

                const dist = Vector2.distance(a1.pos, a2.pos);
                const minDist = a1.radius + a2.radius;

                if (dist < minDist) {
                    // 1. Resolve Overlap (Push apart)
                    const overlap = minDist - dist;
                    // Normal vector from a1 to a2
                    // n = (a2 - a1) normalized
                    const dx = a2.pos.x - a1.pos.x;
                    const dy = a2.pos.y - a1.pos.y;

                    // Avoid div by zero
                    if (dist === 0) continue;

                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Move apart proportional to inverse mass (radius for now)
                    // Simplified: move equally
                    const moveX = nx * overlap * 0.5;
                    const moveY = ny * overlap * 0.5;

                    a1.pos.x -= moveX;
                    a1.pos.y -= moveY;
                    a2.pos.x += moveX;
                    a2.pos.y += moveY;

                    // 2. Elastic Bounce
                    // v1' = v1 - 2*m2/(m1+m2) * dot(v1-v2, n) * n
                    // Assuming Mass ~ radius^2 (Area)
                    const m1 = a1.radius * a1.radius;
                    const m2 = a2.radius * a2.radius;

                    // Relative velocity
                    const dvx = a1.vel.x - a2.vel.x;
                    const dvy = a1.vel.y - a2.vel.y;

                    const dotProduct = dvx * nx + dvy * ny;

                    // Conservation Impulse
                    const imp = (2 * dotProduct) / (m1 + m2);

                    // Apply impulse
                    a1.vel.x -= imp * m2 * nx;
                    a1.vel.y -= imp * m2 * ny;
                    a2.vel.x += imp * m1 * nx;
                    a2.vel.y += imp * m1 * ny;
                }
            }
        }
    }

    playerHit() {
        this.lives--;
        this.createExplosion(this.ship.pos, this.ship.color, 50);
        this.createRipple(this.ship.pos, 1000, 100); // Universe Breaking Ripple
        this.audio.die(); // Pitiful death sound
        this.shake = 30;
        this.updateUI();

        TelemetryService.logEvent('death', { livesRemaining: this.lives });

        if (this.lives > 0) {
            this.respawnShip();
        } else {
            this.gameOver();
        }
    }

    respawnShip() {
        this.ship.pos = new Vector2(this.width / 2, this.height / 2);
        this.ship.vel = new Vector2(0, 0);
        this.ship.angle = -Math.PI / 2;
        this.ship.invulnerable = 180; // 3 seconds invulnerability
        this.createRipple(this.ship.pos, 150, 10); // Spawn ripple

        // Push asteroids away from center to prevent instant death spawn kill (safety)
        this.asteroids.forEach(a => {
            if (Vector2.distance(a.pos, this.ship.pos) < 200) {
                a.pos.add(new Vector2((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200));
            }
        });
    }

    breakAsteroid(asteroid, index) {
        this.asteroids.splice(index, 1);
        const newPieces = asteroid.break();
        this.asteroids.push(...newPieces);

        // Ripple based on asteroid size
        // MASSIVE RIPPLE for drama
        const strength = asteroid.radius * 3.0; // Stronger distortion
        this.createRipple(asteroid.pos, asteroid.radius * 15, strength); // Huge radius
    }

    createExplosion(pos, color, count) {
        // OPTIMIZATION: Reduce count, increase presence
        // We use fewer particles but they are larger and brighter
        const realCount = Math.floor(count * 0.8);

        for (let i = 0; i < realCount; i++) {
            const p = new Particle(pos.x, pos.y, color);
            p.vel.mult(Math.random() * 3 + 2);
            // Make particles visually larger to compensate for lower count
            p.radius = Math.random() * 3 + 1;
            this.particles.push(p);
        }

        // Add "Shockwave" particles (Fast, high friction)
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            const speed = 8;
            const p = new Particle(pos.x, pos.y, color);
            p.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
            p.decay = 0.05; // Fade fast
            this.particles.push(p);
        }

        // Performance Cap
        if (this.particles.length > 300) {
            this.particles.splice(0, this.particles.length - 300);
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.createExplosion(this.ship.pos, this.ship.color, 50);
        this.audio.explode();
        this.ship.isDead = true;
        this.gameOverTime = Date.now(); // Set timestamp for cooldown

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neon-asteroids-hs', this.highScore);
        }

        if (this.user) {
            TelemetryService.saveSession(this.user.uid, this.score, this.level, this.stats);
        }

        // Reset Music Intensity
        this.audio.setMusicIntensity(0);

        this.uiGameOverScreen.classList.remove('hidden');
        this.uiGameOverScreen.classList.add('visible');
        this.uiFinalScore.innerText = this.score;
        this.updateUI();
    }

    createRipple(pos, maxRadius, amplitude) {
        this.ripples.push({
            x: pos.x,
            y: pos.y,
            radius: 10,
            maxRadius: maxRadius,
            amplitude: amplitude,
            speed: 10, // Faster
            width: 100 // Thicker wave (was 50)
        });
        this.audio.ripple();
    }

    updateUI() {
        this.uiScore.innerText = this.score;
        if (this.uiHighScore) this.uiHighScore.innerText = this.highScore;
        if (this.uiLives) this.uiLives.innerText = this.lives;
    }

    getDistortion(x, y) {
        let dx = 0;
        let dy = 0;

        for (const r of this.ripples) {
            const dist = Math.hypot(x - r.x, y - r.y);
            const delta = dist - r.radius;
            if (Math.abs(delta) < r.width) {
                // Cosine wave for smooth ripple: peak at delta=0
                const force = Math.cos(delta / r.width * Math.PI / 2) * r.amplitude;
                const angle = Math.atan2(y - r.y, x - r.x);
                dx += Math.cos(angle) * force;
                dy += Math.sin(angle) * force;
            }
        }
        return { dx, dy };
    }

    draw() {
        // Clear with trail effect
        this.ctx.fillStyle = 'rgba(5, 5, 16, 0.4)'; // 0.4 alpha for trails
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();

        // Apply Camera Shake
        if (this.shake > 0) {
            const dx = (Math.random() - 0.5) * this.shake;
            const dy = (Math.random() - 0.5) * this.shake;
            this.ctx.translate(dx, dy);
        }

        // Draw Retro Grid
        this.drawGrid();

        // Additive Blending for NEON GLOW
        this.ctx.globalCompositeOperation = 'lighter';

        if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
            this.bullets.forEach(b => b.draw(this.ctx));
            this.particles.forEach(p => p.draw(this.ctx));
            this.asteroids.forEach(a => a.draw(this.ctx));
            if (this.ship && !this.ship.isDead) this.ship.draw(this.ctx);
            if (this.cow) this.cow.draw(this.ctx);
            // Draw Touch Controls on top
            if (this.touchControls) this.touchControls.draw(this.ctx);
        }

        this.ctx.restore();
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.shadowBlur = 0;

        // 1. Planets (Deep Background Layer)
        this.planets.forEach(p => {
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Rings
            if (p.hasRings) {
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1;
                this.ctx.globalAlpha = 0.1;
                this.ctx.beginPath();
                this.ctx.ellipse(p.x, p.y, p.radius * 2, p.radius * 0.5, -0.4, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        });

        // 2. Stars (Middle Layer) - BATCHED RENDERING
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = 0.8; // Constant alpha (much faster)
        this.ctx.beginPath();

        // Reusable objects for distortion to avoid GC
        let dx = 0, dy = 0, dist = 0, delta = 0, force = 0, angle = 0;

        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];

            // Inline Distortion Logic (No allocation)
            dx = 0; dy = 0;
            if (this.ripples.length > 0) {
                for (let j = 0; j < this.ripples.length; j++) {
                    const r = this.ripples[j];
                    dist = Math.sqrt((star.x - r.x) ** 2 + (star.y - r.y) ** 2); // Manual distance
                    delta = dist - r.radius;
                    if (Math.abs(delta) < r.width) {
                        force = Math.cos(delta / r.width * Math.PI / 2) * r.amplitude;
                        angle = Math.atan2(star.y - r.y, star.x - r.x);
                        dx += Math.cos(angle) * force;
                        dy += Math.sin(angle) * force;
                    }
                }
            }

            this.ctx.moveTo(star.x + dx, star.y + dy);
            this.ctx.arc(star.x + dx, star.y + dy, star.size, 0, Math.PI * 2);
        }
        this.ctx.fill(); // ONE DRAW CALL

        this.ctx.restore();
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // FPS Calculation
        if (!this.fpsTime) this.fpsTime = timestamp;
        if (timestamp - this.fpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTime = timestamp;
        }
        this.frameCount = (this.frameCount || 0) + 1;

        this.update();
        this.draw();

        // Draw FPS
        this.ctx.save();
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(`FPS: ${this.fps || 0} `, 10, 20);
        this.ctx.restore();

        requestAnimationFrame(this.loop);
    }
}
