import { InputHandler } from './InputHandler.js';
import { Ship } from './entities/Ship.js';
import { Particle } from './entities/Particle.js';
import { Vector2 } from './Vector2.js';
import { AudioController } from './AudioController.js';
import { TouchControls } from './TouchControls.js';
import { TelemetryService } from './TelemetryService.js';
import { Dashboard } from './Dashboard.js';
import { AdController } from './AdController.js';
import { BackgroundFX } from './BackgroundFX.js';
import { SpawnManager } from './SpawnManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { UIManager } from './UIManager.js';
import { Renderer } from './Renderer.js';

export class Game {
    constructor(canvas) {
        console.log("NEON ASTEROIDS v3.0 - ALIEN FIX");
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // Resize handler
        const resize = () => {
            const oldW = this.width || 0;
            const oldH = this.height || 0;
            const maxW = 2560;
            const minW = this.isMobile ? 900 : 0;
            let targetW = window.innerWidth;
            if (targetW < minW) targetW = minW;
            if (targetW > maxW) targetW = maxW;
            this.width = this.canvas.width = targetW;
            this.height = this.canvas.height = targetW * (window.innerHeight / window.innerWidth);
            if (this.touchControls) this.touchControls.resize(this.width, this.height);
            if (this.backgroundFX) this.backgroundFX.resize(oldW, oldH, this.width, this.height);
        };
        resize();
        window.addEventListener('resize', resize);

        // Subsystems
        this.backgroundFX = new BackgroundFX(this.width, this.height, { isMobile: this.isMobile });
        this.spawnManager = new SpawnManager();
        this.collisionSystem = new CollisionSystem();
        this.ui = new UIManager();
        this.renderer = new Renderer(this.ctx);

        // Input & controls
        this.input = new InputHandler();
        this.touchControls = new TouchControls(this.input, this.width, this.height);
        this.dashboard = new Dashboard((visible) => {
            if (this.touchControls) {
                if (visible) this.touchControls.setActive(false);
                else if (this.state === 'PLAYING') this.touchControls.setActive(true);
            }
        });
        this.audio = new AudioController();
        this.ads = new AdController();
        this.ads.showBottomBanner();

        // Entities
        this.ship = null;
        this.alien = null;
        this.cow = null;
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];

        // Camera / shake
        this.camera = new Vector2(0, 0);
        this.shake = 0;

        // Game state
        this.score = 0;
        this.lives = 3;
        this.highScore = parseInt(localStorage.getItem('neon-asteroids-hs')) || 0;
        this.level = 1;
        this.state = 'START';
        this.user = null;

        // Telemetry stats
        this.stats = { thrusts: 0, turns: 0, panicSpins: 0, closeCalls: 0, timeCamping: 0, shotsFired: 0, hits: 0, aliensKilled: 0, aliensSpawned: 0, alienHitsTaken: 0, alienShotsFired: 0, alienShotsDodged: 0, startTime: Date.now() };
        this.lastRotation = 0;
        this.accumulatedRotation = 0;
        this.lastPosition = new Vector2(this.width / 2, this.height / 2);
        this.campingTimer = 0;

        // UI setup
        this.ui.swapMobilePrompts(this.isMobile);
        this.ui.setupAuth({
            onLogsClick: () => { if (this.user) this.dashboard.show(this.user); else alert("Please Login First!"); },
            onPauseClick: () => this.togglePause(),
            onEndGame: () => this.endGame(),
            onUserChange: (user) => { this.user = user; },
            dashboard: this.dashboard,
        });
        this.ui.updateUI(this.score, this.highScore, this.lives);

        // Audio unlock
        const unlockAudio = () => { if (this.audio) this.audio.resume(); };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio, { passive: true });
        window.addEventListener('touchend', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio);

        this.loop = this.loop.bind(this);
    }

    start() {
        this.ui.fetchAndRenderLeaderboard(this.user ? this.user.uid : null);

        const startAction = (e) => {
            if (!this.user) return;
            if (this.dashboard && this.dashboard.isVisible()) return;
            if (e.target.id === 'view-logs-gameover-btn' || e.target.id === 'ingame-logs-btn' || e.target.id === 'pause-btn') {
                e.stopPropagation();
                if ((e.target.id === 'ingame-logs-btn' || e.target.id === 'view-logs-gameover-btn') && this.user) this.dashboard.show(this.user);
                return;
            }
            this.audio.resume();
            this.audio.startMusic();
            if (this.state === 'START') this.startGame();
            else if (this.state === 'GAMEOVER' && Date.now() - (this.gameOverTime || 0) > 2000) this.startGame();
        };
        window.addEventListener('click', startAction);
        window.addEventListener('touchstart', startAction, { passive: false });
        window.addEventListener('touchend', startAction, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (!this.user) return;
            if (this.dashboard && this.dashboard.isVisible()) return;
            if (e.code === 'Space' || e.code === 'Enter') {
                if (this.state === 'START') this.startGame();
                else if (this.state === 'GAMEOVER' && Date.now() - (this.gameOverTime || 0) > 2000) this.startGame();
            }
        });

        requestAnimationFrame(this.loop);
    }

    startGame() {
        this.state = 'PLAYING';
        this.ads.hideBottomBanner();
        this.ads.hideGameOverAd();
        this.ui.hideStartScreen();
        this.ui.hideGameOverScreen();
        this.resetGame();
        if (this.touchControls) this.touchControls.setActive(true);
        TelemetryService.startSession();
        this.isPaused = false;
        if (this.ui.btnPause) this.ui.btnPause.innerText = 'PAUSE';
        this.audio.resume();
        this.audio.startMusic();
    }

    togglePause() {
        if (this.state !== 'PLAYING') return;
        this.isPaused = !this.isPaused;
        if (this.ui.btnPause) this.ui.btnPause.innerText = this.isPaused ? 'RESUME' : 'PAUSE';
        if (this.isPaused) this.audio.stopMusic(); else this.audio.startMusic();
    }

    endGame() {
        this.state = 'START';
        this.audio.stopMusic();
        this.ads.showBottomBanner();
        this.ads.hideGameOverAd();
        this.ui.showStartScreen();
        if (this.dashboard) this.dashboard.hide();
        this.ship = null;
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];
        this.cow = null;
        this.score = 0;
        this.ui.updateUI(this.score, this.highScore, this.lives);
        this.spawnManager.spawnAsteroids(5, this.asteroids, this.width, this.height);
    }

    resetStats() {
        this.stats = {
            thrusts: 0, turns: 0, panicSpins: 0, closeCalls: 0, timeCamping: 0,
            shotsFired: 0, hits: 0, aliensKilled: 0, aliensSpawned: 0,
            alienHitsTaken: 0, alienShotsFired: 0, alienShotsDodged: 0,
            startTime: Date.now(), asteroidColorMap: {}, asteroidSizeMap: { Small: 0, Medium: 0, Large: 0 }
        };
        this.accumulatedRotation = 0;
        this.campingTimer = 0;
    }

    resetGame() {
        this.lives = 3;
        this.score = 0;
        this.level = 1;
        this.ship = new Ship(this.width / 2, this.height / 2);
        this.ship.invulnerable = 180;
        this.resetStats();
        this.cow = null;
        this.shake = 0;
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];
        this.spawnManager.spawnAsteroids(5, this.asteroids, this.width, this.height);
        this.ui.updateUI(this.score, this.highScore, this.lives);
    }

    update(dt) {
        // Shake decay (always run)
        if (this.shake > 0) { this.shake *= 0.9; if (this.shake < 0.5) this.shake = 0; }

        // Pause guard
        if (this.isPaused || (this.dashboard && this.dashboard.isVisible())) return;

        // Particles (always update)
        for (let i = 0; i < this.particles.length; i++) this.particles[i].update(this.width, this.height);
        this.particles = this.particles.filter(p => !p.isDead);

        // Background FX
        this.backgroundFX.update(dt, this.ship, this.asteroids, this.state);

        // Asteroid-asteroid collisions
        this.collisionSystem.checkAsteroidCollisions(this.asteroids);

        if (this.state !== 'PLAYING') return;

        // Music intensity
        let baseIntensity = Math.min(1, (this.level - 1) * 0.1);
        if (this.shake > 5) baseIntensity += 0.2;
        if (this.asteroids.length > 15) baseIntensity += 0.1;
        this.audio.setMusicIntensity(baseIntensity);

        // Ship update + telemetry tracking
        if (this.ship && !this.ship.isDead) {
            const isBlocked = this.dashboard && this.dashboard.isVisible();
            this.ship.update(this.width, this.height, this.input, this.particles, this.bullets, this.audio, this.stats, isBlocked);

            if (this.input.getThrust()) this.stats.thrusts++;
            if (this.input.getRotation() !== 0) {
                const turnSpeed = 3;
                this.stats.turns += turnSpeed;
                this.accumulatedRotation += turnSpeed;
            } else {
                this.accumulatedRotation = Math.max(0, this.accumulatedRotation - 2);
            }
            if (this.accumulatedRotation > 360) {
                this.stats.panicSpins++;
                this.accumulatedRotation = 0;
                TelemetryService.logEvent('panic_spin', { rotation: 360 });
            }
            const distFromCenter = Math.hypot(this.ship.pos.x - this.width / 2, this.ship.pos.y - this.height / 2);
            if (distFromCenter < 150) { this.campingTimer += dt; this.stats.timeCamping += dt; }
            else { if (this.campingTimer > 10) TelemetryService.logEvent('camping', { duration: Math.floor(this.campingTimer) }); this.campingTimer = 0; }
        }

        // Entity updates
        this.bullets.forEach(b => b.update(this.width, this.height));
        this.asteroids.forEach(a => a.update(this.width, this.height));

        // Spawn management
        this.cow = this.spawnManager.updateCow(this.cow, this.width, this.height, this.audio);
        this.alien = this.spawnManager.updateAlien(this.alien, this.width, this.height, this.ship, this.asteroids, this.bullets, this.audio, this.stats, this.state, () => {
            this.stats.alienShotsFired++;
            TelemetryService.logEvent('alien_fire');
        });
        if (this.audio && this.audio.setAlienMode) this.audio.setAlienMode(!!this.alien);
        this.spawnManager.maintainDensity(this.asteroids, this.level, this.width, this.height);

        // Cleanup
        this.bullets = this.bullets.filter(b => !b.isDead);
        this.particles = this.particles.filter(p => !p.isDead);

        // Collisions
        this.collisionSystem.checkCollisions({
            ship: this.ship, bullets: this.bullets, asteroids: this.asteroids,
            alien: this.alien, cow: this.cow, stats: this.stats,
            callbacks: {
                onPlayerHit: () => this.playerHit(),
                onAlienKilled: () => { this.score += 200; this.alien = null; this.updateUI(); },
                onAsteroidHit: (a, j, pts) => {
                    this.collisionSystem.breakAsteroid(a, j, this.asteroids).forEach(piece => this.asteroids.push(piece));
                    this.backgroundFX.createRipple(a.pos, a.radius * 15, a.radius * 3.0, this.audio);
                    this.shake = 20;
                    this.score += pts;
                    this.updateUI();
                },
                onCowKilled: (cow) => {
                    // Spawn mini-cow particles
                    for (let i = 0; i < 8; i++) {
                        const p = new Particle(cow.pos.x, cow.pos.y, '#ffffff');
                        p.vel = new Vector2((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
                        p.life = 2.0;
                        p.radius = 15;
                        p.draw = (ctx) => {
                            ctx.save();
                            ctx.translate(p.pos.x, p.pos.y);
                            const angle = Math.atan2(p.vel.y, p.vel.x);
                            ctx.rotate(angle);
                            const s = 0.5;
                            ctx.globalAlpha = p.life > 1 ? 1 : p.life;
                            ctx.fillStyle = '#ffffff';
                            ctx.beginPath();
                            ctx.roundRect(-15 * s, -10 * s, 30 * s, 20 * s, 5 * s);
                            ctx.fill();
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(-10 * s, 10 * s); ctx.lineTo(-10 * s, 15 * s);
                            ctx.moveTo(10 * s, 10 * s); ctx.lineTo(10 * s, 15 * s);
                            ctx.stroke();
                            ctx.restore();
                        };
                        p._customDraw = true;
                        this.particles.push(p);
                    }
                    this.cow = null;
                    this.shake = 30;
                    this.score += 1000;
                    this.updateUI();
                },
                createExplosion: (pos, color, count) => this.createExplosion(pos, color, count),
                createRipple: (pos, maxR, amp) => this.backgroundFX.createRipple(pos, maxR, amp, this.audio),
                updateUI: () => this.updateUI(),
                audio: this.audio
            }
        });

        // Level up
        const targetLevel = 1 + Math.floor(this.score / 5000);
        if (targetLevel > this.level) this.level = targetLevel;
    }

    draw() {
        this.renderer.draw({
            ctx: this.ctx, width: this.width, height: this.height, shake: this.shake,
            state: this.state, bullets: this.bullets, particles: this.particles,
            asteroids: this.asteroids, ship: this.ship, cow: this.cow, alien: this.alien,
            touchControls: this.touchControls, backgroundFX: this.backgroundFX
        });
    }

    createExplosion(pos, color, count) {
        const realCount = Math.floor(count * 0.8);
        for (let i = 0; i < realCount; i++) {
            const p = new Particle(pos.x, pos.y, color);
            p.vel.mult(Math.random() * 3 + 2);
            p.radius = Math.random() * 3 + 1;
            this.particles.push(p);
        }
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            const speed = 8;
            const p = new Particle(pos.x, pos.y, color);
            p.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
            p.decay = 0.05;
            this.particles.push(p);
        }
        if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
    }

    playerHit() {
        this.lives--;
        this.createExplosion(this.ship.pos, this.ship.color, 50);
        this.backgroundFX.createRipple(this.ship.pos, 1000, 100, this.audio);
        this.audio.die();
        this.shake = 30;
        this.updateUI();
        TelemetryService.logEvent('death', { livesRemaining: this.lives });
        if (this.lives > 0) this.respawnShip(); else this.gameOver();
    }

    respawnShip() {
        this.ship.pos = new Vector2(this.width / 2, this.height / 2);
        this.ship.vel = new Vector2(0, 0);
        this.ship.angle = -Math.PI / 2;
        this.ship.invulnerable = 180;
        this.backgroundFX.createRipple(this.ship.pos, 150, 10, this.audio);
        this.asteroids.forEach(a => {
            if (Math.hypot(a.pos.x - this.ship.pos.x, a.pos.y - this.ship.pos.y) < 200) {
                a.pos.x += (Math.random() - 0.5) * 200;
                a.pos.y += (Math.random() - 0.5) * 200;
            }
        });
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.createExplosion(this.ship.pos, this.ship.color, 50);
        this.audio.explode();
        this.ship.isDead = true;
        this.gameOverTime = Date.now();
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neon-asteroids-hs', this.highScore);
        }
        if (this.user) TelemetryService.saveSession(this.user.uid, this.score, this.level, this.stats);
        this.audio.stopMusic();
        this.ui.showGameOverScreen(this.score);
        this.ads.showGameOverAd();
        this.ads.showBottomBanner();
        this.updateUI();
        this.ui.fetchAndRenderLeaderboard(this.user ? this.user.uid : null);
    }

    updateUI() {
        this.ui.updateUI(this.score, this.highScore, this.lives);
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (!this.fpsTime) this.fpsTime = timestamp;
        if (timestamp - this.fpsTime >= 1000) { this.fps = this.frameCount; this.frameCount = 0; this.fpsTime = timestamp; }
        this.frameCount = (this.frameCount || 0) + 1;

        this.update(deltaTime / 1000);
        this.draw();
        this.renderer.drawFPS(this.ctx, this.fps);

        requestAnimationFrame(this.loop);
    }
}
